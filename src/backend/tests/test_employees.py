import pytest
import json
from http import HTTPStatus
from src.backend.app import create_app
from src.backend.models import db, Employee, EmployeeGroup, Absence
from datetime import datetime


class TestEmployeeAPI:
    def test_database_connection(self, app, session):
        """Test database connection and basic operations"""
        try:
            # Use the session fixture
            employees = session.query(Employee).all()
            assert employees is not None
            print("✓ Database connection successful")
            print(f"✓ Found {len(employees)} employees in test database")
        except Exception as e:
            print(f"✗ Database connection failed: {str(e)}")
            raise

    def test_employee_model(self, app, session):
        """Test Employee model functionality"""
        try:
            # Test creating a new employee
            employee = Employee(
                first_name="John",
                last_name="Doe",
                employee_group=EmployeeGroup.TZ,
                contracted_hours=20.0,
            )
            # No need to add/commit for model unit test, unless testing DB interaction
            assert (
                str(employee.employee_id) == "JDO"
            )  # Ensure comparison is with string value
            print("✓ Employee model creation successful")

            # Test to_dict method
            employee_dict = employee.to_dict()
            assert isinstance(employee_dict, dict)
            assert employee_dict["first_name"] == "John"
            print("✓ Employee to_dict method working")
        except Exception as e:
            print(f"✗ Employee model test failed: {str(e)}")
            raise

    def test_get_employees_endpoint(self, app, session):
        """Test GET /api/employees endpoint"""
        # Use app.test_client() for making requests
        client = app.test_client()

        # Add test data using the session fixture
        test_employee = Employee(
            first_name="Test",
            last_name="User",
            employee_group=EmployeeGroup.VZ,
            contracted_hours=40.0,
            is_keyholder=True,
        )
        session.add(test_employee)
        session.commit()

        try:
            # Make request to endpoint
            response = client.get("/api/employees")

            # Print response details for debugging
            print(f"Response Status: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}")
            print(f"Response Data: {response.data.decode()}")

            # Check response
            assert response.status_code == 200
            data = json.loads(response.data)
            assert isinstance(data, list)
            assert len(data) > 0
            print("✓ GET /api/employees endpoint working")

            # Verify CORS headers
            assert "Access-Control-Allow-Origin" in response.headers
            assert "Access-Control-Allow-Credentials" in response.headers
            print("✓ CORS headers present in response")
        except Exception as e:
            print(f"✗ GET /api/employees endpoint test failed: {str(e)}")
            raise

    def test_create_employee_endpoint(self, app, session):
        """Test POST /api/employees endpoint"""
        client = app.test_client()

        try:
            # Test data
            employee_data = {
                "first_name": "Jane",
                "last_name": "Smith",
                "employee_group": "TZ",
                "contracted_hours": 30.0,
                "is_keyholder": False,
            }

            # Make request
            response = client.post(
                "/api/employees",
                data=json.dumps(employee_data),
                content_type="application/json",
            )

            # Check response
            assert response.status_code == 201
            data = json.loads(response.data)
            assert data["first_name"] == "Jane"
            print("✓ POST /api/employees endpoint working")

            # Optional: Verify employee was added to DB
            new_employee = session.query(Employee).filter_by(first_name="Jane").first()
            assert new_employee is not None
            assert new_employee.last_name == "Smith"

        except Exception as e:
            print(f"✗ POST /api/employees endpoint test failed: {str(e)}")
            raise

    def test_create_employee_invalid_input(self, app, session):
        """Test POST /api/employees with invalid input"""
        client = app.test_client()

        try:
            # Test data with missing required field (last_name)
            invalid_employee_data = {
                "first_name": "Invalid",
                "employee_group": "TZ",
                "contracted_hours": 30.0,
                "is_keyholder": False,
            }

            # Make request
            response = client.post(
                "/api/employees",
                data=json.dumps(invalid_employee_data),
                content_type="application/json",
            )

            # Check response status code
            assert response.status_code == 400

            # Check response body for validation error details
            data = json.loads(response.data)
            assert data["status"] == "error"
            assert data["message"] == "Invalid input."
            assert "details" in data
            assert isinstance(data["details"], list)
            assert len(data["details"]) > 0

            # Check for specific error detail (optional, but good practice)
            found_error = any(
                err.get("loc") == ("last_name",) for err in data["details"]
            )
            assert found_error is True  # Changed to assert True

            print("✓ POST /api/employees endpoint handles invalid input")
        except Exception as e:
            print(f"✗ POST /api/employees endpoint invalid input test failed: {str(e)}")
            raise

    def test_update_employee_invalid_input(self, app, session):
        """Test PUT /api/employees/<id> with invalid input"""
        client = app.test_client()

        # Add test data using the session fixture to ensure an employee exists
        test_employee = Employee(
            first_name="UpdateTest",
            last_name="User",
            employee_group=EmployeeGroup.VZ,
            contracted_hours=40.0,
            is_keyholder=True,
        )
        session.add(test_employee)
        session.commit()
        session.refresh(test_employee)  # Refresh to get the ID
        employee_id = test_employee.id

        assert employee_id is not None, "Test employee not found"

        try:
            # Test data with invalid field type (contracted_hours should be float)
            invalid_update_data = {"contracted_hours": "forty"}

            # Make request
            response = client.put(
                f"/api/employees/{employee_id}",
                data=json.dumps(invalid_update_data),
                content_type="application/json",
            )

            # Check response status code
            assert response.status_code == 400

            # Check response body for validation error details
            data = json.loads(response.data)
            assert data["status"] == "error"
            assert data["message"] == "Invalid input."
            assert "details" in data
            assert isinstance(data["details"], list)
            assert len(data["details"]) > 0

            # Check for specific error detail (optional, but good practice)
            found_error = any(
                err.get("loc") == ("contracted_hours",) for err in data["details"]
            )
            assert found_error is True  # Changed to assert True

            print("✓ PUT /api/employees/<id> endpoint handles invalid input")
        except Exception as e:
            print(
                f"✗ PUT /api/employees/<id> endpoint invalid input test failed: {str(e)}"
            )
            raise


# Add tests for absence endpoints with Pydantic validation
class TestAbsenceAPI:
    def test_create_absence_valid(self, app, session):
        """Test POST /api/absences endpoint with valid data"""
        client = app.test_client()

        # Add a test employee using the session fixture
        test_employee = Employee(
            first_name="Absence",
            last_name="Tester",
            employee_group=EmployeeGroup.VZ,
            contracted_hours=40.0,
            is_keyholder=True,
        )
        session.add(test_employee)
        session.commit()
        session.refresh(test_employee)  # Refresh to get the ID
        employee_id = test_employee.id

        assert employee_id is not None, "Test employee not found"

        try:
            # Test data
            absence_data = {
                "employee_id": employee_id,
                "start_date": "2024-12-10",
                "end_date": "2024-12-15",
                "absence_type_id": "VAC",
                "note": "Holiday",
            }

            # Make request
            response = client.post(
                "/api/absences",
                data=json.dumps(absence_data),
                content_type="application/json",
            )

            # Check response
            assert response.status_code == 201
            data = json.loads(response.data)
            assert data["employee_id"] == employee_id
            print("✓ POST /api/absences endpoint with valid data working")

            # Optional: Verify absence was added to DB
            new_absence = (
                session.query(Absence)
                .filter_by(
                    employee_id=employee_id, start_date=datetime(2024, 12, 10).date()
                )
                .first()
            )
            assert new_absence is not None

        except Exception as e:
            print(f"✗ POST /api/absences endpoint valid data test failed: {str(e)}")
            raise

    def test_create_absence_invalid_data(self, app, session):
        """Test POST /api/absences endpoint with invalid data"""
        client = app.test_client()

        # Add a test employee using the session fixture
        test_employee = Employee(
            first_name="Absence",
            last_name="Tester",
            employee_group=EmployeeGroup.VZ,
            contracted_hours=40.0,
            is_keyholder=True,
        )
        session.add(test_employee)
        session.commit()
        session.refresh(test_employee)  # Refresh to get the ID
        employee_id = test_employee.id

        assert employee_id is not None, "Test employee not found"

        try:
            # Test data with invalid date format
            invalid_absence_data = {
                "employee_id": employee_id,
                "start_date": "12-10-2024",
                "end_date": "12-15-2024",
                "absence_type_id": "VAC",
                "note": "Holiday",
            }

            # Make request
            response = client.post(
                "/api/absences",
                data=json.dumps(invalid_absence_data),
                content_type="application/json",
            )

            # Check response status code
            assert response.status_code == 400

            # Check response body for validation error details
            data = json.loads(response.data)
            assert data["status"] == "error"
            assert data["message"] == "Invalid input."
            assert "details" in data
            assert isinstance(data["details"], list)
            assert len(data["details"]) > 0

            # Check for specific error detail (optional, but good practice)
            found_error = any(
                err.get("loc") == ("start_date",) for err in data["details"]
            )
            assert found_error is True  # Changed to assert True

            print("✓ POST /api/absences endpoint handles invalid data")
        except Exception as e:
            print(f"✗ POST /api/absences endpoint invalid data test failed: {str(e)}")
            raise

    def test_update_absence_valid(self, app, session):
        """Test PUT /api/absences/<id> endpoint with valid data"""
        client = app.test_client()

        # Add a test employee and absence using the session fixture
        test_employee = Employee(
            first_name="UpdateAbsence",
            last_name="Tester",
            employee_group=EmployeeGroup.VZ,
            contracted_hours=40.0,
            is_keyholder=True,
        )
        session.add(test_employee)
        session.commit()
        session.refresh(test_employee)
        employee_id = test_employee.id

        test_absence_data = {
            "employee_id": employee_id,
            "start_date": datetime(2024, 12, 1).date(),
            "end_date": datetime(2024, 12, 5).date(),
            "absence_type_id": "VAC",
            "note": "Vacation",
        }
        test_absence = Absence.from_dict(test_absence_data)
        session.add(test_absence)
        session.commit()
        session.refresh(test_absence)  # Refresh to get the ID
        absence_id = test_absence.id

        assert absence_id is not None, "Test absence not found"

        try:
            # Test data for update
            update_data = {"end_date": "2024-12-06", "note": "Extended Holiday"}

            # Make request
            response = client.put(
                f"/api/absences/{absence_id}",
                data=json.dumps(update_data),
                content_type="application/json",
            )

            # Check response
            assert response.status_code == 200
            data = json.loads(response.data)
            assert data["id"] == absence_id
            assert data["end_date"] == "2024-12-06"
            assert data["note"] == "Extended Holiday"
            print("✓ PUT /api/absences/<id> endpoint with valid data working")

            # Optional: Verify absence was updated in DB
            updated_absence = session.query(Absence).get(absence_id)
            assert updated_absence is not None
            assert updated_absence.end_date == datetime(2024, 12, 6).date()
            assert updated_absence.note == "Extended Holiday"

        except Exception as e:
            print(f"✗ PUT /api/absences/<id> endpoint valid data test failed: {str(e)}")
            raise

    def test_update_absence_invalid_data(self, app, session):
        """Test PUT /api/absences/<id> endpoint with invalid data"""
        client = app.test_client()

        # Add a test employee and absence using the session fixture
        test_employee = Employee(
            first_name="UpdateAbsence",
            last_name="Tester",
            employee_group=EmployeeGroup.VZ,
            contracted_hours=40.0,
            is_keyholder=True,
        )
        session.add(test_employee)
        session.commit()
        session.refresh(test_employee)
        employee_id = test_employee.id

        test_absence_data = {
            "employee_id": employee_id,
            "start_date": datetime(2024, 12, 1).date(),
            "end_date": datetime(2024, 12, 5).date(),
            "absence_type_id": "VAC",
            "note": "Vacation",
        }
        test_absence = Absence.from_dict(test_absence_data)
        session.add(test_absence)
        session.commit()
        session.refresh(test_absence)  # Refresh to get the ID
        absence_id = test_absence.id

        assert absence_id is not None, "Test absence not found"

        try:
            # Test data with invalid date format
            invalid_update_data = {"end_date": "06-12-2024"}

            # Make request
            response = client.put(
                f"/api/absences/{absence_id}",
                data=json.dumps(invalid_update_data),
                content_type="application/json",
            )

            # Check response status code
            assert response.status_code == 400

            # Check response body for validation error details
            data = json.loads(response.data)
            assert data["status"] == "error"
            assert data["message"] == "Invalid input."
            assert "details" in data
            assert isinstance(data["details"], list)
            assert len(data["details"]) > 0

            # Check for specific error detail (optional, but good practice)
            found_error = any(
                err.get("loc") == ("end_date",) for err in data["details"]
            )
            assert found_error is True  # Changed to assert True

            print("✓ PUT /api/absences/<id> endpoint handles invalid data")
        except Exception as e:
            print(
                f"✗ PUT /api/absences/<id> endpoint invalid data test failed: {str(e)}"
            )
            raise
