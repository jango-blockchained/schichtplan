"""
Tests for vacation PDF generation.
"""

import pytest
from datetime import datetime, timedelta
from src.backend.models import Absence, Employee, Settings, db
from src.backend.services.vacation_pdf_generator import VacationPDFGenerator


@pytest.fixture
def sample_employees(app):
    """Create sample employees for testing."""
    with app.app_context():
        employees = [
            Employee(
                first_name="Max",
                last_name="Mustermann",
                employee_id="MUS",
                employee_group="VZ",
                contracted_hours=40,
                vacation_per_year=30,
                is_active=True,
            ),
            Employee(
                first_name="Anna",
                last_name="Schmidt",
                employee_id="SCH",
                employee_group="TZ",
                contracted_hours=20,
                vacation_per_year=25,
                is_active=True,
            ),
            Employee(
                first_name="Peter",
                last_name="Weber",
                employee_id="WEB",
                employee_group="VZ",
                contracted_hours=40,
                vacation_per_year=30,
                is_active=True,
            ),
        ]

        for emp in employees:
            db.session.add(emp)
        db.session.commit()

        yield employees

        # Cleanup
        for emp in employees:
            db.session.delete(emp)
        db.session.commit()


@pytest.fixture
def sample_absences(app, sample_employees):
    """Create sample absences for testing."""
    with app.app_context():
        absences = [
            Absence(
                employee_id=sample_employees[0].id,
                absence_type_id="vacation",
                start_date=datetime(2024, 7, 1).date(),
                end_date=datetime(2024, 7, 14).date(),
                status="approved",
                note="Sommerurlaub",
            ),
            Absence(
                employee_id=sample_employees[1].id,
                absence_type_id="vacation",
                start_date=datetime(2024, 8, 1).date(),
                end_date=datetime(2024, 8, 7).date(),
                status="requested",
            ),
            Absence(
                employee_id=sample_employees[2].id,
                absence_type_id="vacation",
                start_date=datetime(2024, 7, 15).date(),
                end_date=datetime(2024, 7, 21).date(),
                status="approved",
            ),
        ]

        for absence in absences:
            db.session.add(absence)
        db.session.commit()

        yield absences

        # Cleanup
        for absence in absences:
            db.session.delete(absence)
        db.session.commit()


def test_admin_yearly_form_generation(app, sample_employees, sample_absences):
    """Test generation of admin yearly form."""
    with app.app_context():
        generator = VacationPDFGenerator()
        settings = Settings.query.first()

        pdf_buffer = generator.generate_admin_yearly_form(
            year=2024,
            employees=sample_employees,
            absences=sample_absences,
            settings=settings,
        )

        assert pdf_buffer is not None
        assert pdf_buffer.tell() == 0  # Buffer is at the start

        # Read some content to verify it's a valid PDF
        content = pdf_buffer.read(10)
        assert content.startswith(b"%PDF-")  # PDF magic number


def test_employee_request_form_generation(app, sample_employees, sample_absences):
    """Test generation of employee request form."""
    with app.app_context():
        generator = VacationPDFGenerator()
        settings = Settings.query.first()

        # Test with absence data
        pdf_buffer = generator.generate_employee_request_form(
            employee=sample_employees[0],
            absence=sample_absences[0],
            settings=settings,
        )

        assert pdf_buffer is not None
        content = pdf_buffer.read(10)
        assert content.startswith(b"%PDF-")


def test_employee_request_form_blank(app, sample_employees):
    """Test generation of blank employee request form."""
    with app.app_context():
        generator = VacationPDFGenerator()
        settings = Settings.query.first()

        # Test without absence data (blank form)
        pdf_buffer = generator.generate_employee_request_form(
            employee=sample_employees[0],
            absence=None,
            settings=settings,
        )

        assert pdf_buffer is not None
        content = pdf_buffer.read(10)
        assert content.startswith(b"%PDF-")


def test_overview_form_generation(app, sample_employees, sample_absences):
    """Test generation of overview form."""
    with app.app_context():
        generator = VacationPDFGenerator()
        settings = Settings.query.first()

        pdf_buffer = generator.generate_overview_form(
            employees=sample_employees,
            absences=sample_absences,
            year=2024,
            settings=settings,
        )

        assert pdf_buffer is not None
        content = pdf_buffer.read(10)
        assert content.startswith(b"%PDF-")


def test_yearly_calendar_generation(app, sample_employees, sample_absences):
    """Test generation of yearly calendar."""
    with app.app_context():
        generator = VacationPDFGenerator()
        settings = Settings.query.first()

        pdf_buffer = generator.generate_yearly_calendar(
            year=2024,
            employees=sample_employees,
            absences=sample_absences,
            settings=settings,
        )

        assert pdf_buffer is not None
        content = pdf_buffer.read(10)
        assert content.startswith(b"%PDF-")


def test_status_text_conversion(app):
    """Test status text conversion to German."""
    with app.app_context():
        generator = VacationPDFGenerator()

        assert generator._get_status_text("requested") == "Beantragt"
        assert generator._get_status_text("approved") == "Genehmigt"
        assert generator._get_status_text("declined") == "Abgelehnt"
        assert generator._get_status_text("unknown") == "unknown"
