# Version Duplication Fix Summary

## Issues Fixed

### 1. Backend API Logic Issue

**Problem**: The duplicate version API was filtering source schedules by the target date range instead of mapping dates correctly.

**Original Logic**:
```python
# Skip if the date is outside our new range
if schedule.date < start_date or schedule.date > end_date:
    continue
```

**Fixed Logic**:
```python
# Calculate date offset for mapping source dates to target dates
date_offset = (start_date - source_start_date).days

# Calculate the new date by applying the offset
new_date = schedule.date + timedelta(days=date_offset)

# Only copy if the new date falls within our target range
if new_date < start_date or new_date > end_date:
    continue
```

**Root Cause**: The API was trying to find schedules from the source version that already existed in the target date range, instead of calculating the correct date mapping.

### 2. Enhanced Error Messages

**Before**: Generic error messages that didn't help understand the issue.

**After**: More descriptive error messages that explain what went wrong:
- "No schedules found for version X. Cannot duplicate an empty version."
- "Could not determine source date range"

### 3. Improved Modal UX

**Added**:
- Source version information display with date range
- Visual distinction between source (blue) and target (green) sections  
- Better descriptions explaining the duplication process
- Source version metadata display when available

## Key Changes Made

### Backend (`src/backend/api/schedules.py`)
1. Fixed date mapping logic in `duplicate_version()` function
2. Added proper source date range detection from metadata or schedules
3. Improved error messages and response data
4. Added `schedules_copied` count in success response

### Frontend (`src/frontend/src/components/DuplicateVersionModal.tsx`)
1. Added `sourceVersionMeta` prop to show source version details
2. Enhanced UI with color-coded sections for source vs target
3. Improved dialog descriptions
4. Added source version date range display

### Frontend (`src/frontend/src/components/VersionManagerClean.tsx`)
1. Updated modal calls to pass source version metadata

## How the Fix Works

1. **Source Detection**: The API now first gets the source version's date range from metadata or calculates it from existing schedules
2. **Date Mapping**: It calculates the offset between source and target date ranges
3. **Schedule Duplication**: Each schedule gets its date adjusted by the calculated offset
4. **Range Validation**: Only schedules that fall within the target range after mapping are copied

This ensures that schedules are properly copied from one week/time period to another with correct date adjustments.

## Testing

Run the test script to verify the fix:
```bash
python test_duplicate_fix.py
```

This will test the duplicate API with sample data and verify it works correctly.
