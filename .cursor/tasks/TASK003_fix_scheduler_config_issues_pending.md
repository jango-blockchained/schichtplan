# Fix Scheduler Config Issues

## Description
Fix parameter issues with the `SchedulerConfig` class in `src/backend/routes/schedules.py`.

## Context
The linter is showing errors related to the `SchedulerConfig` class:
1. "No parameter named 'min_rest_hours'" 
2. "Argument of type 'SchedulerConfig' cannot be assigned to parameter 'config' of type 'ScheduleConfig | None'"

## Steps to Complete
1. Investigate the `SchedulerConfig` class implementation
2. Check for `min_rest_hours` parameter and update if needed
3. Fix type mismatch between `SchedulerConfig` and `ScheduleConfig`
4. Test the changes

## Notes
The error comes from these lines:
```python
config = SchedulerConfig(
    # Removed parameters based on linter errors
    min_rest_hours=data.get("min_rest_hours", 11),
)

# Validate schedule
validation_errors = validator.validate(schedules, config)
```