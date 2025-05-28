# Logger Refactoring Task

## Description
Update all instances of `logger.error_logger` and `logger.schedule_logger` in the codebase to use the direct methods `logger.error()` and `logger.info()/logger.debug()` respectively.

## Context
The Logger class in `src/backend/utils/logger.py` has methods `error()`, `info()`, `debug()`, and `warning()` that should be used directly. Several files in the codebase were incorrectly attempting to access `error_logger` and `schedule_logger` attributes that don't exist.

## Completed Steps
1. Identified all files that used the incorrect logger methods:
   - `src/backend/services/scheduler/logging_utils.py`
   - `src/backend/services/scheduler/generator.py`
   - `src/backend/services/schedule_generator.py` 
   - `src/backend/utils/db_utils.py`
   - `src/backend/services/ai_scheduler_service.py`

2. For each file, replaced the incorrect logger patterns:
   - Replaced `logger.error_logger.error()` with `logger.error()`
   - Replaced `logger.error_logger.info()` with `logger.info()`
   - Replaced `logger.schedule_logger.info()` with `logger.info()`
   - Replaced `logger.schedule_logger.debug()` with `logger.debug()`
   - Replaced `logger.schedule_logger.warning()` with `logger.warning()`
   - Replaced `logger.schedule_logger.error()` with `logger.error()`

3. Fixed documentation in `logging_utils.py` to reflect correct usage patterns.

4. Fixed class initialization in `generator.py` to use the central logger correctly.

## Summary of Changes
- Updated 5 files with logger usage corrections
- Fixed approximately 140+ incorrect logger method calls
- Removed references to non-existent logger attributes
- Updated documentation to prevent future confusion

## Priority
High - This was causing application errors (now resolved)

## Dependencies
None