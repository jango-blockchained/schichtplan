#!/usr/bin/env python3
"""
Manual test script for vacation PDF generation.

This script generates sample PDFs to verify the vacation PDF generator works correctly.
Run with: python3 test_vacation_pdfs_manual.py
"""

import sys
from pathlib import Path
from datetime import datetime, timedelta

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))


# Mock the database models for standalone testing
class MockEmployee:
    def __init__(
        self, id, first_name, last_name, employee_id, vacation_per_year=30, email=None
    ):
        self.id = id
        self.first_name = first_name
        self.last_name = last_name
        self.employee_id = employee_id
        self.vacation_per_year = vacation_per_year
        self.email = email or f"{employee_id.lower()}@example.com"


class MockAbsence:
    def __init__(
        self, id, employee_id, absence_type_id, start_date, end_date, status, note=None
    ):
        self.id = id
        self.employee_id = employee_id
        self.absence_type_id = absence_type_id
        self.start_date = start_date
        self.end_date = end_date
        self.status = status
        self.note = note


class MockSettings:
    def __init__(self):
        self.store_name = "TEDi Testfiliale"
        self.store_address = "Musterstraße 123, 12345 Berlin"


def main():
    """Generate sample PDFs for testing."""
    from src.backend.services.vacation_pdf_generator import VacationPDFGenerator

    print("🔧 Initializing PDF Generator...")
    generator = VacationPDFGenerator()

    # Create sample data
    employees = [
        MockEmployee(1, "Max", "Mustermann", "MUS", 30, "max.mustermann@example.com"),
        MockEmployee(2, "Anna", "Schmidt", "SCH", 25),
        MockEmployee(3, "Peter", "Weber", "WEB", 30),
        MockEmployee(4, "Lisa", "Müller", "MUE", 28),
        MockEmployee(5, "Thomas", "Fischer", "FIS", 30),
    ]

    year = datetime.now().year

    absences = [
        MockAbsence(
            1,
            1,
            "vacation",
            datetime(year, 7, 1).date(),
            datetime(year, 7, 14).date(),
            "approved",
            "Sommerurlaub",
        ),
        MockAbsence(
            2,
            2,
            "vacation",
            datetime(year, 8, 1).date(),
            datetime(year, 8, 7).date(),
            "requested",
            "Urlaub",
        ),
        MockAbsence(
            3,
            3,
            "vacation",
            datetime(year, 7, 15).date(),
            datetime(year, 7, 21).date(),
            "approved",
            None,
        ),
        MockAbsence(
            4,
            4,
            "vacation",
            datetime(year, 9, 1).date(),
            datetime(year, 9, 10).date(),
            "approved",
            "Herbsturlaub",
        ),
        MockAbsence(
            5,
            1,
            "vacation",
            datetime(year, 12, 23).date(),
            datetime(year, 12, 30).date(),
            "requested",
            "Weihnachten",
        ),
    ]

    settings = MockSettings()

    output_dir = Path("pdf_test_output")
    output_dir.mkdir(exist_ok=True)

    print(f"\n📄 Generating PDFs in: {output_dir.absolute()}")

    # Test 1: Admin Yearly Form
    print("\n1️⃣  Generating Admin Yearly Form...")
    try:
        pdf_buffer = generator.generate_admin_yearly_form(
            year=year, employees=employees, absences=absences, settings=settings
        )
        output_path = output_dir / f"admin_yearly_{year}.pdf"
        with open(output_path, "wb") as f:
            f.write(pdf_buffer.read())
        print(f"   ✓ Saved: {output_path}")
    except Exception as e:
        print(f"   ✗ Error: {e}")

    # Test 2: Employee Request Form (with absence)
    print("\n2️⃣  Generating Employee Request Form (with data)...")
    try:
        pdf_buffer = generator.generate_employee_request_form(
            employee=employees[0], absence=absences[0], settings=settings
        )
        output_path = (
            output_dir / f"employee_request_{employees[0].employee_id}_filled.pdf"
        )
        with open(output_path, "wb") as f:
            f.write(pdf_buffer.read())
        print(f"   ✓ Saved: {output_path}")
    except Exception as e:
        print(f"   ✗ Error: {e}")

    # Test 3: Employee Request Form (blank)
    print("\n3️⃣  Generating Employee Request Form (blank)...")
    try:
        pdf_buffer = generator.generate_employee_request_form(
            employee=employees[1], absence=None, settings=settings
        )
        output_path = (
            output_dir / f"employee_request_{employees[1].employee_id}_blank.pdf"
        )
        with open(output_path, "wb") as f:
            f.write(pdf_buffer.read())
        print(f"   ✓ Saved: {output_path}")
    except Exception as e:
        print(f"   ✗ Error: {e}")

    # Test 4: Overview Form
    print("\n4️⃣  Generating Overview Form...")
    try:
        pdf_buffer = generator.generate_overview_form(
            employees=employees, absences=absences, year=year, settings=settings
        )
        output_path = output_dir / f"overview_{year}.pdf"
        with open(output_path, "wb") as f:
            f.write(pdf_buffer.read())
        print(f"   ✓ Saved: {output_path}")
    except Exception as e:
        print(f"   ✗ Error: {e}")

    # Test 5: Yearly Calendar
    print("\n5️⃣  Generating Yearly Calendar...")
    try:
        pdf_buffer = generator.generate_yearly_calendar(
            year=year, employees=employees, absences=absences, settings=settings
        )
        output_path = output_dir / f"calendar_{year}.pdf"
        with open(output_path, "wb") as f:
            f.write(pdf_buffer.read())
        print(f"   ✓ Saved: {output_path}")
    except Exception as e:
        print(f"   ✗ Error: {e}")

    print(f"\n✅ PDF generation complete! Check {output_dir.absolute()}")
    print("\n💡 Tip: Open the PDFs to verify:")
    print(f"   - Admin form: vacation tracking and status")
    print(f"   - Employee request: signature fields and layout")
    print(f"   - Overview: comprehensive employee list")
    print(f"   - Calendar: visual month view with rotated text")


if __name__ == "__main__":
    main()
