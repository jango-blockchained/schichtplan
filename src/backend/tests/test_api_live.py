import requests
import json
from pprint import pprint

def test_employees_endpoint():
    """Test the live employees endpoint"""
    base_url = 'http://localhost:5000'
    
    print("\n1. Testing GET /api/employees")
    print("-" * 50)
    try:
        # Test GET /api/employees
        response = requests.get(
            f'{base_url}/api/employees',
            headers={'Accept': 'application/json'},
            cookies={},  # Add any cookies if needed
        )
        
        print(f"Status Code: {response.status_code}")
        print("\nResponse Headers:")
        for header, value in response.headers.items():
            print(f"{header}: {value}")
            
        print("\nCORS Headers Present:")
        cors_headers = [
            'Access-Control-Allow-Origin',
            'Access-Control-Allow-Credentials',
            'Access-Control-Allow-Methods',
            'Access-Control-Allow-Headers'
        ]
        for header in cors_headers:
            print(f"{header}: {'✓' if header in response.headers else '✗'}")
        
        print("\nResponse Data:")
        try:
            data = response.json()
            pprint(data)
        except json.JSONDecodeError:
            print("Could not parse JSON response")
            print("Raw response:", response.text)
            
    except requests.RequestException as e:
        print(f"Request failed: {str(e)}")
        
    print("\n2. Testing OPTIONS /api/employees (CORS preflight)")
    print("-" * 50)
    try:
        # Test OPTIONS /api/employees (CORS preflight)
        response = requests.options(
            f'{base_url}/api/employees',
            headers={
                'Origin': 'http://localhost:5173',
                'Access-Control-Request-Method': 'GET',
                'Access-Control-Request-Headers': 'Content-Type'
            }
        )
        
        print(f"Status Code: {response.status_code}")
        print("\nResponse Headers:")
        for header, value in response.headers.items():
            print(f"{header}: {value}")
            
    except requests.RequestException as e:
        print(f"Preflight request failed: {str(e)}")

if __name__ == '__main__':
    test_employees_endpoint() 