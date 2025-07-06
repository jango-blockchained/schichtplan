# Fix "Feste Schichtzuweisungen" (Fixed Shift Assignments) Functionality

## Task ID: FSA001

**Status**: pending  
**Priority**: high  
**Created**: 2024-01-12

## Problem Description

The "Feste Schichtzuweisungen" (Fixed Shift Assignments) action on the schedule page has a correct dialog but produces unexpected results. The functionality should:

1. **Iterate through all employees** and find those with fixed availability entries
2. **Add schedule assignments** where employees have fixed availability entries
3. **Create new shift templates** if no matching ones exist for the fixed availability

## Current Issues Identified

### 1. **Incomplete `findMatchingShift` Function**

- **Location**: `src/frontend/src/components/EnhancedAvailabilityModal.tsx` lines 177-207
- **Problem**: The function is just a stub that ignores employee and date parameters
- **Impact**: It doesn't actually look for employees with FIXED availability entries
- **Current behavior**: Uses simple heuristic to pick any shift template

### 2. **Missing Core Logic**

- **Problem**: Function doesn't query for employees with FIXED availability entries
- **Impact**: Processes all selected employees regardless of their availability status
- **Expected**: Should only process employees that have FIXED availability entries

### 3. **No Shift Template Creation**

- **Problem**: Doesn't create new shift templates when no matching ones exist
- **Impact**: Cannot handle cases where employee's fixed availability doesn't match any existing template
- **Expected**: Should create new shift templates as needed

### 4. **No Availability-Based Matching**

- **Problem**: Doesn't match shift templates based on availability start/end times
- **Impact**: May assign wrong shifts to employees
- **Expected**: Should match based on availability time windows

## Required Changes

### Phase 1: Fix `findMatchingShift` Function

**File**: `src/frontend/src/components/EnhancedAvailabilityModal.tsx`

Replace the current stub implementation with proper logic:

```typescript
const findMatchingShift = async (
  employee: Employee,
  date: Date
): Promise<Shift | null> => {
  if (!shifts || availabilityType !== "FIXED") return null;

  // 1. Query employee's FIXED availability entries for this date/weekday
  const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, etc.
  const dateStr = format(date, "yyyy-MM-dd");

  try {
    // Get employee's availability for this date
    const availabilities = await getEmployeeAvailability(employee.id, dateStr);

    // Filter for FIXED availability entries
    const fixedAvailabilities = availabilities.filter(
      (avail) => avail.availability_type === "FIXED"
    );

    if (fixedAvailabilities.length === 0) {
      return null; // No fixed availability for this employee/date
    }

    // 2. Find matching shift templates for each fixed availability
    for (const availability of fixedAvailabilities) {
      const matchingShift = findShiftTemplateByTimes(
        availability.start_time,
        availability.end_time,
        shifts
      );

      if (matchingShift) {
        return matchingShift;
      }
    }

    // 3. Create new shift template if no match found
    const firstAvailability = fixedAvailabilities[0];
    const newShift = await createShiftTemplate({
      name: `Fixed Shift ${firstAvailability.start_time}-${firstAvailability.end_time}`,
      start_time: firstAvailability.start_time,
      end_time: firstAvailability.end_time,
      is_active: true,
      break_duration: 30, // Default break duration
    });

    return newShift;
  } catch (error) {
    console.error(
      "Error finding matching shift for employee:",
      employee.id,
      error
    );
    return null;
  }
};
```

### Phase 2: Add Missing API Functions

**Files**:

- `src/frontend/src/services/api.ts`
- Backend API endpoints as needed

Add functions:

- `getEmployeeAvailability(employeeId: number, date: string)`
- `createShiftTemplate(shiftData: CreateShiftRequest)`
- `findShiftTemplateByTimes(startTime: string, endTime: string, shifts: Shift[])`

### Phase 3: Optimize Employee Selection

**File**: `src/frontend/src/components/EnhancedAvailabilityModal.tsx`

Modify the `handleSubmit` function to:

1. Pre-filter employees to only those with FIXED availability entries
2. Only process employees that actually have fixed availability for the selected dates
3. Provide better user feedback about which employees were processed

### Phase 4: Add User Feedback

**File**: `src/frontend/src/components/EnhancedAvailabilityModal.tsx`

Enhance the dialog to show:

1. Which employees have fixed availability entries
2. Preview of what assignments will be created
3. Progress indicators during processing
4. Summary of created assignments vs. skipped employees

## Dependencies

- Backend API endpoints for employee availability queries
- Backend API endpoints for shift template creation
- Frontend API service functions

## Expected Outcome

After implementation:

1. **Correct employee filtering**: Only processes employees with FIXED availability entries
2. **Proper shift matching**: Matches shift templates based on availability times
3. **Automatic template creation**: Creates new shift templates when needed
4. **Better user experience**: Clear feedback and progress indicators
5. **Accurate assignments**: Schedule assignments reflect actual fixed availability

## Testing Plan

1. **Test with employees having fixed availability**
2. **Test with employees having no fixed availability**
3. **Test with matching shift templates**
4. **Test with non-matching shift templates** (should create new ones)
5. **Test with multiple date ranges**
6. **Test error handling for API failures**

## Priority

**High** - This is a core functionality that currently produces incorrect results and confuses users.

## Implementation Progress

### ✅ Phase 1: Fixed `findMatchingShift` Function (COMPLETED)

**File**: `src/frontend/src/components/EnhancedAvailabilityModal.tsx`

**Changes Made:**
1. **Replaced stub implementation** with proper async logic that:
   - Queries employee's FIXED availability entries using `getEmployeeAvailabilities(employee.id)`
   - Filters for FIXED availability type on the target weekday
   - Groups consecutive available hours into time ranges
   - Finds matching shift templates using `findShiftTemplateByTimes` helper
   - Creates new shift templates automatically when no match found

2. **Added helper function** `findShiftTemplateByTimes`:
   - Respects fixed options (matchOnlyStart, matchOnlyEnd, or both)
   - Returns the first matching shift template

3. **Enhanced imports**:
   - Added `createShift` and `getEmployeeAvailabilities` imports
   - Made function calls async where needed

4. **Automatic shift template creation**:
   - Creates new shift templates with proper naming convention
   - Sets appropriate break requirements (>6 hours)
   - Activates for all days of the week

**Key Technical Details:**
- Converts JavaScript day format (Sunday=0) to backend format (Monday=0) 
- Groups consecutive hours into shift time ranges
- Handles error cases gracefully with logging
- Uses existing API endpoints and functions

### 🔄 Next Steps

**Phase 2**: Testing and validation
- Test with employees having fixed availability entries
- Test with employees having no fixed availability  
- Test with matching and non-matching shift templates
- Verify new shift template creation works correctly
- Test error handling scenarios

**Phase 3**: User experience improvements
- Add progress indicators during processing
- Show which employees were processed vs skipped
- Provide clearer feedback about created assignments

## Notes

- ✅ The stub implementation has been completely replaced with functional logic
- ✅ Uses existing API endpoints (`getEmployeeAvailabilities`, `createShift`)  
- ✅ Backward compatible with existing availability data
- ✅ Respects user-selected fixed options (match start/end times)
- 🔄 Needs thorough testing to verify functionality works as expected
