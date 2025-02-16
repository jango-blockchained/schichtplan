import pytest
from models import Employee, EmployeeGroup

def test_employee_creation(session):
    """Test employee creation"""
    employee = Employee(
        first_name="Test",
        last_name="User",
        employee_group=EmployeeGroup.VL,
        contracted_hours=40
    )
    
    session.add(employee)
    session.commit()
    
    assert employee.id is not None
    assert employee.employee_id == "TUS"
    assert employee.first_name == "Test"
    assert employee.last_name == "User"
    assert employee.employee_group == EmployeeGroup.VL
    assert employee.contracted_hours == 40
    assert not employee.is_keyholder

def test_employee_hours_validation(session):
    """Test employee hours validation"""
    # Test VL employee
    vl_employee = Employee(
        first_name="VL",
        last_name="Employee",
        employee_group=EmployeeGroup.VL,
        contracted_hours=40
    )
    assert vl_employee.validate_hours()
    
    vl_employee.contracted_hours = 30
    assert not vl_employee.validate_hours()
    
    # Test TZ employee
    tz_employee = Employee(
        first_name="TZ",
        last_name="Employee",
        employee_group=EmployeeGroup.TZ,
        contracted_hours=20
    )
    assert tz_employee.validate_hours()
    
    tz_employee.contracted_hours = 25
    assert not tz_employee.validate_hours()
    
    # Test GfB employee
    gfb_employee = Employee(
        first_name="GfB",
        last_name="Employee",
        employee_group=EmployeeGroup.GFB,
        contracted_hours=40
    )
    assert gfb_employee.validate_hours()
    
    gfb_employee.contracted_hours = 45
    assert not gfb_employee.validate_hours()

def test_employee_id_generation(session):
    """Test employee ID generation"""
    # Test normal case
    employee1 = Employee(
        first_name="John",
        last_name="Doe",
        employee_group=EmployeeGroup.VL,
        contracted_hours=40
    )
    assert employee1.employee_id == "JDO"
    
    # Test short names
    employee2 = Employee(
        first_name="A",
        last_name="B",
        employee_group=EmployeeGroup.VL,
        contracted_hours=40
    )
    assert len(employee2.employee_id) == 3
    
    # Test long names
    employee3 = Employee(
        first_name="Christopher",
        last_name="Anderson",
        employee_group=EmployeeGroup.VL,
        contracted_hours=40
    )
    assert len(employee3.employee_id) == 3
    assert employee3.employee_id == "CAN"

def test_employee_keyholder(session):
    """Test employee keyholder functionality"""
    employee = Employee(
        first_name="Key",
        last_name="Holder",
        employee_group=EmployeeGroup.TL,
        contracted_hours=40,
        is_keyholder=True
    )
    
    assert employee.is_keyholder
    
    employee.is_keyholder = False
    assert not employee.is_keyholder 