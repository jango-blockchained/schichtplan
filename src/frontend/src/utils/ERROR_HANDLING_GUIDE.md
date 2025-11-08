# Frontend Error Handling Guide

## Date Error Handling

### Problem
Invalid date strings from API responses or user input can cause `RangeError: Invalid time value` crashes when using `new Date()` or `date-fns` formatting functions.

### Solution
Use the safe date utilities from `@/utils/errorUtils` to handle dates defensively.

## Utility Functions

### `safeParseDate(dateInput, fallback?)`
Safely parses dates from various input types with automatic fallback.

**Use when:**
- Parsing dates from API responses
- Converting user input to dates
- Working with optional date fields

**Example:**
```typescript
import { safeParseDate } from "@/utils/errorUtils";

// Instead of this (can crash):
const startDate = new Date(absence.start_date);

// Use this (safe):
const startDate = safeParseDate(absence.start_date);

// With custom fallback:
const startDate = safeParseDate(absence.start_date, new Date('2024-01-01'));
```

### `safeDateOperation(operation, fallback, errorMessage?)`
Wraps any date operation in a try-catch with fallback.

**Use when:**
- Formatting dates for display
- Calculating date differences
- Any operation that might throw with invalid dates

**Example:**
```typescript
import { safeDateOperation, safeParseDate } from "@/utils/errorUtils";
import { format } from "date-fns";

// Safe formatting:
const formatted = safeDateOperation(
  () => format(safeParseDate(absence.start_date), "dd.MM.yyyy"),
  "Invalid date",
  "Error formatting absence start date"
);

// Safe calculations:
const days = safeDateOperation(
  () => {
    const start = safeParseDate(absence.start_date);
    const end = safeParseDate(absence.end_date);
    return differenceInDays(end, start) + 1;
  },
  0,
  "Error calculating absence duration"
);
```

### `isValidDate(date)`
Validates if a value is a valid date.

**Use when:**
- Checking before processing dates
- Validating user input
- Conditional rendering based on date validity

**Example:**
```typescript
import { isValidDate } from "@/utils/errorUtils";

if (isValidDate(employee.birthday)) {
  // Safe to use the date
  const formatted = format(new Date(employee.birthday), "dd.MM.yyyy");
}
```

## Best Practices

### 1. Always Use Safe Utilities for External Data
```typescript
// ❌ Unsafe - can crash
const absence = await getAbsence(id);
const formatted = format(new Date(absence.start_date), "dd.MM.yyyy");

// ✅ Safe - handles invalid dates
const absence = await getAbsence(id);
const formatted = safeDateOperation(
  () => format(safeParseDate(absence.start_date), "dd.MM.yyyy"),
  "Invalid date"
);
```

### 2. Combine with Try-Catch for Statistics
```typescript
// ✅ Safe statistics calculation
const totalDays = absences.reduce((sum, absence) => {
  try {
    const start = safeParseDate(absence.start_date);
    const end = safeParseDate(absence.end_date);
    const days = differenceInDays(end, start) + 1;
    return sum + (days > 0 ? days : 0);
  } catch (error) {
    console.error("Error calculating days:", absence.id, error);
    return sum;
  }
}, 0);
```

### 3. Provide User-Friendly Fallbacks
```typescript
// ✅ Shows "Invalid date" instead of crashing
<TableCell>
  {safeDateOperation(
    () => format(safeParseDate(absence.start_date), "dd.MM.yyyy"),
    "Invalid date",
    "Error formatting start date"
  )}
</TableCell>
```

### 4. Log Errors for Debugging
Always include descriptive error messages in the third parameter of `safeDateOperation`:

```typescript
// ✅ Includes context in error log
safeDateOperation(
  () => format(safeParseDate(schedule.date), "dd.MM.yyyy"),
  "Invalid date",
  `Error formatting schedule date for schedule ID: ${schedule.id}`
);
```

## Components Updated

The following components have been updated with safe date handling:
- ✅ `AbsencesPage.tsx` - All date operations protected
- ✅ `EmployeeDetailModal.tsx` - Absence and schedule dates protected
- ✅ More components to be updated as needed

## Migration Checklist

When updating a component to use safe date handling:

1. [ ] Find all `new Date()` calls with external data
2. [ ] Replace with `safeParseDate()`
3. [ ] Find all `format()` calls on external dates
4. [ ] Wrap with `safeDateOperation()`
5. [ ] Add meaningful error messages
6. [ ] Test with invalid date data
7. [ ] Verify no console errors with bad data

## Testing

The error utilities have comprehensive test coverage:
- ✅ 21 unit tests covering all scenarios
- ✅ Tests for valid dates, invalid dates, null/undefined
- ✅ Tests for fallback behavior
- ✅ Tests for error logging

Run tests:
```bash
npm test src/utils/__tests__/errorUtils.test.ts
```

## Future Improvements

- [ ] Add similar safe utilities for numbers and strings
- [ ] Create custom TypeScript types for validated dates
- [ ] Add Sentry integration for production error tracking
- [ ] Create ESLint rule to warn about unsafe date usage
