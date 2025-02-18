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
    
    vl_employee.contracted_hours = 48  # Maximum allowed
    assert vl_employee.validate_hours()
    
    vl_employee.contracted_hours = 30  # Below minimum
    assert not vl_employee.validate_hours()
    
    vl_employee.contracted_hours = 50  # Above maximum
    assert not vl_employee.validate_hours()
    
    # Test TZ employee
    tz_employee = Employee(
        first_name="TZ",
        last_name="Employee",
        employee_group=EmployeeGroup.TZ,
        contracted_hours=20
    )
    assert tz_employee.validate_hours()
    
    tz_employee.contracted_hours = 35  # Maximum allowed
    assert tz_employee.validate_hours()
    
    tz_employee.contracted_hours = 8  # Below minimum
    assert not tz_employee.validate_hours()
    
    tz_employee.contracted_hours = 36  # Above maximum
    assert not tz_employee.validate_hours()
    
    # Test GfB employee
    max_weekly_hours = (556 / 12.41) / 4.33  # Maximum weekly hours for mini-job
    gfb_employee = Employee(
        first_name="GfB",
        last_name="Employee",
        employee_group=EmployeeGroup.GFB,
        contracted_hours=max_weekly_hours
    )
    assert gfb_employee.validate_hours()
    
    gfb_employee.contracted_hours = max_weekly_hours + 1  # Above maximum
    assert not gfb_employee.validate_hours()
    
    # Test TL employee (same rules as VL)
    tl_employee = Employee(
        first_name="TL",
        last_name="Employee",
        employee_group=EmployeeGroup.TL,
        contracted_hours=40
    )
    assert tl_employee.validate_hours()
    
    tl_employee.contracted_hours = 48  # Maximum allowed
    assert tl_employee.validate_hours()
    
    tl_employee.contracted_hours = 30  # Below minimum
    assert not tl_employee.validate_hours()
    
    tl_employee.contracted_hours = 50  # Above maximum
    assert not tl_employee.validate_hours()

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

def test_employee_weekly_hours(session):
    """Test weekly hour limits for different employee groups"""
    # Test VL employee
    vl_employee = Employee(
        first_name="VL",
        last_name="Employee",
        employee_group=EmployeeGroup.VL,
        contracted_hours=40
    )
    assert vl_employee.get_max_weekly_hours() == 48.0
    
    # Test TL employee
    tl_employee = Employee(
        first_name="TL",
        last_name="Employee",
        employee_group=EmployeeGroup.TL,
        contracted_hours=40
    )
    assert tl_employee.get_max_weekly_hours() == 48.0
    
    # Test TZ employee
    tz_employee = Employee(
        first_name="TZ",
        last_name="Employee",
        employee_group=EmployeeGroup.TZ,
        contracted_hours=20
    )
    assert tz_employee.get_max_weekly_hours() == 20.0
    
    # Test GfB employee
    gfb_employee = Employee(
        first_name="GfB",
        last_name="Employee",
        employee_group=EmployeeGroup.GFB,
        contracted_hours=40
    )
    # GfB weekly hours should be monthly limit divided by 4.33
    expected_weekly = (556 / 12.41) / 4.33
    assert abs(gfb_employee.get_max_weekly_hours() - expected_weekly) < 0.01 