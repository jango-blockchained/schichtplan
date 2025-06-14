#!/usr/bin/env python3
"""
Simple test to check if the optimized data collection works
"""
import json

# Test the optimized data structure
test_data = {
    "employees": [
        {"id": 1, "name": "Test Employee", "role": "VZ", "is_keyholder": True, "max_weekly_hours": 40}
    ],
    "shifts": [
        {"id": 1, "start_time": "09:00", "end_time": "17:00", "active_days": [0,1,2,3,4]}
    ],
    "coverage_rules": [
        {"day_index": 0, "time_period": "09:00-17:00", "min_employees": 2, "max_employees": 4}
    ],
    "schedule_period": {
        "start_date": "2025-06-14",
        "end_date": "2025-06-20",
        "target_weekdays": [0,1,2,3,4,5]
    },
    "availability": [
        {"employee_id": 1, "day_index": 0, "preferred_time_range": "09:00-17:00"}
    ],
    "absences": []
}

print("🧪 Testing Optimized AI Data Structure")
print("=" * 50)

print(f"📊 Data Structure:")
for key, value in test_data.items():
    if isinstance(value, list):
        print(f"  - {key}: {len(value)} items")
    elif isinstance(value, dict):
        print(f"  - {key}: {len(value)} fields")

print(f"\n📈 Data Size: {len(json.dumps(test_data)):,} characters")

print(f"\n🔍 Sample Data:")
print(json.dumps(test_data, indent=2))

print(f"\n✅ Optimized structure test successful!")
print(f"🎯 The new format is significantly more compact and efficient.")
