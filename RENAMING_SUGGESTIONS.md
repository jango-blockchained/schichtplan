# Renaming Suggestions for Shift and Coverage Components

## Current Understanding

The application has two resource types for schedule generation:
- **Shifts**: Fixed shift plan with more conditions
- **Coverage**: More generic scheduling with fewer conditions (only employee amount)

## Frontend Reorganization

We've reorganized the frontend components into separate folders:
- `src/frontend/src/components/shifts-editor/`: Contains all shift-related components
- `src/frontend/src/components/coverage-editor/`: Contains all coverage-related components

## Backend Renaming Suggestions

To make the distinction between shifts and coverage clearer, here are some renaming suggestions for the backend models:

### Option 1: Descriptive Naming

1. Rename `Shift` model to `FixedShift` or `ShiftTemplate`
   - This emphasizes that shifts are fixed templates
   - File: `src/backend/models/fixed_shift.py` or `src/backend/models/shift_template.py`

2. Keep `Coverage` model as is
   - This already clearly indicates its purpose
   - File: `src/backend/models/coverage.py`

### Option 2: Purpose-Based Naming

1. Rename `Shift` model to `ShiftPattern`
   - This emphasizes that shifts define patterns
   - File: `src/backend/models/shift_pattern.py`

2. Rename `Coverage` model to `StaffingRequirement`
   - This emphasizes that coverage defines staffing requirements
   - File: `src/backend/models/staffing_requirement.py`

### Option 3: Resource-Type Prefixing

1. Rename `Shift` model to `ShiftResource`
   - This emphasizes that shifts are a resource type
   - File: `src/backend/models/shift_resource.py`

2. Rename `Coverage` model to `CoverageResource`
   - This emphasizes that coverage is a resource type
   - File: `src/backend/models/coverage_resource.py`

## API Endpoint Renaming

To maintain consistency, the API endpoints should also be renamed:

1. `/api/shifts` → `/api/shift_templates` or `/api/shift_patterns`
2. `/api/coverage` → `/api/coverage` or `/api/staffing_requirements`

## Database Migration

If renaming the models, a database migration will be needed to rename the tables:

1. `shifts` → `fixed_shifts` or `shift_templates` or `shift_patterns`
2. `coverage` → `coverage` or `staffing_requirements`

## Recommendation

**Option 1** (Descriptive Naming) is recommended as it most clearly communicates the purpose of each resource type while maintaining some connection to the original naming. 