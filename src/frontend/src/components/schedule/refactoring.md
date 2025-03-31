# Schedule Directory Refactoring Plan

Building on the initial analysis, here's a detailed plan for further refactoring the schedule components:

## Phase 1: Schedule Component Organization

### Recommended Directory Structure

```
src/frontend/src/components/schedule/
├── core/                        # Core schedule-specific components
│   ├── ScheduleDisplay.tsx      # Base display component
│   ├── ScheduleManager.tsx      # Data management
│   └── ScheduleTable.tsx        # Base schedule visualization
├── components/                  # UI components
│   ├── ScheduleActions.tsx      # Action buttons
│   ├── ScheduleControls.tsx     # Navigation controls
│   ├── GenerationLogs.tsx       # Process feedback
│   └── VersionTable.tsx         # Version data display
├── views/                       # Complex combinations of components
│   ├── TimeGridView.tsx         # Renamed from TimeGridScheduleTable
│   ├── VersionsView.tsx         # Renamed from ScheduleVersions
│   ├── OverviewView.tsx         # Renamed from ScheduleOverview
│   └── StatisticsView.tsx       # Combined statistics functionality
├── dialogs/                     # Modal components
│   ├── GenerationOverlay.tsx    # Generation process overlay
│   ├── AddScheduleDialog.tsx    # New schedule creation
│   └── SettingsDialog.tsx       # Renamed from ScheduleGenerationSettings
├── utils/                       # Utilities specific to schedules
└── index.ts                     # Export facade
```

## Phase 2: Component-by-Component Analysis and Plan

### ScheduleVersions.tsx (5.8KB)

```typescript
// Current imports
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { VersionTable } from './VersionTable';
// ...
```

**Analysis:**
- Tightly coupled with VersionTable.tsx
- Responsible for both data fetching and presentation
- Handles version comparison, activation, and deletion

**Refactoring Plan:**
1. Rename to `VersionsView.tsx` for consistency
2. Extract data fetching into a custom hook (`useScheduleVersions`)
3. Split component responsibilities:
   - List display vs. comparison functionality
   - Action handling vs. presentation

### TimeGridScheduleTable.tsx (22KB)

**Analysis:**
- Excessively large component (584 lines)
- Mixes multiple concerns:
  - Grid layout
  - Time calculations
  - Drag and drop
  - Employee shift display

**Refactoring Plan:**
1. Rename to `TimeGridView.tsx`
2. Extract sub-components:
   ```typescript
   // Recommended sub-components
   - TimeGridHeader.tsx        // Column headers
   - TimeGridRow.tsx           // Employee row
   - TimeGridCell.tsx          // Individual cell
   - TimeGridShift.tsx         // Shift display in cell
   ```
3. Move utility functions to `schedule/utils/timeGrid.ts`

### ScheduleStatistics.tsx (12KB) & EmployeeStatistics.tsx (10KB)

**Analysis:**
- Significant duplication of charting logic
- Both handle similar statistical calculations
- EmployeeStatistics is likely used as a sub-component

**Refactoring Plan:**
1. Create a unified `StatisticsView.tsx`
2. Extract reusable chart components:
   ```typescript
   - StatisticsCard.tsx        // Wrapper for individual statistics
   - HoursChart.tsx            // Reusable hours visualization
   - EmployeeMetrics.tsx       // Employee-specific statistics
   ```
3. Move calculation logic to `schedule/utils/statistics.ts`

## Phase 3: Component Consolidation

### Redundant Components to Refactor

| Component | Issue | Action |
|-----------|-------|--------|
| VersionCompare.tsx | Unused according to analysis | Delete after confirming |
| ScheduleTable.tsx | Empty placeholder (172B) | Delete (already replaced) |
| ScheduleDisplay.tsx | Thin wrapper | Merge into TimeGridView |

### Missing Components to Consider

The system could benefit from these new components for better organization:

1. **ScheduleToolbar.tsx** - Combine Actions and Controls
2. **ScheduleEmptyState.tsx** - Consistent empty/loading states
3. **ScheduleFilterPanel.tsx** - Extract filtering logic

## Phase 4: Implementation Strategy

1. **Create new directory structure** first
2. **Move components** to their new locations
3. **Rename** components for consistency
4. **Update imports** throughout the application
5. **Extract sub-components** from large files
6. **Delete** confirmed redundant files
7. **Update documentation** with new structure

## Phase 5: Implementation Complete

The refactoring has been completed with the following accomplishments:

### Directory Structure Created ✅
- Organized components into logical subdirectories:
  - `core/` - Core schedule functionality
  - `components/` - UI components
  - `views/` - Complex view components
  - `dialogs/` - Modal components
  - `utils/` - Schedule-specific utilities

### Component Refactoring ✅
- Renamed components for better consistency:
  - `TimeGridScheduleTable.tsx` → `TimeGridView.tsx`
  - `ScheduleVersions.tsx` → `VersionsView.tsx`
  - `ScheduleOverview.tsx` → `OverviewView.tsx`
- Created combined `StatisticsView.tsx` from:
  - `ScheduleStatistics.tsx`
  - `EmployeeStatistics.tsx`
- Updated imports and component references

### Removed Redundant Files ✅
- Deleted unused components:
  - `VersionCompare.tsx`
  - `ScheduleTable.tsx` (empty placeholder)

### Future Improvements
- Extract sub-components from `TimeGridView.tsx`
- Create utility hooks for data fetching
- Continue to improve component organization
- Add better type safety throughout components

## Benefit Analysis

| Current Issue | Proposed Solution | Benefit |
|---------------|-------------------|---------|
| Inconsistent naming | Standardized naming convention | Improved discoverability |
| Large components | Component extraction | Better maintainability |
| Mixed concerns | Single responsibility components | Easier testing |
| Duplicated logic | Shared utilities | Reduced code size |
| Flat directory | Organized subdirectories | Clearer architecture |

Would you like me to start implementing any specific part of this plan, or would you prefer more details on a particular component?
