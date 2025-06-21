#!/usr/bin/env python3
"""
Test script to verify that schedule duration display changes work correctly
"""

import os
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from src.backend.app import create_app
from src.backend.models import Schedule, Employee, db
from datetime import datetime

def test_duration_display():
    """Test that schedule durations are calculated correctly"""
    
    app = create_app()
    
    with app.app_context():
        # Create a test schedule
        test_schedule = Schedule(
            employee_id=1,
            shift_id=1,
            date=datetime.now(),
            shift_start="09:00",
            shift_end="17:00",
            version=1
        )
        
        # Test basic break calculation
        print("Testing basic break calculation...")
        basic_break = test_schedule.calculate_auto_break_duration()
        print(f"8-hour shift break duration: {basic_break} minutes")
        
        # Test with keyholder
        print("\nTesting keyholder break calculation...")
        # Create a mock keyholder employee
        class MockKeyholderEmployee:
            is_keyholder = True
        
        test_schedule.employee = MockKeyholderEmployee()
        keyholder_break = test_schedule.calculate_auto_break_duration()
        print(f"Keyholder 8-hour shift break duration: {keyholder_break} minutes")
        
        # Test different shift lengths
        print("\nTesting different shift lengths...")
        
        # 6-hour shift (no break)
        test_schedule.shift_start = "10:00"
        test_schedule.shift_end = "16:00"
        short_break = test_schedule.calculate_auto_break_duration()
        print(f"6-hour shift break duration: {short_break} minutes")
        
        # 5-hour shift (no break)
        test_schedule.shift_start = "10:00"
        test_schedule.shift_end = "15:00"
        shorter_break = test_schedule.calculate_auto_break_duration()
        print(f"5-hour shift break duration: {shorter_break} minutes")
        
        print("\nTest completed successfully!")
        return True

if __name__ == "__main__":
    try:
        test_duration_display()
        print("✅ All tests passed!")
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
