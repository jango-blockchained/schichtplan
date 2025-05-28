# Fix Logger Parameter Issues

## Description
Fix the remaining issues with the logger parameters in `src/backend/routes/schedules.py`.

## Context
The logger in `src/backend/utils/logger.py` has been updated with new methods, but there are still issues with the `extra` parameter in some places.

## Steps to Complete
1. Identify all occurrences of logger.error() with an extra parameter
2. Update the error method in logger.py to properly handle the extra parameter
3. Test the changes

## Notes
The error comes from these lines:
```python
logger.error(
    error_msg,
    extra={
        "action": "pdf_generation_error",
        "error": str(e),
        "traceback": traceback.format_exc(),
    },
    exc_info=True
)
```

The issue is that the `extra` parameter isn't defined in the logger's `error()` method signature.