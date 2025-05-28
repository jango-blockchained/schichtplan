# Logger Refactoring Task

## Description
Update all instances of `logger.error_logger` and `logger.schedule_logger` in the codebase to use the direct methods `logger.error()` and `logger.info()/logger.debug()` respectively.

## Context
The Logger class in `src/backend/utils/logger.py` has methods `error()`, `info()`, `debug()`, and `warning()` that should be used directly. Several files in the codebase are incorrectly attempting to access `error_logger` and `schedule_logger` attributes that don't exist.

## Steps to Complete
1. Identify all remaining files that use the incorrect logger methods:
   - `src/backend/services/scheduler/logging_utils.py`
   - `src/backend/services/scheduler/generator.py`
   - `src/backend/services/schedule_generator.py`
   - and possibly other files

2. For each file:
   - Replace `logger.error_logger.error()` with `logger.error()`
   - Replace `logger.error_logger.info()` with `logger.info()`
   - Replace `logger.schedule_logger.info()` with `logger.info()`
   - Replace `logger.schedule_logger.debug()` with `logger.debug()`
   - Replace `logger.schedule_logger.warning()` with `logger.warning()`
   - Replace `logger.schedule_logger.error()` with `logger.error()`

3. If any file uses the pattern from `fixed_shift.py` with:
   ```python
   if hasattr(logger, "schedule_logger"):
       logger.schedule_logger.debug(...)
   else:
       logger.debug(...)
   ```
   
   Replace it with the direct call:
   ```python
   logger.debug(...)
   ```

## Priority
High - This is causing application errors

## Dependencies
None