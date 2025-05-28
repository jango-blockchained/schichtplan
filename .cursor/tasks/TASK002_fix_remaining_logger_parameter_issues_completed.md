# Fix Logger Parameter Issues

## Description
Fixed the remaining issues with the logger parameters in `src/backend/routes/schedules.py`.

## Context
The logger in `src/backend/utils/logger.py` had been updated with new methods, but there were issues with the `extra` parameter in some places.

## Steps Completed
1. Identified all occurrences of logger.error() with an extra parameter
   - Found in schedules.py when handling PDF generation errors and export errors
2. Updated the logger implementation in utils/logger.py to properly handle the extra parameter:
   - Added `extra=None` parameter to the `log_message` method signature
   - Modified all logger methods (`debug`, `info`, `warning`, `error`) to pass the `extra` parameter
   - Updated `log_message` to add fields from `extra` to LogRecord objects
   - Added special handling for the 'action' field in the `extra` dictionary
   - Added logic to use fields from `extra` as details when details is None
3. Made the changes backward compatible so existing code will continue to work

## Solution Details
The updated logger implementation now properly handles the `extra` parameter in these ways:
1. It passes the `extra` parameter through all logger methods to the `log_message` method
2. It adds all fields from the `extra` dictionary to the LogRecord objects
3. It extracts relevant fields (error, traceback) from `extra` if details is None
4. It stores the complete `extra` dictionary as an 'extra_data' attribute in the logs
5. It preserves all existing functionality for backward compatibility

This fixes the issues with PDF generation error logging and other places where the `extra` parameter was used.

## Test
The changes have been implemented and should resolve the issue with the logger.error() calls in schedules.py that use the extra parameter.