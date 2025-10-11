# SchedulePage Refactoring Guide

## Problem Statement

SchedulePage currently has **duplicate and conflicting state management** for week navigation:

1. **Manual week state** - `currentWeek` and `dateRange` useState hooks with manual calculations
2. **Version manager** - `useVersionManager` hook managing versions
3. **Custom navigation functions** - Manual `navigateToWeek`, `navigatePrevious`, `navigateNext` that duplicate `useWeekBasedVersionControl` logic

This leads to:

- State synchronization bugs
- Complex maintenance
- No single source of truth
- Over 200 lines of navigation code that already exists in a hook

## Solution

Replace all manual state management with `useSchedulePageNavigation` hook.

---

## Before (Current SchedulePage.tsx)

```typescript
// ❌ Problem: Manual state management (lines 291-520)
export function SchedulePage() {
  // Manual week state
  const [currentWeek, setCurrentWeek] = useState(() => {
    // ... complex calculation
  });

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    // ... complex calculation
  });

  // Version manager (separate from week state)
  const versionManager = useVersionManager({
    dateRange,
    onVersionSelected: (version) => { ... },
    autoSelectLatest: true,
  });

  // Manual navigation functions (duplicates useWeekBasedVersionControl)
  const navigateToWeek = useCallback((weekIdentifier: string) => {
    setCurrentWeek(weekIdentifier);
    // Parse week identifier
    // Calculate dates
    // Update date range
    // Reset version
  }, []);

  const navigatePrevious = useCallback(() => {
    // Parse current week
    // Calculate previous week
    // Handle year boundaries
    navigateToWeek(newWeekIdentifier);
  }, [currentWeek, navigateToWeek]);

  const navigateNext = useCallback(() => {
    // Parse current week
    // Calculate next week
    // Handle year boundaries
    navigateToWeek(newWeekIdentifier);
  }, [currentWeek, navigateToWeek]);

  // Helper to filter versions (duplicates version manager logic)
  const getVersionsForCurrentDateRange = useCallback(() => {
    // Filter versions by date range
  }, [dateRange, versionState.versions]);

  // ~200 lines of state management code...
}
```

---

## After (Refactored SchedulePage.tsx)

```typescript
// ✅ Solution: Use consolidated hook
import { useSchedulePageNavigation } from "@/hooks/useSchedulePageNavigation";

export function SchedulePage() {
  // Single hook replaces all manual state management
  const {
    // Week state
    currentWeek,
    dateRange,
    currentWeekInfo,

    // Navigation
    navigateToWeek,
    navigateToPreviousWeek,
    navigateToNextWeek,

    // Versions (pre-filtered for current date range)
    selectedVersion,
    versions,
    versionActions,

    // Segment management (split mode)
    currentSegment,
    handleSegmentChange,
    weekSegments,

    // Settings
    weekNavigationSettings,

    // Loading
    isLoading,
  } = useSchedulePageNavigation({
    autoSelectLatestVersion: true,
  });

  // That's it! ~200 lines reduced to ~20 lines
  // All state is synchronized automatically
}
```

---

## Migration Steps

### Step 1: Add Import

```typescript
import { useSchedulePageNavigation } from "@/hooks/useSchedulePageNavigation";
```

### Step 2: Replace State Declarations

**Remove these lines (291-376):**

```typescript
const [currentWeek, setCurrentWeek] = useState(/* ... */);
const [dateRange, setDateRange] = useState<DateRange>(/* ... */);
const versionManager = useVersionManager(/* ... */);
const getVersionsForCurrentDateRange = useCallback(/* ... */);
const validVersionsForCurrentRange = getVersionsForCurrentDateRange();
```

**Replace with:**

```typescript
const {
  currentWeek,
  dateRange,
  currentWeekInfo,
  navigateToWeek,
  navigateToPreviousWeek,
  navigateToNextWeek,
  selectedVersion,
  versions,
  versionActions,
  currentSegment,
  handleSegmentChange,
  weekSegments,
  weekNavigationSettings,
  isLoading: isNavigationLoading,
} = useSchedulePageNavigation({
  autoSelectLatestVersion: true,
});
```

### Step 3: Remove Navigation Functions

**Remove these functions (393-520):**

```typescript
const getWeeksInYear = useCallback(/* ... */);
const navigateToWeek = useCallback(/* ... */);
const navigatePrevious = useCallback(/* ... */);
const navigateNext = useCallback(/* ... */);
```

**They're provided by the hook:**

- `navigateToPreviousWeek()` replaces `navigatePrevious()`
- `navigateToNextWeek()` replaces `navigateNext()`
- `navigateToWeek(weekId)` stays the same

### Step 4: Update Version References

**Change:**

```typescript
const { state: versionState, actions: versionActions } = versionManager;
const { selectedVersion, isLoading: isLoadingVersions } = versionState;
const effectiveSelectedVersion = /* complex logic */;
```

**To:**

```typescript
// Hook already provides filtered selectedVersion
// No need for effectiveSelectedVersion - it's handled internally
```

### Step 5: Update WeekNavigator Component

**Change:**

```typescript
<WeekNavigator
  currentWeekInfo={/* manual calculation */}
  onNavigatePrevious={navigatePrevious}
  onNavigateNext={navigateNext}
  // ...
/>
```

**To:**

```typescript
<WeekNavigator
  currentWeekInfo={currentWeekInfo}
  onNavigatePrevious={navigateToPreviousWeek}
  onNavigateNext={navigateToNextWeek}
  currentSegment={currentSegment}
  onSegmentChange={handleSegmentChange}
  weekNavigationSettings={weekNavigationSettings}
/>
```

### Step 6: Update VersionManager Component

**Change:**

```typescript
<VersionManager
  dateRange={dateRange}
  versions={validVersionsForCurrentRange}
  selectedVersion={effectiveSelectedVersion}
  // ...
/>
```

**To:**

```typescript
<VersionManager
  dateRange={dateRange}
  versions={versions} // Already filtered
  selectedVersion={selectedVersion} // Already validated
  // ...
/>
```

### Step 7: Remove Debug Logging

**Remove these console.log statements:**

```typescript
console.log("📅 SchedulePage Debug:");
console.log("📅 Current week:", currentWeek);
// ... all the debug logs
```

**Already handled by the hook's debug logger (dev mode only)**

---

## Benefits

### Code Reduction

- **Before:** ~230 lines of state management
- **After:** ~20 lines with hook
- **Savings:** 210 lines (91% reduction)

### Single Source of Truth

- ✅ Week state managed by `useWeekBasedVersionControl`
- ✅ Version state managed by `useVersionManager`
- ✅ Automatic synchronization between them
- ✅ No manual state updates needed

### Bug Fixes

- ✅ No more state synchronization issues
- ✅ No more race conditions between week and version state
- ✅ Proper segment reset on week changes
- ✅ Consistent behavior across all navigation

### Maintainability

- ✅ Logic is centralized and testable
- ✅ Changes to navigation affect all pages using the hook
- ✅ Easier to understand and debug
- ✅ TypeScript types are enforced

---

## Testing Checklist

After migration, test these scenarios:

- [ ] Navigate between weeks (previous/next buttons)
- [ ] Direct week navigation (calendar picker)
- [ ] Version selection persists within same week
- [ ] Version selection clears when changing weeks
- [ ] Auto-select latest version works
- [ ] Split mode segment navigation
- [ ] Segment resets to 1 on week change
- [ ] No console errors
- [ ] No state synchronization bugs
- [ ] Loading states show correctly

---

## Breaking Changes

**None** - The hook provides the same API, just consolidated.

---

## Backward Compatibility

All existing component props remain the same:

- `WeekNavigator` - same props
- `VersionManager` - same props
- `ScheduleManager` - same props

The only changes are internal to SchedulePage.

---

## Example: Full Migration Diff

```diff
export function SchedulePage() {
-  const [currentWeek, setCurrentWeek] = useState(() => {
-    const today = new Date();
-    const year = today.getFullYear();
-    const startOfYear = new Date(year, 0, 1);
-    const weekNumber = Math.ceil(((today.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
-    return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
-  });
-
-  const [dateRange, setDateRange] = useState<DateRange>(() => {
-    const today = new Date();
-    const startOfWeek = new Date(today);
-    startOfWeek.setDate(today.getDate() - today.getDay() + 1);
-    const endOfWeek = new Date(startOfWeek);
-    endOfWeek.setDate(startOfWeek.getDate() + 6);
-    return { from: startOfWeek, to: endOfWeek };
-  });
-
-  const versionManager = useVersionManager({
-    dateRange,
-    onVersionSelected: (version) => {
-      console.log("📅 SchedulePage: Version selected:", version);
-    },
-    autoSelectLatest: true,
-  });
-
-  const { state: versionState, actions: versionActions } = versionManager;
-  const { selectedVersion, isLoading: isLoadingVersions } = versionState;
-
-  const getVersionsForCurrentDateRange = useCallback(() => {
-    if (!dateRange?.from || !dateRange?.to) return [];
-    const currentFrom = format(dateRange.from, 'yyyy-MM-dd');
-    const currentTo = format(dateRange.to, 'yyyy-MM-dd');
-    return versionState.versions.filter(version => {
-      const versionStart = version.date_range.start;
-      const versionEnd = version.date_range.end;
-      return versionStart === currentFrom && versionEnd === currentTo;
-    });
-  }, [dateRange, versionState.versions]);
-
-  const validVersionsForCurrentRange = getVersionsForCurrentDateRange();
-  const effectiveSelectedVersion = selectedVersion &&
-    validVersionsForCurrentRange.some(v => v.version === selectedVersion)
-    ? selectedVersion
-    : undefined;
-
-  const navigateToWeek = useCallback((weekIdentifier: string) => {
-    setCurrentWeek(weekIdentifier);
-    try {
-      const [year, week] = weekIdentifier.split('-W');
-      const yearNum = parseInt(year);
-      const weekNum = parseInt(week);
-      // ... 50 lines of date calculation
-      setDateRange({ from: startOfWeek, to: endOfWeek });
-    } catch (error) {
-      console.error('Error navigating to week:', error);
-    }
-    versionActions.resetVersionSelection();
-  }, [versionActions]);
-
-  const navigatePrevious = useCallback(() => {
-    // ... 30 lines of previous week logic
-  }, [currentWeek, navigateToWeek]);
-
-  const navigateNext = useCallback(() => {
-    // ... 30 lines of next week logic
-  }, [currentWeek, navigateToWeek]);

+  const {
+    currentWeek,
+    dateRange,
+    currentWeekInfo,
+    navigateToWeek,
+    navigateToPreviousWeek,
+    navigateToNextWeek,
+    selectedVersion,
+    versions,
+    versionActions,
+    currentSegment,
+    handleSegmentChange,
+    weekSegments,
+    weekNavigationSettings,
+    isLoading: isNavigationLoading,
+  } = useSchedulePageNavigation({
+    autoSelectLatestVersion: true,
+  });

  // Rest of component stays the same...
  return (
    <div>
      <WeekNavigator
        currentWeekInfo={currentWeekInfo}
-       onNavigatePrevious={navigatePrevious}
+       onNavigatePrevious={navigateToPreviousWeek}
-       onNavigateNext={navigateNext}
+       onNavigateToNextWeek={navigateNext}
+       currentSegment={currentSegment}
+       onSegmentChange={handleSegmentChange}
+       weekNavigationSettings={weekNavigationSettings}
      />
      <VersionManager
        dateRange={dateRange}
-       versions={validVersionsForCurrentRange}
+       versions={versions}
-       selectedVersion={effectiveSelectedVersion}
+       selectedVersion={selectedVersion}
      />
    </div>
  );
}
```

---

## Next Steps

1. ✅ Create `useSchedulePageNavigation` hook (DONE)
2. ⏳ Apply migration to SchedulePage
3. ⏳ Test all navigation scenarios
4. ⏳ Remove old code and console.logs
5. ⏳ Update documentation

---

## Questions?

If you encounter issues during migration:

1. Check that `useWeekBasedVersionControl` is imported
2. Verify `useVersionManager` types match
3. Look at debug output (dev mode only)
4. Consult this guide for prop mappings
