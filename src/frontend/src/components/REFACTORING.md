# Component Refactoring Documentation

## Overview

This document describes the refactoring of the `shifts` and `schedule` components to improve code organization, reduce duplication, and enhance maintainability.

## New Directory Structure

```
src/frontend/src/components/
├── shifts/
│   ├── core/             # Core components shared between shifts and schedule
│   │   ├── ShiftTable.tsx
│   │   ├── types.ts
│   │   └── index.ts
│   ├── editor/           # Shift editing components
│   │   └── ...
│   ├── views/            # Visualization components
│   │   ├── ShiftCoverageView.tsx
│   │   ├── types.ts
│   │   └── index.ts
│   ├── utils/            # Shared utility functions
│   │   ├── timeCalculator.ts
│   │   └── index.ts
│   ├── components/       # Legacy components (wrappers around core)
│   │   ├── ShiftTable.tsx
│   │   ├── ShiftCoverageView.tsx
│   │   └── ...
│   ├── types/            # Shared type definitions
│   │   └── index.ts
│   ├── ShiftForm.tsx     # Root-level components
│   ├── ShiftTypesEditor.tsx
│   └── index.ts          # Main exports
├── schedule/
│   ├── core/             # Core schedule components
│   │   └── ...
│   ├── views/            # Schedule-specific views
│   │   ├── ShiftCoverageView.tsx (wrapper)
│   │   └── ...
│   ├── shared/           # Shared utilities and components
│   │   ├── utils.ts
│   │   └── index.ts
│   ├── shifts/           # Schedule-specific shift components
│   │   ├── ShiftTable.tsx (wrapper)
│   │   └── ...
│   └── index.ts          # Main exports
```

## Component Relationships

### ShiftTable Component

The `ShiftTable` component has been refactored into a core implementation with two wrapper components:

1. **Core Implementation**: `shifts/core/ShiftTable.tsx`
   - Handles both weekly schedule display and shift template display
   - Supports drag-and-drop functionality
   - Provides validation for shift rules
   - Supports both compact and full views

2. **Shifts Wrapper**: `shifts/components/ShiftTable.tsx`
   - Uses the core implementation with shifts-specific defaults
   - Maintains backward compatibility for existing code

3. **Schedule Wrapper**: `schedule/shifts/ShiftTable.tsx`
   - Uses the core implementation with schedule-specific defaults
   - Maintains backward compatibility for existing code

### ShiftCoverageView Component

The `ShiftCoverageView` component has been refactored similarly:

1. **Core Implementation**: `shifts/views/ShiftCoverageView.tsx`
   - Visualizes shifts across days of the week
   - Shows keyholder times
   - Supports both shift templates and schedules

2. **Shifts Wrapper**: `shifts/components/ShiftCoverageView.tsx`
   - Uses the core implementation with shifts-specific defaults
   - Maintains backward compatibility for existing code

3. **Schedule Wrapper**: `schedule/views/ShiftCoverageView.tsx`
   - Uses the core implementation with schedule-specific defaults
   - Maintains backward compatibility for existing code

### Utility Functions

Utility functions have been consolidated in `shifts/utils/timeCalculator.ts` and re-exported where needed:

- Time parsing and formatting
- Shift duration calculations
- Position calculations for visualization
- Validation functions

## Usage Examples

### Using the ShiftTable Component

```tsx
// In shifts context
import { ShiftTable } from '@/components/shifts/components';

// In schedule context
import { ShiftTable } from '@/components/schedule/shifts';

// Direct use of core component (with all options)
import { ShiftTable } from '@/components/shifts/core';
```

### Using the ShiftCoverageView Component

```tsx
// In shifts context
import { ShiftCoverageView } from '@/components/shifts/components';

// In schedule context
import { ShiftCoverageView } from '@/components/schedule/views';

// Direct use of core component (with all options)
import { ShiftCoverageView } from '@/components/shifts/views';
```

## Benefits of Refactoring

1. **Reduced Code Duplication**: Consolidated duplicate components and utilities
2. **Improved Type Safety**: Consistent type usage across components
3. **Better Organization**: Clear separation of concerns and component responsibilities
4. **Enhanced Maintainability**: Easier to update and extend functionality
5. **Backward Compatibility**: Existing code continues to work without changes

## Phase 1: Restructuring (Completed)

We've reorganized the component structure to follow a more logical organization:

- **core/shifts**: Base components shared across different features
- **shift-templates**: Components specific to shift template management
- **schedule**: Components specific to schedule management
- **employees**: Employee management components

## Phase 2: Cleanup Plan (Completed)

We cleaned up redundant files and updated imports to use the new structure:

### Files Deleted
- `src/frontend/src/components/shifts/core/ShiftTable.tsx` (moved to core/shifts)
- `src/frontend/src/components/shifts/core/types.ts` (moved to core/shifts)
- `src/frontend/src/components/shifts/utils/timeCalculator.ts` (moved to core/shifts/utils)
- `src/frontend/src/components/shifts/ShiftTypesEditor.tsx` (moved to shift-templates)
- `src/frontend/src/components/shifts/components/ShiftEditor.tsx` (moved to shift-templates as ShiftTemplateEditor)
- `src/frontend/src/components/shifts/components/ShiftForm.tsx` (moved to shift-templates as ShiftTemplateForm)
- `src/frontend/src/pages/EmployeePage.tsx` (redundant, using EmployeesPage instead)

### Import Updates
All relevant imports have been updated to point to the new locations:

- `@/components/shifts/core` → `@/components/core/shifts`
- `@/components/shifts/utils` → `@/components/core/shifts/utils`
- `@/components/shifts/components/ShiftEditor` → `@/components/shift-templates/components/ShiftTemplateEditor`

### Naming Conventions

We've established consistent naming conventions:

1. **Shift Instance Components**
   - Use plain names: `ShiftTable`, `ShiftForm`
  
2. **Shift Template Components**
   - Always use the `-template` suffix: `ShiftTemplateEditor`, `ShiftTemplateForm`
  
3. **Schedule Components**
   - Use schedule-specific prefixes: `ScheduleShiftTable`

## Phase 3: Final Testing (Completed)

We've completed the testing phase of the refactoring:

1. Updated import paths in all components using the old structures:
   - Fixed ShiftsPage to use ShiftTemplateEditor from shift-templates
   - Updated OptionsPage to use the new ShiftTypesEditor path
   - Updated SettingsPage imports

2. Fixed type definitions:
   - Added ShiftType to shift-templates/types.ts
   - Updated ShiftTypesEditor to use the imported type

3. Added new test files:
   - Created core/shifts/__tests__/ShiftTable.test.tsx for testing the core ShiftTable
   - Created shift-templates/__tests__/ShiftTemplateEditor.test.tsx for testing the template editor

4. All components now use the correct imports from the new directory structure.

## Current Project Structure

After refactoring, the project structure is now:

```
src/frontend/src/components/
├── core/                    # Core reusable components
│   └── shifts/              # Core shift components
│       ├── utils/           # Time calculation utilities
│       ├── __tests__/       # Core component tests
│       ├── ShiftTable.tsx   # Core shift table implementation
│       └── types.ts         # Common types
├── shift-templates/         # Shift template management
│   ├── components/          # Template editing components
│   ├── __tests__/           # Template component tests
│   ├── ShiftTypesEditor.tsx # Shift type management
│   └── types.ts             # Template-specific types
├── schedule/                # Schedule management
│   ├── shifts/              # Schedule-specific shift components
│   ├── shared/              # Shared utilities
│   └── views/               # Schedule visualization
└── shifts/                  # Legacy structure (re-exports from core)
    ├── components/          # Legacy components
    └── views/               # Legacy visualization
```

## Future Improvements

1. Complete migration of remaining shift components
2. Enhance type definitions for better type safety
3. Expand test coverage for all components
4. Document the component architecture with detailed diagrams