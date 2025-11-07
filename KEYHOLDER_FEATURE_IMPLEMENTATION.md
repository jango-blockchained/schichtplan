# Keyholder Feature Implementation Summary

## Overview
This document describes the implementation of the keyholder feature for the Schichtplan scheduling application. The feature allows marking specific schedule shifts (not employees) as "keyholder shifts" to track which employee has the physical key for opening and closing the store.

## Problem Statement
The store has only ONE physical key. One employee must:
- Close the store (late shift/Spätschicht)
- Open the store the next business day (early shift/Frühschicht)

This is a **shift assignment**, not an employee capability.

## Solution Architecture

### Database Changes
**New Field**: `is_keyholder_shift` (Boolean, default: False)
- Added to `Schedule` model in `src/backend/models/schedule.py`
- Migration file: `src/backend/migrations/versions/add_keyholder_shift_field.py`

### Backend API Changes

#### Schedule Model (`src/backend/models/schedule.py`)
- Added `is_keyholder_shift` column
- Updated `__init__` method to accept `is_keyholder_shift` parameter
- Updated `to_dict()` method to include field in API responses

#### API Endpoints
**Create Schedule** (`src/backend/api/schedules.py`):
- Accepts `is_keyholder_shift` in request payload
- Creates schedule with keyholder flag

**Update Schedule** (`src/backend/routes/schedules.py`):
- Accepts `is_keyholder_shift` in update requests
- Handles both creation (schedule_id=0) and update operations
- Includes logging for keyholder updates

#### Schema (`src/backend/schemas/schedules.py`)
- Added `is_keyholder_shift` field to `ScheduleUpdateRequest` Pydantic model

### Frontend Changes

#### Type Definitions (`src/frontend/src/types/index.ts`)
- Added `is_keyholder_shift?: boolean` to `Schedule` interface
- Added `is_keyholder_shift?: boolean` to `ScheduleUpdate` interface
- Added `is_keyholder_shift?: boolean` to `DragItem` interface (for drag-and-drop)

#### AddScheduleDialog Component
**Location**: `src/frontend/src/components/Schedule/AddScheduleDialog.tsx`

**Key Changes**:
1. **State Management**:
   - Renamed `isKeyholder` to `isKeyholderShift`
   - Added settings state to check store hours
   - Added `isKeyholderEligible` computed value
   - Added `correspondingShiftInfo` computed value

2. **Keyholder Eligibility**:
   ```typescript
   const isKeyholderEligible = useMemo(() => {
     // Only enable for opening or closing shifts
     const isOpeningShift = shift.start_time === storeOpening;
     const isClosingShift = shift.end_time === storeClosing;
     return isOpeningShift || isClosingShift;
   }, [selectedShift, applicableShiftsList, settings]);
   ```

3. **UI Changes**:
   - Checkbox label: "Als Schlüsselträger-Schicht markieren" (Mark as keyholder shift)
   - Checkbox disabled for non-opening/closing shifts
   - Shows helper text: "Nur für Öffnungs- oder Schließschichten verfügbar"
   - Displays corresponding shift warning in amber box when keyholder is activated
   
4. **Consecutive Shift Information**:
   - For closing shifts: Shows message about next day opening requirement
   - For opening shifts: Shows message about previous day closing requirement
   - Example: "Dieser Mitarbeiter muss am 08.11.2025 die Öffnungsschicht (09:00) übernehmen."

5. **Removed**:
   - Employee keyholder status update logic (no longer changes `employee.is_keyholder`)
   - Imports: `getEmployees`, `updateEmployee`

#### ScheduleTable Component
**Location**: `src/frontend/src/components/ScheduleTable.tsx`

**Key Changes**:
1. **Keyholder Detection**:
   - Changed from `employee?.is_keyholder` to `schedule?.is_keyholder_shift`
   - Updated in 3 locations:
     - `getKeyholderAdjustedTimes()` function
     - `calculateBreakDuration()` function  
     - `TimeSlotDisplay` component

2. **Visual Indicators**:
   - Key icon (🔑) now shown based on `schedule.is_keyholder_shift`
   - Keyholder time adjustments (before/after minutes) based on shift assignment

3. **Drag-and-Drop**:
   - Added `is_keyholder_shift` to `DragItem` interface
   - Updated `useDrag` hook to include keyholder status in drag payload
   - Keyholder status can now be transferred between employees via drag-and-drop

4. **Preserved**:
   - Employee sorting by keyholder capability (`employee.is_keyholder`) still works
   - This tracks WHO CAN be a keyholder, separate from WHICH SHIFT has the key

## Feature Behavior

### When Adding a New Shift

1. **Keyholder Checkbox State**:
   - Disabled by default
   - Only enabled if shift is an opening shift (starts at store opening time) OR closing shift (ends at store closing time)
   - Shows helper text when disabled

2. **When Keyholder is Activated**:
   - Shows amber warning box with consecutive shift requirement
   - For closing shift: "This employee must work the opening shift the next day"
   - For opening shift: "This employee should have worked the closing shift the previous day"
   - Displays the specific date and time

3. **When Shift is Saved**:
   - `is_keyholder_shift` flag is stored in database
   - Does NOT change employee's `is_keyholder` capability field
   - Keyholder time adjustments automatically applied in schedule display

### Visual Indicators

1. **In Schedule Table**:
   - Key icon (🔑) shown next to shift times for keyholder shifts
   - Adjusted times displayed (e.g., 08:55-20:10 instead of 09:00-20:00)
   - Time breakdown shows working time and break time

2. **Keyholder Time Adjustments**:
   - Opening shift: Employee arrives `keyholder_before_minutes` before store opens
   - Closing shift: Employee stays `keyholder_after_minutes` after store closes
   - Extra time counted as break time (not working time)
   - Configurable in Settings (default: 5 min before, 10 min after)

### Drag-and-Drop

1. **Keyholder Transfer**:
   - When dragging a keyholder shift to another employee, keyholder status transfers
   - Drag payload includes `is_keyholder_shift: true`
   - Target cell receives the shift with keyholder flag intact

2. **Validation** (Future Enhancement):
   - Should prevent multiple keyholder shifts on same day
   - Should warn if consecutive closing→opening not assigned to same employee

## Configuration

### Settings
**Location**: `src/backend/models/settings.py`

**Fields**:
- `keyholder_before_minutes`: Minutes before store opening (default: 5)
- `keyholder_after_minutes`: Minutes after store closing (default: 10)
- `store_opening`: Store opening time (e.g., "09:00")
- `store_closing`: Store closing time (e.g., "20:00")

## Database Migration

**File**: `src/backend/migrations/versions/add_keyholder_shift_field.py`

```python
def upgrade():
    op.add_column(
        "schedules",
        sa.Column(
            "is_keyholder_shift",
            sa.Boolean(),
            nullable=False,
            server_default="0",
        ),
    )

def downgrade():
    op.drop_column("schedules", "is_keyholder_shift")
```

**To Apply**:
```bash
flask db upgrade
```

## Future Enhancements

### Phase 1: Validation (Not Yet Implemented)
- [ ] Prevent multiple keyholder shifts on same day
- [ ] Warn when closing→opening not assigned to same employee
- [ ] Validate keyholder capability (employee.is_keyholder) before assignment

### Phase 2: Automation (Not Yet Implemented)
- [ ] Auto-suggest keyholder for closing shift employee's next opening shift
- [ ] Quick-assign consecutive shifts with single click
- [ ] Keyholder schedule overview/calendar view

### Phase 3: Reporting (Not Yet Implemented)
- [ ] Keyholder assignment report
- [ ] Track keyholder duty frequency per employee
- [ ] Alert on missing keyholder assignments

## Testing Recommendations

1. **Unit Tests**:
   - Schedule model serialization includes `is_keyholder_shift`
   - API endpoints accept and store keyholder flag
   - Keyholder eligibility calculation

2. **Integration Tests**:
   - Create schedule with keyholder shift
   - Update schedule to toggle keyholder status
   - Drag-and-drop transfers keyholder flag

3. **UI Tests**:
   - Checkbox disabled for mid-day shifts
   - Checkbox enabled for opening/closing shifts
   - Corresponding shift message displays correctly
   - Key icon shows for keyholder shifts
   - Time adjustments calculated correctly

4. **End-to-End Tests**:
   - Complete workflow: Assign closing shift → See warning → Assign opening shift next day
   - Verify keyholder time adjustments in schedule display
   - Verify drag-and-drop maintains keyholder status

## Notes

### Important Design Decisions

1. **Shift-Level, Not Employee-Level**:
   - `schedule.is_keyholder_shift` tracks WHICH SHIFT has the key
   - `employee.is_keyholder` tracks WHO CAN be a keyholder (capability)
   - These are separate concerns

2. **No Automatic Employee Updates**:
   - The old implementation changed `employee.is_keyholder` when assigning shifts
   - New implementation does NOT do this
   - Keyholder capability must be set separately in employee management

3. **Minimal UI Changes**:
   - Reused existing checkbox in AddScheduleDialog
   - Added eligibility check without changing layout
   - Key icon already existed, just changed detection logic

### Known Limitations

1. **No Validation Yet**:
   - Multiple keyholder shifts on same day is allowed (should be prevented)
   - No validation of consecutive closing→opening assignments

2. **No Auto-Assignment**:
   - User must manually mark both closing and opening shifts
   - No helper to quickly assign consecutive shifts

3. **No Visual Overview**:
   - No dedicated view showing all keyholder assignments
   - No calendar view highlighting keyholder duty

## Related Files

### Backend
- `src/backend/models/schedule.py`
- `src/backend/models/settings.py`
- `src/backend/api/schedules.py`
- `src/backend/routes/schedules.py`
- `src/backend/schemas/schedules.py`
- `src/backend/migrations/versions/add_keyholder_shift_field.py`

### Frontend
- `src/frontend/src/types/index.ts`
- `src/frontend/src/components/Schedule/AddScheduleDialog.tsx`
- `src/frontend/src/components/ScheduleTable.tsx`

## Changelog

### 2025-11-07 - Initial Implementation
- Added `is_keyholder_shift` field to Schedule model
- Created database migration
- Updated API endpoints (create, update)
- Updated frontend components (AddScheduleDialog, ScheduleTable)
- Added keyholder eligibility check
- Added corresponding shift information display
- Enabled drag-and-drop keyholder transfer
