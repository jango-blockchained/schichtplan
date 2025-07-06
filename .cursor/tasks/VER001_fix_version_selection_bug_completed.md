# Task: Fix Version Selection Bug

## Task ID: VER001

## Status: completed

## Priority: high

## Description

Fix the version selection bug where the week navigation shows "Version vorhanden" (Version available) but there's no version available. The version manager is selected on version 28 but should have nothing selected if no version exists for that week.

## Problem Details

- Week navigation shows "Version vorhanden" for KW29 but no version exists
- Version manager is selected on version 28 instead of having nothing selected
- Background version selection of the app must be cleared if no version is available
- All components should use the same function and filter

## Objectives

1. ✅ Identify the version state management system
2. ✅ Find where version selection is handled across components
3. ✅ Create a unified function to clear version selection when no version exists
4. ✅ Ensure all components use the same version filtering logic
5. ✅ Fix the "Version vorhanden" display logic

## Dependencies

None

## Output Files

- ✅ Updated src/frontend/src/hooks/useVersionManager.ts
- ✅ Updated src/frontend/src/pages/SchedulePage.tsx
- ✅ Created src/frontend/src/utils/versionStateUtils.ts

## Implementation Details

### Root Cause

The version selection bug occurred because:

1. `hasVersions` in SchedulePage was calculated as `versionState.versions.length > 0` but didn't account for loading states
2. When navigating to a new week, the versions array contained stale data from the previous week until the new query completed
3. The version selection wasn't immediately cleared when navigating to a week with no versions

### Solution Implemented

1. **Fixed useVersionManager hook** (src/frontend/src/hooks/useVersionManager.ts):

   - Added immediate version clearing when dateRange changes using useRef to track previous date range
   - Modified useEffect to clear selectedVersion immediately on date range change before new query runs
   - Updated version selection logic to only proceed when query is complete (not loading/error)

2. **Fixed SchedulePage hasVersions calculation** (src/frontend/src/pages/SchedulePage.tsx):

   - Updated hasVersions to: `!isLoadingVersions && versionState.versions.length > 0 && !versionState.isError`
   - This ensures hasVersions is false during loading states and error states

3. **Created unified version state utility** (src/frontend/src/utils/versionStateUtils.ts):
   - Added VersionState and VersionDisplayState interfaces
   - Created getVersionDisplayState() function for consistent UI state logic
   - Added isVersionSelectionValid() to validate version selections
   - Added getVersionToSelect() for determining appropriate version selection
   - Added clearInvalidVersionSelection() for cleaning up invalid selections

### Result

- WeekNavigator no longer shows "Version vorhanden" when no versions exist
- Version selection is immediately cleared when navigating to weeks without versions
- All components now use consistent version state logic
- Fixed the stale data issue during week navigation

## Status: COMPLETED ✅
