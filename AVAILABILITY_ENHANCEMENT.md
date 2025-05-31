# Enhanced Employee Availability Generation

## Overview

This document describes the improvements made to the demo data generation for employee availability distribution in the Schichtplan project. The enhancements create more realistic availability patterns that respect contracted hours and reflect real-world employee scheduling scenarios.

## Problems with Previous Implementation

The original `generate_improved_availability_data` function had several issues:

1. **Fixed availability exceeded contracted hours**: High-hour employees (>35h) received 1.5x their contracted hours as FIXED availability, which is unrealistic and violates business logic
2. **Unrealistic availability distribution**: All employees received the same multiplier (1.5x) regardless of their work patterns
3. **Poor availability type distribution**: Only high-hour employees received FIXED availability, others only received AVAILABLE
4. **No consideration for real-world patterns**: Part-time workers should have more varied availability patterns

## Enhanced Implementation

### Key Improvements

#### 1. Respects Contracted Hours for Fixed Availability
- **Full-time employees (≥35h)**: FIXED hours never exceed contracted hours
- **Part-time employees (15-34h)**: FIXED hours are 70% of contracted hours (max)
- **Low-hour employees (<15h)**: FIXED hours are 50% of contracted hours (max)

#### 2. Realistic Availability Type Distribution
- **Full-time**: Mostly FIXED with some PREFERRED (up to 30% extra)
- **Part-time**: Mix of FIXED (70%), PREFERRED (30%), and AVAILABLE (50% extra)
- **Low-hour**: Minimal FIXED, some PREFERRED, lots of AVAILABLE (150% extra for flexibility)

#### 3. Employee-Type-Specific Patterns
- **Full-time (VZ, TL)**: Work 5-6 days, consistent schedules, start times 8-10 AM
- **Part-time (TZ)**: Work 3-5 days, flexible schedules, start times 9-14 PM
- **Low-hour (GFB)**: Work 2-4 days, very flexible, start times 10-16 PM

#### 4. Validation and Transparency
- Added `validate_and_log_availability_distribution()` function
- Comprehensive logging of availability statistics by employee type
- Automatic detection of violations (FIXED > contracted hours)
- Clear reporting of distribution ratios

### Test Results

The enhanced implementation was tested with 12 employees across different types:

```
VZ employees (3 total):
  Average contracted hours: 37.7
  Average FIXED hours: 37.7
  Average PREFERRED hours: 9.0
  Fixed/Contracted ratio: 100.0%
  ✅ All employees have FIXED hours within contracted limits

TZ employees (4 total):
  Average contracted hours: 22.5
  Average FIXED hours: 14.0
  Average PREFERRED hours: 4.2
  Average AVAILABLE hours: 13.5
  Fixed/Contracted ratio: 62.2%
  ✅ All employees have FIXED hours within contracted limits

GFB employees (4 total):
  Average contracted hours: 8.8
  Average FIXED hours: 2.5
  Average PREFERRED hours: 2.0
  Average AVAILABLE hours: 13.8
  Fixed/Contracted ratio: 28.6%
  ✅ All employees have FIXED hours within contracted limits
```

### Overall Distribution
- **FIXED**: 56.2% (core working hours)
- **PREFERRED**: 15.9% (flexible preferred hours)
- **AVAILABLE**: 27.9% (maximum flexibility)

## Implementation Details

### Function Changes

1. **`generate_improved_availability_data(employees)`**: Completely rewritten with realistic logic
2. **`validate_and_log_availability_distribution(employees, availabilities)`**: New validation function
3. **Demo data routes**: Updated to include validation logging

### Key Logic

```python
# Full-time employees
if contracted_hours >= 35:
    fixed_hours = min(contracted_hours, 40)  # Never exceed contracted
    preferred_hours = max(0, min(10, contracted_hours * 0.3))  # Up to 30% extra

# Part-time employees  
elif contracted_hours >= 15:
    fixed_hours = min(contracted_hours * 0.7, contracted_hours)  # 70% max
    preferred_hours = contracted_hours * 0.3  # 30% as preferred
    available_hours = contracted_hours * 0.5  # 50% extra as available

# Low-hour employees
else:
    fixed_hours = min(contracted_hours * 0.5, contracted_hours)  # 50% max
    preferred_hours = contracted_hours * 0.3  # 30% as preferred
    available_hours = contracted_hours * 1.5  # 150% extra (very flexible)
```

## Benefits

1. **Realistic scheduling**: Availability patterns now reflect real-world employee types
2. **Business rule compliance**: FIXED hours never exceed contracted hours
3. **Better scheduler performance**: More realistic data leads to better testing of the scheduling algorithm
4. **Transparency**: Detailed logging helps with debugging and validation
5. **Flexibility**: Low-hour employees have high availability, full-time employees have structured schedules

## Usage

The enhanced availability generation is automatically used when generating demo data:

```bash
# Generate optimized demo data (recommended)
curl -X POST http://localhost:5000/api/demo-data/optimized

# Generate regular demo data
curl -X POST http://localhost:5000/api/demo-data/ -H "Content-Type: application/json" -d '{"module": "all"}'

# Generate only availability data
curl -X POST http://localhost:5000/api/demo-data/ -H "Content-Type: application/json" -d '{"module": "availability"}'
```

## Testing

A standalone test script is available to verify the logic:

```bash
python test_enhanced_availability.py
```

This script tests the availability generation without requiring a database connection and provides detailed validation output.

## Future Enhancements

Potential improvements for future versions:

1. **Seasonal patterns**: Different availability in summer/winter
2. **Employee preferences**: Individual preference patterns
3. **Shift type preferences**: Some employees prefer early/late shifts
4. **Weekend availability**: Different patterns for weekend work
5. **Holiday considerations**: Reduced availability during holiday periods 