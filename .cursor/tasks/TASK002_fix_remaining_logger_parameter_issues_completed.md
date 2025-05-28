# Fix Logger Parameter Issues

## Description
Fix the remaining issues with the logger parameters in `src/backend/utils/logger.py`.

## Context
The logger in `src/backend/utils/logger.py` has been updated with new methods, but there were issues with the `extra` parameter in some places.

## Completed Steps
1. ✅ Added the missing `info()` method to the Logger class
2. ✅ Updated the `error()` method to accept the `extra` parameter
3. ✅ Updated references to `logger.error_logger` and `logger.schedule_logger` in multiple files to use the direct methods
4. ✅ Tested the changes by running the application

## Outcome
The logger now correctly handles the extra parameter and provides consistent logging methods. The API is working correctly as demonstrated by a successful test request to the schedules endpoint.

## Notes
Some files in the codebase may still contain references to the old logger attributes. A comprehensive codebase search would be needed to identify and update all these references.