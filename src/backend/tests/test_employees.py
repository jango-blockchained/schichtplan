import unittest
from app import create_app
from models import db, Employee, EmployeeGroup
import json

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