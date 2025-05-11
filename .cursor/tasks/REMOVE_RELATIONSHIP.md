# Plan: Decouple Shift ID from Coverage and Implement Interval-Based Coverage

**User Goal:** Coverage should define the number of employees needed per hour or per 15-minute interval on a weekly basis. The `start_time` and `end_time` fields on the `Coverage` model are to be considered UI-only for the coverage editor and should NOT be used by backend logic (e.g., scheduler) to define or match coverage periods directly.

## Phase 1: Backend - `Coverage` Data Interpretation & New Utilities

1.  **Verify `Coverage` Model (`src/backend/models/coverage.py`):**
    - [x] Confirm that `day_index`, `start_time`, `end_time`, `min_employees`, `employee_types`, etc., exist.
    - [x] **Decision:** No database schema changes to `Coverage` model are planned initially. `start_time` and `end_time` will remain for the editor UI but will be re-interpreted by the backend. `min_employees` within a `Coverage` record (defined by its `start_time`, `end_time`, `day_index`) will now mean that this many employees are required for *each granular interval* (e.g., 15-minute or hourly) within that span.
2.  **Create New Utility: `get_required_staffing_for_interval(date: datetime.date, interval_start_time: datetime.time, resources: ScheduleResources) -> Dict`**
    - [x] Location: e.g., `src/backend/services/scheduler/coverage_utils.py` (new file) or `utility.py`.
    - [x] Inputs: `date`, `interval_start_time` (e.g., `datetime.time` object for start of a 15-min/1-hour slot), and `resources` (to access `resources.coverage`).
    - [x] Logic:
        - [x] Determine `day_index` from `date`.
        - [x] Iterate through `Coverage` records in `resources.coverage`.
        - [x] A `Coverage` record applies if:
            - [x] Its `day_index` matches.
            - [x] The `interval_start_time` falls within the `Coverage` record's `start_time` and `end_time` (inclusive of start, exclusive of end).
        - [x] Handle Overlaps: If multiple `Coverage` records apply to the same `interval_start_time`:
            - [x] The primary requirement (e.g., `min_employees`) should be the maximum found across overlapping records for that interval.
            - [x] Combine other requirements (e.g., `employee_types`, `requires_keyholder`) appropriately (e.g., union of types, OR for boolean flags). This needs careful definition.
        - [x] Output: A dictionary detailing staffing needs for that specific interval (e.g., `{'min_employees': 2, 'employee_types': ['A', 'B'], 'requires_keyholder': True}`). If no coverage applies, return needs indicating zero staff.
    - [x] Consider the granularity (15-min vs. 1-hour) as a configurable setting or an internal standard.

## Phase 2: Backend - Scheduler Logic Refactoring (`src/backend/services/scheduler/`)

1.  **Refactor/Remove `ScheduleGenerator._process_coverage()` (`generator.py`):**
    - [x] This method's current logic of creating `shift_needs` keyed by `coverage_id` (which was then misused as `shift_id`) is obsolete.
    - [x] Remove this method or repurpose it if any part of its date-checking logic is reusable for the new utility. The core task of "determining needs per shift" is gone.
2.  **Refactor `ScheduleGenerator._generate_assignments_for_date()` (`generator.py`):**
    - [x] **Stop using output from the old `_process_coverage()`**.
    - [x] **Create Shift Instances:** The call to `_create_date_shifts()` to get all potential `Shift` instances (based on `ShiftTemplate`s) for the `current_date` remains valid. Let this list be `potential_daily_shifts`.
    - [x] **Remove Old Filtering Logic:** The section that filters `date_shifts` into `truly_needed_shift_instances` based on `shift_needs` must be removed.
    - [x] **Delegate to `DistributionManager`:** The core assignment logic will now reside in `DistributionManager`. It will take `potential_daily_shifts` and use `get_required_staffing_for_interval()` to make assignments.
3.  **Major Refactor `DistributionManager` (`distribution.py`):** (See detailed plan in [.cursor/tasks/DISTRIBUTION_REFACTORING.md](mdc:.cursor/tasks/DISTRIBUTION_REFACTORING.md))
    - [x] The primary method (e.g., `assign_employees_to_shifts` or a new one like `generate_assignments_for_coverage`) will now be responsible for the entire assignment process for a day. (**Mostly Done - Testing Pending**)
    - [x] Inputs updated. (Done)
    - [x] Core Logic for interval-based assignment. (Done - see sub-plan)
    - [x] Output assignment list. (Done)
4.  **Refactor `ScheduleValidator._validate_coverage()` (`validator.py`):**
    - [x] Completely rewrite. (**Verified: Already implemented interval-based logic**)
    - [x] Logic:
        - [x] For each date in the generated schedule:
            - [x] Iterate through all relevant time intervals of the day (e.g., every 15 minutes).
            - [x] For each interval:
                - [x] Call `get_required_staffing_for_interval()` to get the defined requirements.
                - [x] Count the actual number of *assigned employees* whose shifts cover this interval. Also, collect their attributes (types, keyholder status).
                - [x] Compare actual staffing with required staffing.
                - [x] Log any discrepancies (understaffing, overstaffing, unmet type/keyholder requirements) as `ValidationError`s.
    - [x] **Remove any logic that uses `Coverage.start_time` or `Coverage.end_time` for matching.** (**Verified: Not used**)

## Phase 3: Backend - Other Services and Models

1.  **`ScheduleResources._load_coverage()` (`resources.py`):**
    - [x] No changes expected here, as it primarily loads data from the DB. The re-interpretation happens in the new utility and scheduler logic. (**NA**)
2.  **`Coverage` Model (`src/backend/models/coverage.py`):**
    - [x] As per Phase 1, no DB schema changes planned. The fields `start_time` and `end_time` will be understood as UI-only for the editor by all backend processing logic. (**NA**)

## Phase 4: API Endpoints (`src/backend/routes/`)

1.  **Coverage Endpoints (e.g., `src/backend/api/coverage.py`):**
    - [x] No changes to request/response structure if the `Coverage` model fields are kept for the editor. The backend will interpret the saved `start_time`, `end_time`, and `min_employees` according to the new interval-based logic. (**NA**)
2.  **Schedule Generation Endpoints (e.g., in `src/backend/routes/schedule.py`):**
    - [x] The request payload (start/end date for generation) likely remains the same.
    - [x] The response structure (list of assignments) also likely remains the same.
    - [x] The internal implementation that these endpoints call will be significantly different. (**NA - Interface Unchanged**)

## Phase 5: Frontend (`src/frontend/`)

1.  **Coverage Editor Component (`src/frontend/src/components/coverage-editor/`?):**
    - [ ] This component will continue to use `start_time` and `end_time` for its visual representation and for defining blocks of coverage.
    - [ ] Ensure it correctly saves `Coverage` records where `min_employees` applies to the entire span defined by `start_time` and `end_time` for a given `day_index`. The backend will then break this span into smaller intervals.
2.  **Schedule Display Components (e.g., `ScheduleTable.tsx`):**
    - [ ] These components display assigned shifts. They might not need major changes unless they were also trying to display "coverage requirements" directly linked to shifts.
3.  **Schedule Statistics (e.g., `ScheduleStatistics.tsx`):**
    - [ ] If statistics were calculated based on the old interpretation of `Coverage` (e.g., "coverage fulfillment per shift"), this will need to change.
    - [ ] New statistics might involve: "percentage of intervals meeting staffing requirements," "total understaffed hours," etc., based on the new interval-based validation.

## Phase 6: Testing

1.  **New Unit Tests:**
    - [x] `get_required_staffing_for_interval()`: Test with various `Coverage` configurations, overlaps, and different intervals.
    - [P] `DistributionManager`: Mock `get_required_staffing_for_interval` and test various scenarios of shift availability and employee assignment to meet interval needs. This will be complex. (Paused due to persistent linter issues when adding tests in `test_distribution_interval.py`)
2.  **Updated Unit/Integration Tests:**
    - [ ] `ScheduleGenerator`: Test the overall orchestration, ensuring it calls the refactored `DistributionManager` correctly.
    - [ ] `ScheduleValidator`: Test the new coverage validation logic extensively.
3.  **End-to-End Tests:**
    - [ ] Define various `Coverage` scenarios (via fixtures or API).
    - [ ] Define `ShiftTemplate`s and `Employee` data.
    - [ ] Trigger schedule generation.
    - [ ] Verify that the generated schedule meets the interval-based coverage requirements as closely as possible and that the `ScheduleValidator` reports correctly.

## Phase 7: Documentation

1.  - [ ] Update any internal developer documentation regarding the `Coverage` model and the scheduling logic to reflect these changes.
2.  - [ ] Clarify how overlapping `Coverage` entries from the editor are resolved into per-interval requirements (e.g., max `min_employees` applies).

**Key Challenges & Considerations:**

*   **Complexity of `DistributionManager`:** The new logic for assigning shifts to meet interval-based coverage is significantly more complex than the previous model. It's an optimization problem that may require sophisticated algorithms or heuristics for good performance and results.
*   **Performance:** Calculating requirements for every 15-minute interval and then trying to meet them with a set of discrete shifts can be computationally intensive.
*   **Defining "Met" Coverage:** How to handle situations where it's impossible to perfectly meet coverage for all intervals (e.g., due to lack of available staff or restrictive shift templates). The system will need rules for prioritizing or relaxing constraints.
*   **Clarity of Coverage Definition:** Ensure the business logic for how multiple `Coverage` records combine their requirements for a single interval is clearly defined and implemented in `get_required_staffing_for_interval`. 