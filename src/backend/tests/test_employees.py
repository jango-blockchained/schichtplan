import unittest
from app import create_app
from models import db, Employee, EmployeeGroup, Absence
import json
from datetime import datetime
from http import HTTPStatus

class TestEmployeeAPI(unittest.TestCase):
    def setUp(self):
        """Set up test environment before each test"""
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'  # Use in-memory SQLite for testing
        self.client = self.app.test_client()
        
        # Create application context
        self.app_context = self.app.app_context()
        self.app_context.push()
        
        # Create database tables
        db.create_all()
        
        # Add test data
        test_employee = Employee(
            first_name="Test",
            last_name="User",
            employee_group=EmployeeGroup.VZ,
            contracted_hours=40.0,
            is_keyholder=True
        )
        db.session.add(test_employee)
        db.session.commit()

    def tearDown(self):
        """Clean up after each test"""
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_database_connection(self):
        """Test database connection and basic operations"""
        try:
            # Try to query the database
            employees = Employee.query.all()
            self.assertIsNotNone(employees)
            print("✓ Database connection successful")
            print(f"✓ Found {len(employees)} employees in test database")
        except Exception as e:
            print(f"✗ Database connection failed: {str(e)}")
            raise

    def test_employee_model(self):
        """Test Employee model functionality"""
        try:
            # Test creating a new employee
            employee = Employee(
                first_name="John",
                last_name="Doe",
                employee_group=EmployeeGroup.TZ,
                contracted_hours=20.0
            )
            self.assertEqual(employee.employee_id, "JDO")
            print("✓ Employee model creation successful")
            
            # Test to_dict method
            employee_dict = employee.to_dict()
            self.assertIsInstance(employee_dict, dict)
            self.assertEqual(employee_dict['first_name'], "John")
            print("✓ Employee to_dict method working")
        except Exception as e:
            print(f"✗ Employee model test failed: {str(e)}")
            raise

    def test_get_employees_endpoint(self):
        """Test GET /api/employees endpoint"""
        try:
            # Make request to endpoint
            response = self.client.get('/api/employees')
            
            # Print response details for debugging
            print(f"Response Status: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}")
            print(f"Response Data: {response.data.decode()}")
            
            # Check response
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertIsInstance(data, list)
            self.assertTrue(len(data) > 0)
            print("✓ GET /api/employees endpoint working")
            
            # Verify CORS headers
            self.assertIn('Access-Control-Allow-Origin', response.headers)
            self.assertIn('Access-Control-Allow-Credentials', response.headers)
            print("✓ CORS headers present in response")
        except Exception as e:
            print(f"✗ GET /api/employees endpoint test failed: {str(e)}")
            raise

    def test_create_employee_endpoint(self):
        """Test POST /api/employees endpoint"""
        try:
            # Test data
            employee_data = {
                'first_name': 'Jane',
                'last_name': 'Smith',
                'employee_group': 'TZ',
                'contracted_hours': 30.0,
                'is_keyholder': False
            }
            
            # Make request
            response = self.client.post(
                '/api/employees',
                data=json.dumps(employee_data),
                content_type='application/json'
            )
            
            # Check response
            self.assertEqual(response.status_code, 201)
            data = json.loads(response.data)
            self.assertEqual(data['first_name'], 'Jane')
            print("✓ POST /api/employees endpoint working")
        except Exception as e:
            print(f"✗ POST /api/employees endpoint test failed: {str(e)}")
            raise

    def test_create_employee_invalid_input(self):
        """Test POST /api/employees with invalid input"""
        try:
            # Test data with missing required field (last_name)
            invalid_employee_data = {
                'first_name': 'Invalid',
                'employee_group': 'TZ',
                'contracted_hours': 30.0,
                'is_keyholder': False
            }
            
            # Make request
            response = self.client.post(
                '/api/employees',
                data=json.dumps(invalid_employee_data),
                content_type='application/json'
            )
            
            # Check response status code
            self.assertEqual(response.status_code, 400)
            
            # Check response body for validation error details
            data = json.loads(response.data)
            self.assertEqual(data['status'], 'error')
            self.assertEqual(data['message'], 'Invalid input.')
            self.assertIn('details', data)
            self.assertIsInstance(data['details'], list)
            self.assertTrue(len(data['details']) > 0)
            
            # Check for specific error detail (optional, but good practice)
            found_error = any(err.get('loc') == ('last_name', ) for err in data['details'])
            self.assertTrue(found_error, "Did not find validation error for missing last_name")
            
            print("✓ POST /api/employees endpoint handles invalid input")
        except Exception as e:
            print(f"✗ POST /api/employees endpoint invalid input test failed: {str(e)}")
            raise

    def test_update_employee_invalid_input(self):
        """Test PUT /api/employees/<id> with invalid input"""
        try:
            # Get an existing employee ID
            employee = Employee.query.filter_by(first_name="Test").first()
            self.assertIsNotNone(employee, "Test employee not found")
            employee_id = employee.id

            # Test data with invalid field type (contracted_hours should be float)
            invalid_update_data = {
                'contracted_hours': 'forty'
            }
            
            # Make request
            response = self.client.put(
                f'/api/employees/{employee_id}',
                data=json.dumps(invalid_update_data),
                content_type='application/json'
            )
            
            # Check response status code
            self.assertEqual(response.status_code, 400)
            
            # Check response body for validation error details
            data = json.loads(response.data)
            self.assertEqual(data['status'], 'error')
            self.assertEqual(data['message'], 'Invalid input.')
            self.assertIn('details', data)
            self.assertIsInstance(data['details'], list)
            self.assertTrue(len(data['details']) > 0)
            
            # Check for specific error detail (optional, but good practice)
            found_error = any(err.get('loc') == ('contracted_hours', ) for err in data['details'])
            self.assertTrue(found_error, "Did not find validation error for invalid contracted_hours")
            
            print("✓ PUT /api/employees/<id> endpoint handles invalid input")
        except Exception as e:
            print(f"✗ PUT /api/employees/<id> endpoint invalid input test failed: {str(e)}")
            raise

if __name__ == '__main__':
    unittest.main()

# Add tests for absence endpoints with Pydantic validation
class TestAbsenceAPI(unittest.TestCase):
    def setUp(self):
        """Set up test environment before each test"""
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'  # Use in-memory SQLite for testing
        self.client = self.app.test_client()
        
        # Create application context
        self.app_context = self.app.app_context()
        self.app_context.push()
        
        # Create database tables
        db.create_all()
        
        # Add a test employee
        self.test_employee = Employee(
            first_name="Absence",
            last_name="Tester",
            employee_group=EmployeeGroup.VZ,
            contracted_hours=40.0,
            is_keyholder=True
        )
        db.session.add(self.test_employee)
        db.session.commit()
        self.assertIsNotNone(self.test_employee, "Failed to create test employee in setUp") # Ensure employee is created
        
        # Add a test absence for update tests
        self.test_absence = Absence(
            employee_id=self.test_employee.id,
            start_date=datetime(2024, 12, 1).date(),
            end_date=datetime(2024, 12, 5).date(),
            absence_type_id="VAC",
            note="Vacation"
        )
        db.session.add(self.test_absence)
        db.session.commit()
        self.assertIsNotNone(self.test_absence, "Failed to create test absence in setUp") # Ensure absence is created

    def tearDown(self):
        """Clean up after each test"""
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_create_absence_valid(self):
        """Test POST /api/employees/<id>/absences endpoint with valid data."""
        absence_data = {
            'employee_id': self.test_employee.id,
            'start_date': '2024-11-10',
            'end_date': '2024-11-15',
            'absence_type_id': 'SICK',
            'note': 'Feeling under the weather'
        }
        response = self.client.post(
            f'/api/employees/{self.test_employee.id}/absences',
            data=json.dumps(absence_data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, HTTPStatus.CREATED)
        data = json.loads(response.data)
        # Assuming the response returns the created absence data, verify fields
        self.assertEqual(data['employee_id'], self.test_employee.id)
        self.assertEqual(data['start_date'], '2024-11-10')
        self.assertEqual(data['end_date'], '2024-11-15')
        self.assertEqual(data['absence_type_id'], 'SICK')
        self.assertEqual(data['note'], 'Feeling under the weather')

        # Optional: Verify in database
        created_absence = Absence.query.filter_by(employee_id=self.test_employee.id,
                                                 start_date=datetime(2024, 11, 10).date()).first()
        self.assertIsNotNone(created_absence)
        self.assertEqual(created_absence.absence_type_id, "SICK")

    def test_create_absence_invalid_data(self):
        """Test POST /api/employees/<id>/absences with invalid data."""
        invalid_absence_data = {
            'employee_id': self.test_employee.id,
            'start_date': 'not-a-date',
            'end_date': '2024-11-15',
            'absence_type_id': 'SICK'
            # missing note
        }
        response = self.client.post(
            f'/api/employees/{self.test_employee.id}/absences',
            data=json.dumps(invalid_absence_data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'error')
        self.assertEqual(data['message'], 'Invalid input.')
        self.assertIn('details', data)
        self.assertTrue(len(data['details']) > 0)
        # Check for specific error details (optional, but good practice)
        error_fields = [err.get('loc')[0] for err in data['details'] if err.get('loc')]
        self.assertIn('start_date', error_fields)
        self.assertIn('note', error_fields)

    def test_update_absence_valid(self):
        """Test PUT /api/employees/<id>/absences/<absence_id> with valid data."""
        update_data = {
            'end_date': '2024-12-06',
            'note': 'Extended vacation'
        }
        response = self.client.put(
            f'/api/employees/{self.test_employee.id}/absences/{self.test_absence.id}',
            data=json.dumps(update_data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, HTTPStatus.OK)
        data = json.loads(response.data)
        self.assertEqual(data['end_date'], '2024-12-06')
        self.assertEqual(data['note'], 'Extended vacation')

    def test_update_absence_invalid_data(self):
        """Test PUT /api/employees/<id>/absences/<absence_id> with invalid data."""
        invalid_update_data = {
            'start_date': 'another-bad-date'
        }
        response = self.client.put(
            f'/api/employees/{self.test_employee.id}/absences/{self.test_absence.id}',
            data=json.dumps(invalid_update_data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'error')
        self.assertEqual(data['message'], 'Invalid input.')
        self.assertIn('details', data)
        self.assertTrue(len(data['details']) > 0) 