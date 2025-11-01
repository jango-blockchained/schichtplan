"""
Enhanced test for yearly calendar generation with detailed verification.
"""

import pytest
from datetime import datetime, timedelta
from src.backend.models import Absence, Employee, Settings, db
from src.backend.services.vacation_pdf_generator import VacationPDFGenerator


def test_yearly_calendar_shows_approved_absences_only(app):
    """
    Test that yearly calendar only shows approved absences, not requested or declined.
    """
    with app.app_context():
        # Create test employees
        employees = [
            Employee(
                first_name="Test",
                last_name="Employee1",
                employee_id="TE1",
                employee_group="VZ",
                contracted_hours=40,
                vacation_per_year=30,
                is_active=True,
            ),
            Employee(
                first_name="Test",
                last_name="Employee2",
                employee_id="TE2",
                employee_group="TZ",
                contracted_hours=20,
                vacation_per_year=25,
                is_active=True,
            ),
        ]
        
        for emp in employees:
            db.session.add(emp)
        db.session.commit()
        
        # Create absences with different statuses
        absences = [
            # Approved - should appear
            Absence(
                employee_id=employees[0].id,
                absence_type_id="vacation",
                start_date=datetime(2024, 7, 1).date(),
                end_date=datetime(2024, 7, 5).date(),
                status="approved",
                note="Approved vacation",
            ),
            # Requested - should NOT appear
            Absence(
                employee_id=employees[1].id,
                absence_type_id="vacation",
                start_date=datetime(2024, 7, 8).date(),
                end_date=datetime(2024, 7, 12).date(),
                status="requested",
                note="Pending vacation",
            ),
            # Declined - should NOT appear
            Absence(
                employee_id=employees[0].id,
                absence_type_id="vacation",
                start_date=datetime(2024, 7, 15).date(),
                end_date=datetime(2024, 7, 19).date(),
                status="declined",
                note="Declined vacation",
            ),
            # Another approved - should appear
            Absence(
                employee_id=employees[1].id,
                absence_type_id="vacation",
                start_date=datetime(2024, 8, 1).date(),
                end_date=datetime(2024, 8, 7).date(),
                status="approved",
                note="Summer vacation",
            ),
        ]
        
        for absence in absences:
            db.session.add(absence)
        db.session.commit()
        
        # Generate calendar
        generator = VacationPDFGenerator()
        settings = Settings.query.first()
        
        pdf_buffer = generator.generate_yearly_calendar(
            year=2024,
            employees=employees,
            absences=absences,
            settings=settings,
        )
        
        # Verify PDF was generated
        assert pdf_buffer is not None
        content = pdf_buffer.read()
        assert content.startswith(b"%PDF-")
        
        # Read the PDF content as text to verify
        import pypdf
        pdf_buffer.seek(0)
        reader = pypdf.PdfReader(pdf_buffer)
        
        # Extract all text
        all_text = ""
        for page in reader.pages:
            all_text += page.extract_text()
        
        # Verify legend shows only approved absences count (2 out of 4 total)
        assert "2 genehmigte Anträge" in all_text
        
        # Cleanup
        for absence in absences:
            db.session.delete(absence)
        for emp in employees:
            db.session.delete(emp)
        db.session.commit()


def test_yearly_calendar_grid_layout(app):
    """
    Test that yearly calendar has correct 2-page, 2x3 grid layout.
    """
    with app.app_context():
        generator = VacationPDFGenerator()
        settings = Settings.query.first()
        
        # Generate calendar without absences
        pdf_buffer = generator.generate_yearly_calendar(
            year=2024,
            employees=[],
            absences=[],
            settings=settings,
        )
        
        # Verify PDF structure
        import pypdf
        reader = pypdf.PdfReader(pdf_buffer)
        
        # Should have exactly 2 pages
        assert len(reader.pages) == 2
        
        # Each page should be landscape A4
        for page in reader.pages:
            width = float(page.mediabox.width)
            height = float(page.mediabox.height)
            # Landscape means width > height
            assert width > height
            # A4 dimensions in points (approximately)
            assert abs(width - 841.89) < 1.0
            assert abs(height - 595.28) < 1.0
        
        # Verify all 12 months are present
        all_text = ""
        for page in reader.pages:
            all_text += page.extract_text()
        
        months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ]
        
        for month in months:
            assert month in all_text, f"Month {month} not found in calendar"


def test_yearly_calendar_with_settings(app):
    """
    Test that yearly calendar includes store name from settings.
    """
    with app.app_context():
        # Get or update settings
        settings = Settings.query.first()
        if settings:
            original_name = settings.store_name
            settings.store_name = "Test Store Name"
            db.session.commit()
        
        generator = VacationPDFGenerator()
        
        pdf_buffer = generator.generate_yearly_calendar(
            year=2024,
            employees=[],
            absences=[],
            settings=settings,
        )
        
        # Verify store name appears in PDF
        import pypdf
        reader = pypdf.PdfReader(pdf_buffer)
        first_page_text = reader.pages[0].extract_text()
        
        if settings:
            assert "Test Store Name" in first_page_text
        
        # Restore original name
        if settings and original_name:
            settings.store_name = original_name
            db.session.commit()
