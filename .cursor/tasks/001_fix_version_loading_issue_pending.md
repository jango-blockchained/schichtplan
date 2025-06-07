# Fix Version Loading Issue

## Problem
- Version table on the schedule page does not load version information  
- No version is selected, causing action buttons to be disabled
- User reports the application is not functional due to missing version data

## Investigation Results
1. ✅ Backend API is running on localhost:5000
2. ✅ Frontend is running on localhost:5173  
3. ✅ API endpoint `/api/v2/schedules/versions` returns empty versions array
4. ✅ Found bug in `useVersionControl.ts` - createNewVersion API call has wrong signature
5. ✅ Fixed createNewVersion function call to use proper object parameter

## Root Cause
The versions array is empty because:
1. No versions have been created yet
2. The version creation functionality was broken due to API signature mismatch

## Current Status
- Fixed the createNewVersion API call signature
- Need to test version creation functionality
- Need to ensure UI provides clear path for creating first version

## Next Steps
1. Test version creation through UI
2. Verify version loading after creation
3. Ensure UI handles empty state properly
4. Test that action buttons become enabled once version is selected

## Files Modified
- `/home/jango/Git/maike2/schichtplan/src/frontend/src/hooks/useVersionControl.ts` - Fixed createNewVersion call