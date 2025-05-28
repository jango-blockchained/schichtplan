# Task: Fix Schedule Week Range and Shift Assignment Issues

## Description
This task addresses two critical issues in the Schichtplan application:

1. **Calendar Week Date Range Issue**: The calendar week display shows an incorrect date range (e.g., for CW 19, it shows 11.05-17.05 instead of 12.05-18.05 when week starts on Monday)

2. **Shift Assignment Data Issue**: The schedule statistics display shows 15 shifts but only 5 are visible, indicating missing data (start/end time, availability_type, etc.) in the shift generation process

## Priority
High

## Steps

### 1. Fix Calendar Week Date Range Calculation
- Modify the `getWeekDateRange` function in `src/frontend/src/utils/dateUtils.ts`
- Ensure consistent use of `weekStartsOn: 1` (Monday) in all date-fns operations
- Fix the calculation to properly return Monday-Sunday range for each week
- Test with various week numbers to ensure correct calculation

```javascript
// Specific changes to make:
// 1. Review and fix the startDate and endDate calculation in getWeekDateRange
// 2. Add explicit console logging to show weekday of both start and end dates
// 3. Ensure firstMonday is actually falling on a Monday
```

### 2. Fix Schedule Generation Process
- Enhance the `ScheduleAssignment` class in `src/backend/services/scheduler/generator.py`
- Improve shift_template data extraction logic
- Ensure all required fields are properly captured and populated:
  - start_time
  - end_time
  - availability_type
  - shift_type_str
- Modify the serialization process to include all necessary fields

```python
# Areas to enhance:
# 1. The shift_template extraction logic in ScheduleAssignment.__init__
# 2. The processed_for_downstream dictionary creation in the generate method
# 3. Add more comprehensive logging for shift data extraction failures
```

### 3. Add Diagnostic Tooling
- Create a validation function to verify shift data integrity after generation
- Add detailed logging for shift data throughout the generation process
- Implement error recovery strategy for missing shift data

### 4. Testing
- Test calendar week calculation with various week numbers and year values
- Test with both EnhancedDateRangeSelector and DateRangeSelector components
- Generate schedules and verify all 15 shifts are properly displayed
- Verify availability_type and other fields are properly populated

## Success Criteria
- Calendar week shows correct date range (Monday-Sunday)
- All 15 shifts are visible in the schedule display
- All shift data (start_time, end_time, availability_type) is correctly populated

## Notes
This issue was identified from the UI where CW 19 shows date range 11.05-17.05 instead of 12.05-18.05, and the statistics indicate 15 shifts but only 5 are visible.