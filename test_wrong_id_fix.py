#!/usr/bin/env python3
"""
Test script to verify the "wrong ID error" fix in AISchedulerService
"""

import sys
import os
from datetime import date
from unittest.mock import Mock

# Add the src directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

try:
    from backend.services.ai_scheduler_service import AISchedulerService
    print("✅ Successfully imported AISchedulerService")
except ImportError as e:
    print(f"❌ Import error: {e}")
    sys.exit(1)

def test_wrong_id_validation():
    """Test that the wrong ID validation works correctly"""
    print("\n🔍 Testing wrong ID validation...")
    
    # Create a mock logger
    mock_logger = Mock()
    
    # Create the service
    service = AISchedulerService()
    
    # Test CSV with invalid IDs
    csv_text = """EmployeeID,Date,ShiftTemplateID,ShiftName,StartTime,EndTime
0,2024-08-01,10,Morning,08:00,16:00
1,2024-08-01,0,Morning,08:00,16:00
2,2024-08-01,5,Valid,09:00,17:00"""
    
    start_date = date(2024, 8, 1)
    end_date = date(2024, 8, 7)
    
    try:
        # Parse the CSV - this should filter out invalid ID entries
        assignments = service._parse_csv_response(csv_text, start_date, end_date)
        
        print(f"✅ Parsed {len(assignments)} valid assignments")
        print("   Expected: 1 valid assignment (only the third row)")
        
        if len(assignments) == 1:
            assignment = assignments[0]
            print(f"   Valid assignment: Employee {assignment['employee_id']}, Shift {assignment['shift_template_id']}")
            print("✅ ID validation working correctly - invalid IDs were filtered out")
        else:
            print(f"❌ Expected 1 assignment, got {len(assignments)}")
            for i, assignment in enumerate(assignments):
                print(f"   Assignment {i+1}: Employee {assignment['employee_id']}, Shift {assignment['shift_template_id']}")
        
        return len(assignments) == 1
        
    except Exception as e:
        print(f"❌ Error during parsing: {e}")
        return False

def main():
    """Main test function"""
    print("🧪 Testing 'Wrong ID Error' Fix")
    print("=" * 50)
    
    success = test_wrong_id_validation()
    
    print("\n" + "=" * 50)
    if success:
        print("✅ All tests passed! The wrong ID error fix is working correctly.")
        print("\n📋 Summary:")
        print("   - Invalid EmployeeID (<=0) are properly filtered out")
        print("   - Invalid ShiftTemplateID (<=0) are properly filtered out")
        print("   - Valid entries are still processed correctly")
    else:
        print("❌ Tests failed! The wrong ID error fix needs more work.")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
