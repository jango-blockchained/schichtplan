# Fix Scheduler Config Issues

## Description
Fix parameter issues with the `SchedulerConfig` class in `src/backend/routes/schedules.py`.

## Context
The linter was showing errors related to the `SchedulerConfig` class:
1. "No parameter named 'min_rest_hours'" 
2. "Argument of type 'SchedulerConfig' cannot be assigned to parameter 'config' of type 'ScheduleConfig | None'"

## Completed Steps
1. ✅ Investigated the `SchedulerConfig` class implementation
2. ✅ Added the `from_scheduler_config` method to the `ScheduleConfig` class in the validator module
3. ✅ Updated the code in schedules.py to use the conversion method
4. ✅ Preserved the existing `from_settings` method for backward compatibility

## Outcome
The code now correctly converts between `SchedulerConfig` and `ScheduleConfig` types, which should resolve the type mismatch error. The parameters are now properly passed to the validator.

## Notes
The validator still has some linter errors in its function signature which could be addressed in a future task.