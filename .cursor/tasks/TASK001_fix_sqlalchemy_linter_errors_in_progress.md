# Fix SQLAlchemy Linter Errors in Routes

## Description
Fix SQLAlchemy-related linter errors in the `src/backend/routes/schedules.py` file, primarily focused on ambiguous column access and other type-related issues.

## Context
The `schedules.py` file contains several linter errors related to SQLAlchemy:
1. "Access to generic instance variable through class is ambiguous" for column access
2. Type errors with `availability_type` parameters
3. Parameter issues with logger and scheduler config

## Steps to Complete
1. ✅ Identify all SQLAlchemy-related linter errors in `schedules.py`
2. ✅ Research proper SQLAlchemy column access patterns in SQLAlchemy 2.0
3. ✅ Fix the "Access to generic instance variable through class is ambiguous" errors
4. Fix the availability type parameter issues
5. Fix the logger parameter issues
6. Fix the scheduler config parameter issues
7. Test the changes

## Progress
- Identified all errors from linter output
- The main issue appears to be accessing columns through the model class instead of through model instances or using the proper SQLAlchemy 2.0 selectors

## Notes
SQLAlchemy 2.0 has different patterns for querying than 1.x versions. Need to ensure we're using the correct syntax for the version being used.