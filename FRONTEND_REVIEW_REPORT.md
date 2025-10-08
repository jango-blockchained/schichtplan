# Frontend Functionality Review Report

**Date:** 8 October 2025  
**Project:** Schichtplan Application  
**Reviewer:** GitHub Copilot

---

## Executive Summary

This report identifies logical issues, bugs, and potential problems in the frontend codebase. The analysis covers state management, version control, navigation, data flow, and component architecture.

## Critical Issues 🔴

### 1. **Version State Inconsistency in useVersionManager**

**Location:** `src/frontend/src/hooks/useVersionManager.ts`

**Issue:** Complex state synchronization logic with potential race conditions:

```typescript
// Lines 93-127: Multiple useEffect hooks managing selectedVersion state
useEffect(() => {
  // Immediate clear on date range change
  if (prevDateRangeRef.current !== null && prevDateRangeRef.current !== currentDateRangeKey) {
    console.log("📅 Date range changed, clearing version selection immediately");
    setSelectedVersion(undefined);
    onVersionSelectedRef.current?.(undefined);
    processedQueryRef.current = null; // This could cause race conditions
  }
  prevDateRangeRef.current = currentDateRangeKey;
}, [currentDateRangeKey, dateRange?.from, dateRange?.to]);

// Lines 128-173: Auto-selection logic that may conflict with above
useEffect(() => {
  // ... complex logic that sets selectedVersion
  // This can run AFTER the clear above, causing flickering
}, [versionsQuery.data, versionsQuery.isLoading, ...]);
```

**Problem:**

- Two separate `useEffect` hooks manage the same state (`selectedVersion`)
- Race condition: clear effect runs, then auto-select effect runs immediately after
- Users may see flickering or wrong version selected during navigation
- `processedQueryRef` reset can cause duplicate processing

**Impact:** Version selection may be unreliable, especially during rapid week navigation

**Recommendation:**

- Consolidate version selection logic into a single `useEffect`
- Use a state machine or reducer pattern for complex state transitions
- Add debouncing for rapid navigation events

---

### 2. **Duplicate Week State Management in SchedulePage**

**Location:** `src/frontend/src/pages/SchedulePage.tsx`

**Issue:** Multiple redundant state management systems:

```typescript
// Lines 291-300: Manual week state
const [currentWeek, setCurrentWeek] = useState(() => {
  const today = new Date();
  // ... manual calculation
});

// Lines 301-313: Manual date range state
const [dateRange, setDateRange] = useState<DateRange>(() => {
  // ... manual calculation
});

// Lines 315-328: Version manager with its own state
const versionManager = useVersionManager({
  dateRange,
  onVersionSelected: (version) => { ... },
  autoSelectLatest: true,
});

// Lines 393-520: Custom navigation functions that duplicate hook logic
const navigateToWeek = useCallback((weekIdentifier: string) => {
  setCurrentWeek(weekIdentifier);
  // ... manual date range calculation
}, []);
```

**Problem:**

- Three overlapping systems manage week/date state
- `useWeekBasedVersionControl` hook exists but isn't used
- Manual date calculations duplicate `weekUtils` functionality
- No single source of truth for current week

**Impact:**

- State synchronization bugs
- Difficult to maintain consistency
- Navigation may not update all related states correctly

**Recommendation:**

- Use `useWeekBasedVersionControl` hook exclusively
- Remove manual week calculation logic
- Let the hook manage dateRange internally

---

### 3. **Missing Error Boundaries**

**Location:** Throughout frontend, but especially `src/frontend/src/App.tsx`

**Issue:** No error boundary components to catch rendering errors:

```tsx
// Current App.tsx
const App: React.FC = () => {
  return (
    <div>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <BrowserRouter>
            <AIContextProvider>
              {/* No error boundary wrapping */}
              <Routes>{/* ... */}</Routes>
            </AIContextProvider>
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </div>
  );
};
```

**Problem:**

- Any component error crashes entire app
- No graceful error recovery
- Poor user experience when errors occur

**Impact:** Complete app failure on any component error

**Recommendation:**

```tsx
// Add error boundary
import { ErrorBoundary } from "react-error-boundary";

const App: React.FC = () => {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={logError}
      onReset={() => window.location.reload()}
    >
      <QueryClientProvider client={queryClient}>
        {/* ... */}
      </QueryClientProvider>
    </ErrorBoundary>
  );
};
```

---

## High Priority Issues ⚠️

### 4. **WeekNavigator Segment Navigation Logic Flaw**

**Location:** `src/frontend/src/components/WeekNavigator.tsx`

**Issue:** Segment navigation doesn't reset when week changes:

```tsx
// Lines 47-61: Query for segments
const { data: segmentsData } = useQuery<WeekSegmentsResponse>({
  queryKey: ['week-segments', `${currentWeekInfo.year}-W${String(currentWeekInfo.weekNumber).padStart(2, '0')}`],
  queryFn: () => getWeekSegments(...),
  enabled: weekNavigationSettings?.monthBoundaryMode === 'split_by_month' && currentWeekInfo.spansMonths,
});

// Lines 86-96: Navigation handlers
const handleNavigateNext = () => {
  if (isSplitMode && segmentsData && currentSegment < segmentsData.segments.length) {
    onSegmentChange?.(currentSegment + 1);
  } else {
    onNavigateNext(); // Week changes, but currentSegment doesn't reset!
  }
};
```

**Problem:**

- When navigating to next week, `currentSegment` stays at old value
- If previous week had 2 segments and `currentSegment=2`, new week with 3 segments starts at segment 2
- No reset mechanism when `currentWeekInfo` changes

**Impact:** User lands on wrong segment when navigating between weeks

**Recommendation:**

```tsx
// Add effect to reset segment on week change
useEffect(() => {
  if (currentSegment > (segmentsData?.segments.length || 1)) {
    onSegmentChange?.(1);
  }
}, [currentWeekInfo.weekNumber, currentWeekInfo.year]);
```

---

### 5. **SchedulePage Excessive State Variables**

**Location:** `src/frontend/src/pages/SchedulePage.tsx:171-231`

**Issue:** 25+ state variables in a single component:

```typescript
const [includeEmpty, setIncludeEmpty] = useState<boolean>(true);
const [createEmptySchedules, setCreateEmptySchedules] = useState(true);
const [isGenerationSettingsOpen, setIsGenerationSettingsOpen] = useState(false);
const [isAddScheduleDialogOpen, setIsAddScheduleDialogOpen] = useState(false);
// ... 20+ more state variables
```

**Problem:**

- Component has too many responsibilities
- Difficult to track state changes
- Hard to test and maintain
- Many states are UI-only (modal open/close) and should be colocated with their components

**Impact:** Maintenance nightmare, high bug risk

**Recommendation:**

- Extract modal management to custom hooks (e.g., `useModal()`)
- Move generation logic to `useScheduleGeneration` hook (already partially done)
- Split into smaller sub-pages or containers
- Use reducer for related state groups

---

### 6. **VersionManager Prop Drilling**

**Location:** `src/frontend/src/components/VersionManager.tsx`

**Issue:** Component accepts both controlled and uncontrolled versions:

```tsx
interface VersionManagerProps {
  // Internal version management
  dateRange?: DateRange;
  onVersionSelected?: (version: number | undefined) => void;
  autoSelectLatest?: boolean;

  // External version management (controlled)
  versions?: VersionMeta[];
  selectedVersion?: number | undefined;
}

// Lines 88-104: Complex fallback logic
const effectiveVersions = useMemo(
  () => externalVersions || versionManagerResult?.state.versions || [],
  [externalVersions, versionManagerResult?.state.versions]
);
```

**Problem:**

- Component tries to be both controlled and uncontrolled
- Complex fallback logic that's hard to debug
- Actions become no-ops when using external versions (line 109-119)
- Confusing API for component users

**Impact:** Unpredictable behavior, difficult to use correctly

**Recommendation:**

- Split into two components: `ControlledVersionManager` and `UncontrolledVersionManager`
- Or use a composition pattern with context
- Make it clear which mode is being used

---

## Medium Priority Issues 🟡

### 7. **Missing Loading States in Navigation**

**Location:** `src/frontend/src/hooks/useWeekBasedVersionControl.ts`

**Issue:** Navigation functions don't show loading indicators properly:

```typescript
const navigateNext = useCallback(async () => {
  try {
    setIsLoading(true);
    const nextWeekInfo = await apiGetNextWeek(currentWeek);
    setCurrentWeek(nextWeekInfo.week_identifier);
    onWeekChanged?.(nextWeekInfo.week_identifier);
  } catch (error) {
    // ...
  } finally {
    setIsLoading(false); // UI might not reflect this immediately
  }
}, [currentWeek, onWeekChanged, toast]);
```

**Problem:**

- Loading state is set, but component may have already unmounted
- No cancellation token for async operations
- Rapid clicking can trigger multiple navigations

**Impact:** Loading indicators may not work reliably

**Recommendation:**

- Add abort controller for cancellation
- Implement debouncing or disable buttons during navigation
- Use transition states instead of boolean loading

---

### 8. **Inconsistent Date Formatting**

**Location:** Multiple files

**Issue:** Date formatting inconsistencies throughout codebase:

```typescript
// In one file:
format(date, "yyyy-MM-dd");

// In another:
date.toISOString().split("T")[0];

// In another:
format(date, "dd.MM.yyyy", { locale: de })// Week identifiers:
`${year}-W${weekNumber.toString().padStart(2, "0")}`;
```

**Problem:**

- Multiple ways to format the same data
- Potential locale issues
- Hard to ensure consistency

**Impact:** Date display bugs, API communication issues

**Recommendation:**

- Create utility functions in `utils/dateFormatters.ts`
- Standardize on ISO 8601 for API communication
- Use locale-aware formatting only for display

---

### 9. **Unused Props and Dead Code**

**Location:** Multiple components

**Examples:**

```tsx
// SchedulePage.tsx line 231
// const [selectedAvailabilityType, setSelectedAvailabilityType] = useState<'FIXED' | 'PREFERRED' | 'UNAVAILABLE' | null>(null); // Removed - unused

// CalendarPage.tsx line 105
// const [isDragging, setIsDragging] = useState(false); // (drag state currently unused)

// ScheduleManager.tsx line 22
// Removed activeView as we're always using table view
```

**Problem:**

- Code comments indicate removed functionality
- Props defined but never used
- State variables defined but never updated

**Impact:** Code bloat, confusion, potential bugs from incomplete removal

**Recommendation:**

- Complete removal of commented-out code
- Clean up unused props with ESLint rules
- Document intentionally unused props (for future use)

---

### 10. **Query Key Inconsistencies**

**Location:** Throughout query usage

**Issue:** Inconsistent query key patterns:

```typescript
// Some use arrays
["settings"][
  // Some use tuples with undefined
  ("versions", dateRange?.from?.toISOString(), dateRange?.to?.toISOString())
];

// Some use objects
{
  queryKey: ["week-segments", currentWeek];
}

// Some include all dependencies, some don't
["schedules"]; // Missing version, dateRange
```

**Problem:**

- Cache invalidation is unpredictable
- Queries may not refetch when they should
- Hard to debug cache issues

**Impact:** Stale data, unnecessary refetches

**Recommendation:**

- Standardize query key factory pattern:

```typescript
export const queryKeys = {
  versions: {
    all: ["versions"] as const,
    list: (from: string, to: string) => ["versions", from, to] as const,
  },
  schedules: {
    all: ["schedules"] as const,
    byVersion: (version: number, from: string, to: string) =>
      ["schedules", version, from, to] as const,
  },
};
```

---

## Low Priority Issues 💡

### 11. **Console.log Statements in Production Code**

**Location:** Throughout codebase

**Examples:**

```typescript
// SchedulePage.tsx:355
console.log("📅 SchedulePage Debug:");
console.log("📅 Current week:", currentWeek);

// ScheduleManager.tsx:91
console.log("🔵 ScheduleManager received:", {...});

// useVersionManager.ts:95
console.log("📅 Date range changed, clearing version selection immediately");
```

**Problem:**

- Debug logs left in production code
- Performance impact from excessive logging
- Console pollution

**Impact:** Minor performance hit, messy console

**Recommendation:**

- Remove or wrap in `if (__DEV__)` checks
- Use proper logging library with levels
- Create debug utility: `const debug = createDebugger('SchedulePage')`

---

### 12. **Magic Numbers and Strings**

**Location:** Throughout codebase

**Examples:**

```typescript
// WeekNavigator.tsx:27
weekendStart?: number; // 0 = Sunday, 1 = Monday

// SchedulePage.tsx:264
switch (lowerDayName) {
  case 'monday': return 0;
  case 'tuesday': return 1;
  // ...
}

// Various stale times
staleTime: 5 * 60 * 1000, // 5 minutes
```

**Problem:**

- Magic numbers without constants
- Hardcoded values scattered across files
- Difficult to change globally

**Impact:** Maintenance difficulty, inconsistent behavior

**Recommendation:**

```typescript
// constants/time.ts
export const STALE_TIME = {
  SHORT: 60 * 1000, // 1 minute
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 30 * 60 * 1000, // 30 minutes
} as const;

// constants/dates.ts
export const WEEKDAY = {
  SUNDAY: 0,
  MONDAY: 1,
  // ...
} as const;
```

---

### 13. **Type Safety Issues**

**Location:** Multiple locations

**Examples:**

```typescript
// Loose typing
employeeAbsences?: Record<number, unknown[]>; // Should be Record<number, Absence[]>

// Any types
monthlyPublishedSchedules?: Schedule[]; // Could be more specific

// Optional chaining overuse
versions?.map(v => v.version) // Could use default empty array

// Type assertions without validation
(error as Error).message
```

**Problem:**

- Loss of type safety benefits
- Runtime errors not caught at compile time
- Difficult to refactor safely

**Impact:** Potential runtime errors

**Recommendation:**

- Enable strict TypeScript settings
- Use type guards for runtime validation
- Add Zod or similar for runtime type checking on API boundaries

---

## Architectural Concerns 🏗️

### 14. **Lack of Feature Organization**

**Current Structure:**

```
src/
  components/     # 100+ components mixed together
  pages/          # All pages at same level
  hooks/          # All hooks at same level
  services/       # All services together
```

**Problem:** No feature-based organization, everything is flat

**Recommendation:**

```
src/
  features/
    schedule/
      components/
      hooks/
      services/
      types/
      utils/
    versions/
      components/
      hooks/
      services/
      types/
      utils/
  shared/
    components/
    hooks/
    utils/
```

---

### 15. **Missing Validation Layer**

**Issue:** No systematic validation of user inputs or API responses

**Current State:**

- Direct use of API data without validation
- Form validation scattered across components
- No schema validation

**Recommendation:**

- Add Zod schemas for all data types
- Validate API responses
- Centralize form validation logic

---

## Testing Concerns 🧪

### 16. **Limited Test Coverage**

**Found:**

- Some test files in `__tests__` folders
- Many critical components untested
- No integration tests visible

**Recommendation:**

- Add tests for critical user flows
- Test version management logic
- Test navigation edge cases

---

## Performance Concerns ⚡

### 17. **Unnecessary Re-renders**

**Issue:** Many components don't use `React.memo` or proper memoization

**Examples:**

- `VersionManager` renders on every parent update
- `ScheduleTable` re-renders entire table on any data change
- No virtualization for large lists

**Recommendation:**

- Add React.memo to pure components
- Use useMemo for expensive calculations
- Consider react-window for large lists

---

### 18. **Bundle Size**

**Concerns:**

- Large libraries imported without code splitting
- No lazy loading of routes
- All components loaded upfront

**Recommendation:**

```tsx
// Lazy load pages
const SchedulePage = lazy(() => import("./pages/SchedulePage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));

// Code split routes
<Route
  path="/schedule"
  element={
    <Suspense fallback={<Loading />}>
      <SchedulePage />
    </Suspense>
  }
/>;
```

---

## Security Concerns 🔒

### 19. **No Input Sanitization**

**Issue:** User inputs not sanitized before display or submission

**Recommendation:**

- Add DOMPurify for HTML content
- Validate all form inputs
- Sanitize before sending to API

---

### 20. **API Error Exposure**

**Issue:** API errors shown directly to users without sanitization

```typescript
toast({
  title: "Error",
  description: error.message, // Raw API error exposed
  variant: "destructive",
});
```

**Recommendation:**

- Map API errors to user-friendly messages
- Don't expose internal error details
- Log detailed errors server-side only

---

## Summary of Recommendations

### Immediate Actions (1-2 days)

1. Fix version state race condition in `useVersionManager`
2. Add error boundaries to App.tsx
3. Fix segment navigation reset issue
4. Remove console.log statements

### Short-term (1 week)

5. Consolidate week state management in SchedulePage
6. Split VersionManager into controlled/uncontrolled versions
7. Standardize query keys
8. Add loading state management improvements

### Medium-term (2-4 weeks)

9. Refactor SchedulePage into smaller components
10. Implement feature-based architecture
11. Add comprehensive test coverage
12. Add validation layer with Zod

### Long-term (1-2 months)

13. Performance optimization (memoization, virtualization)
14. Bundle optimization (code splitting, lazy loading)
15. Implement proper error handling patterns
16. Security improvements

---

## Conclusion

The frontend has a solid foundation with modern React patterns, but suffers from:

- **Complexity**: State management spread across multiple systems
- **Consistency**: Inconsistent patterns for similar functionality
- **Maintenance**: Large components with too many responsibilities
- **Testing**: Limited test coverage for critical paths

The most critical issues revolve around version and week state management, which are central to the application's functionality. Addressing these first will provide the most value.

**Risk Level:** 🟡 Medium - Application works but has potential for bugs and is difficult to maintain

**Recommended Priority Order:**

1. Critical Issues (1-3) - Fix immediately
2. High Priority (4-6) - Fix in next sprint
3. Medium Priority (7-10) - Address in cleanup sprint
4. Low Priority (11-13) - Ongoing improvements
5. Architectural/Testing - Long-term roadmap
