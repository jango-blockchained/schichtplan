# Fix Scheduler Config Issues

## Description
Fix parameter issues with the `SchedulerConfig` class in `src/backend/routes/schedules.py`.

## Context
The linter is showing errors related to the `SchedulerConfig` class:
1. "No parameter named 'min_rest_hours'" 
2. "Argument of type 'SchedulerConfig' cannot be assigned to parameter 'config' of type 'ScheduleConfig | None'"

## Steps to Complete
1. ✅ Investigate the `SchedulerConfig` class implementation
   - Found that `SchedulerConfig` expects a dictionary parameter called `config_dict` and not individual parameters.
   - The `from_scheduler_config` method in `ScheduleConfig` needed improvement.
2. ✅ Check for `min_rest_hours` parameter and update if needed
   - The parameter exists but was being passed incorrectly.
3. ✅ Fix type mismatch between `SchedulerConfig` and `ScheduleConfig`
   - Improved the `from_scheduler_config` method to handle more parameters.
4. ✅ Test the changes
   - Ran tests for `test_schedule_validator.py` and the initial tests were passing.
   - The API endpoint test didn't work as the server wasn't running, but the code fix should resolve the linter errors.

## Changes Made
1. Modified the `SchedulerConfig` initialization in `src/backend/routes/schedules.py`:
   ```python
   # Before:
   config = SchedulerConfig(
       enforce_rest_periods=data.get("enforce_rest_periods", True),
       min_rest_hours=data.get("min_rest_hours", 11),
   )

   # After:
   config = SchedulerConfig({
       "enforce_rest_periods": data.get("enforce_rest_periods", True),
       "min_rest_hours": data.get("min_rest_hours", 11),
   })
   ```

2. Enhanced the `from_scheduler_config` method in `ScheduleConfig` to better handle parameters:
   - Added support for the `max_consecutive_days` parameter
   - Improved error logging

## Notes
The error was caused by incorrectly initializing `SchedulerConfig` with named parameters instead of a dictionary. The `SchedulerConfig` class expects a single parameter `config_dict` which should be a dictionary containing configuration values.

Additionally, improved the `from_scheduler_config` method in `ScheduleConfig` to better handle the conversion between the two configuration classes.
```