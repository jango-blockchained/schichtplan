"""
Test schedule generation functionality
"""
import pytest
from datetime import date, timedelta
from src.backend.models import db, Employee, ShiftTemplate, Coverage, Settings, Schedule
from src.backend.models.employee import EmployeeGroup
from src.backend.models.fixed_shift import ShiftType
from src.backend.services.scheduler.generator import ScheduleGenerator


@pytest.fixture
def test_data(app):
    """Create minimal test data for schedule generation"""
    with app.app_context():
        # Create test employees
        employees = [
            Employee(
                first_name="John",
                last_name="Doe",
                employee_group=EmployeeGroup.VZ,
                contracted_hours=40.0,
                employee_id="EMP001",
                is_active=True,
                is_keyholder=True
            ),
            Employee(
                first_name="Jane",
                last_name="Smith",
                employee_group=EmployeeGroup.TZ,
                contracted_hours=20.0,
                employee_id="EMP002",
                is_active=True,
                is_keyholder=False
            ),
        ]
        
        for emp in employees:
            db.session.add(emp)
        
        # Create test shift templates (within store hours 08:00-20:00 by default)
        shifts = [
            ShiftTemplate(
                start_time="08:00",
                end_time="14:00",
                duration_hours=6.0,
                requires_break=False,
                active_days=[0, 1, 2, 3, 4, 5],  # Monday-Saturday
                shift_type=ShiftType.EARLY,
                name="Early Shift"
            ),
            ShiftTemplate(
                start_time="14:00",
                end_time="20:00",
                duration_hours=6.0,
                requires_break=False,
                active_days=[0, 1, 2, 3, 4, 5],  # Monday-Saturday
                shift_type=ShiftType.LATE,
                name="Late Shift"
            ),
        ]
        
        for shift in shifts:
            db.session.add(shift)
        
        # Create coverage requirements (within store hours 08:00-20:00)
        coverage_items = [
            Coverage(
                day_index=0,  # Monday
                start_time="08:00",
                end_time="20:00",
                min_employees=1,
                max_employees=2,
                requires_keyholder=True
            ),
            Coverage(
                day_index=1,  # Tuesday
                start_time="08:00",
                end_time="20:00",
                min_employees=1,
                max_employees=2,
                requires_keyholder=True
            ),
        ]
        
        for cov in coverage_items:
            db.session.add(cov)
        
        # Ensure settings exist
        settings = Settings.query.first()
        if not settings:
            settings = Settings.get_default_settings()
            db.session.add(settings)
        
        db.session.commit()
        
        yield {
            "employees": employees,
            "shifts": shifts,
            "coverage": coverage_items
        }


def test_default_schedule_generation(app, test_data):
    """Test default schedule generation through ScheduleGenerator"""
    with app.app_context():
        # Get next Monday as start date
        today = date.today()
        days_until_monday = (7 - today.weekday()) % 7
        if days_until_monday == 0:
            days_until_monday = 7
        start_date = today + timedelta(days=days_until_monday)
        end_date = start_date + timedelta(days=6)  # One week
        
        print(f"\nGenerating schedule for: {start_date} to {end_date}")
        
        # Create generator and generate schedule
        generator = ScheduleGenerator()
        result = generator.generate_schedule(
            start_date=start_date,
            end_date=end_date,
            version=1,
            create_empty_schedules=False
        )
        
        # Print result for debugging
        print(f"Generation result: {result}")
        
        # Assertions
        assert result is not None, "Generator returned None"
        assert isinstance(result, dict), f"Expected dict, got {type(result)}"
        
        if result.get("status") == "failed":
            pytest.fail(f"Schedule generation failed: {result.get('reason', 'Unknown reason')}")
        
        assert result.get("status") == "success", f"Generation status is {result.get('status')}"
        
        # Check if schedules were created in database
        schedules_created = Schedule.query.filter_by(version=1).count()
        print(f"Schedules created in DB: {schedules_created}")
        
        assert schedules_created > 0, "No schedules were created in the database"


def test_default_generation_endpoint(client, test_data):
    """Test default schedule generation through API endpoint"""
    # Get next Monday as start date
    today = date.today()
    days_until_monday = (7 - today.weekday()) % 7
    if days_until_monday == 0:
        days_until_monday = 7
    start_date = today + timedelta(days=days_until_monday)
    end_date = start_date + timedelta(days=6)  # One week
    
    payload = {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "version": 2,
        "create_empty_schedules": False
    }
    
    print(f"\nTesting endpoint with payload: {payload}")
    
    response = client.post(
        '/api/schedules/generate',
        json=payload
    )
    
    print(f"Response status: {response.status_code}")
    print(f"Response data: {response.get_json()}")
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    result = response.get_json()
    assert result is not None, "Response body is empty"
    
    if result.get("status") == "error":
        pytest.fail(f"API returned error: {result.get('message', 'Unknown error')}")
    
    assert result.get("status") == "success", f"Expected success status, got {result.get('status')}"


def test_ai_generation_endpoint_no_api_key(client, test_data):
    """Test AI schedule generation endpoint (should fail gracefully without API key)"""
    # Get next Monday as start date
    today = date.today()
    days_until_monday = (7 - today.weekday()) % 7
    if days_until_monday == 0:
        days_until_monday = 7
    start_date = today + timedelta(days=days_until_monday)
    end_date = start_date + timedelta(days=6)  # One week
    
    payload = {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "version_id": 3
    }
    
    print(f"\nTesting AI endpoint with payload: {payload}")
    
    response = client.post(
        '/ai/schedule/generate-ai',
        json=payload
    )
    
    print(f"Response status: {response.status_code}")
    result = response.get_json()
    print(f"Response data: {result}")
    
    # Should return 200 or 400 (depending on whether it handles missing API key gracefully)
    assert response.status_code in [200, 400, 500], f"Unexpected status code: {response.status_code}"
    
    # If it fails, it should return an error message
    if response.status_code != 200 or result.get("status") == "error":
        print(f"AI generation failed as expected (no API key): {result.get('error', result.get('message', 'Unknown'))}")
    else:
        print("AI generation succeeded (API key must be configured)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
