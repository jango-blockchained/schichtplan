# Scheduler Fixes Task

## Description
Fix two identified issues in the Schichtplan scheduler system:
1. New schedule version not being selected automatically after creation
2. Generated shifts/assignments showing NULL values in the database
3. Schedule generator not saving to database properly

## Status
- [ ] Pending
- [ ] In Progress
- [x] Completed
- [ ] Failed

## Priority
High

## Steps

### 1. Fix Auto-Selection of New Version
- [x] Analyze the version control hook in `src/frontend/src/hooks/useVersionControl.ts`
- [x] Modify the version creation logic to automatically select the newly created version
- [x] Add a callback or useEffect to handle post-creation selection

### 2. Fix NULL Assignments in Database
- [x] Analyze the data flow from scheduler to database persistence
- [x] Check database transaction management and commit logic
- [x] Inspect field mapping between ScheduleAssignment and Database model
- [x] Add fallbacks for critical fields

### 3. Fix Database Save Operation
- [x] Fix import paths in _save_to_database method (relative -> absolute)
- [x] Ensure _save_to_database is called after generate_schedule
- [x] Add explicit call to _save_to_database in API endpoint

## Dependencies
None

## Expected Outcome
- The scheduler will automatically select the most recently created version
- Generated assignments will properly appear in the database with all fields populated
- The schedule table will display the generated assignments correctly
- Date ranges will properly align with the selected version and start on Monday

## Implementation Notes

### Auto-Selection Fix
- Updated `useVersionControl.ts` to properly reset the userHasManuallySelected flag after creating a new version
- Enhanced date range syncing with version data when a new version is created or selected

### NULL Values Fix
- Fixed the data mapping logic in ScheduleGenerator._save_to_database method
- Added fallbacks for critical fields (availability_type, shift_type)
- Added structured notes generation
- Improved diagnostic logging of database save operations

### Database Save Fix
- Fixed import paths: Changed `from utils.db_utils import session_manager` to `from src.backend.utils.db_utils import session_manager`
- Fixed model import path: Changed `from backend.models.schedule import Schedule` to `from src.backend.models.schedule import Schedule`
- Added explicit call to _save_to_database method in the API endpoint to ensure schedules are persisted

## Testing Notes
- Validated that new versions are properly selected when created
- Confirmed proper date range sync with selected version
- Verified that generated schedules are correctly saved to the database with all required fields