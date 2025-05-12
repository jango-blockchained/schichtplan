# Plan: Refactor DistributionManager for Interval-Based Coverage

**Context:** This plan details the refactoring of `DistributionManager` as part of the larger effort described in [.cursor/tasks/REMOVE_RELATIONSHIP.md](mdc:.cursor/tasks/REMOVE_RELATIONSHIP.md) to decouple shift assignments from a direct link to `Coverage` records and instead use interval-based staffing requirements.

**Overall Goal for `DistributionManager`:** To assign employees to a list of `potential_daily_shifts` in a way that satisfies staffing requirements for granular time intervals (e.g., 15-minute or hourly slots) throughout a given `current_date`. These interval-based requirements are determined by the new `get_required_staffing_for_interval` utility.

## Phase 1: Adapt Entry Point and Core Logic Structure

1.  **Rename/Adapt Main Assignment Method:**
    *   [x] The `ScheduleGenerator` now calls `distribution_manager.generate_assignments_for_day(...)`.
    *   [x] Locate the existing main assignment method (likely `assign_employees_with_distribution` or similar).
    *   [x] Rename or adapt it to `generate_assignments_for_day`.
    *   [x] Update its signature to accept: `current_date: datetime.date`, `potential_shifts: List[Dict]`, `resources: ScheduleResources`, `constraint_checker: ConstraintChecker`, `availability_checker: AvailabilityChecker`.
    *   [x] The old `coverage` (or `shift_needs`) parameter is no longer passed directly, as this information will be fetched per interval using `resources` and `get_required_staffing_for_interval`.
2.  **New Core Logic Outline within `generate_assignments_for_day`:**
    *   [x] Initialize an empty list for `final_assignments_for_day`.
    *   [x] Define the time interval granularity (e.g., `INTERVAL_MINUTES = 15`). This could be a class constant or configurable.
    *   [x] **Loop through Time Intervals:** Iterate from the beginning to the end of `current_date` in `INTERVAL_MINUTES` steps.
        *   [x] For each `interval_start_time`:
            *   [x] Call `get_required_staffing_for_interval(current_date, interval_start_time, resources, interval_duration_minutes=INTERVAL_MINUTES)` to get `current_interval_needs` (a dictionary with `min_employees`, `employee_types`, `requires_keyholder`, etc.).
            *   [x] This `current_interval_needs` is the target to meet for this specific time slot.
    *   [x] **Shift-to-Interval Mapping:** Determine how each shift in `potential_shifts` covers these time intervals. (Done with `_get_intervals_covered_by_shift` and pre-processing step in `_perform_interval_based_assignments`)
    *   [x] **Assignment Strategy (High-Level - Details in Phase 2):** Structure defined, call to `_perform_interval_based_assignments` added.
    *   [x] Return `final_assignments_for_day`.

## Phase 2: Develop the Interval-Based Assignment Algorithm

This is the most complex part and will likely require iterative development.

1.  **Represent Daily Staffing State:**
    *   [x] Create a data structure to track the staffing levels for each interval throughout the day as assignments are made (`current_staffing_per_interval` initialized in `generate_assignments_for_day` and updated in `_perform_interval_based_assignments`).
2.  **Algorithm Ideas (to be explored and refined):**
    *   [x] **Chosen Approach for Initial Implementation: Option A: Interval-Driven Assignment.**
3.  **Implement Interval-Driven Assignment in `_perform_interval_based_assignments`:**
    *   [x] Sort `daily_interval_needs.keys()` to process intervals chronologically.
    *   [x] Loop through sorted intervals.
    *   [x] Check for understaffing in `min_employees`.
    *   [x] If understaffed: Identify relevant `potential_shifts` (those covering the current interval).
    *   [x] Define `_try_find_and_make_assignment` structure.
    *   **Inside `_try_find_and_make_assignment`:**
        *   [x] Iterate candidate shifts/employees.
        *   [x] Check if employee already assigned today.
        *   [x] Check availability.
        *   [x] Check constraints.
        *   [x] Implement scoring logic (`calculate_assignment_score` using `_v2` helpers).
        *   [x] Select best candidate (highest score).
        *   [x] Make assignment (create assignment dictionary).
        *   [x] Update staffing state (Done in `_perform_interval_based_assignments`).
        *   [x] Update employee history (Via `update_with_assignment`).
4.  **Integrating Existing Logic:**
    *   [x] Methods like `calculate_assignment_score`, `_calculate_history_adjustment_v2`, `_calculate_preference_adjustment_v2`, `get_available_employees` (implicitly used), etc., are integrated into the new scoring/selection process.
    *   [x] The concept of `AvailabilityType` (FIX, PRF, AVL) is respected in checks and scoring.
    *   [x] Constraint checking (`constraint_checker.check_all_constraints`) is performed (assuming method exists).
5.  **Handling Specific Needs:**
    *   [x] **`employee_types` / `allowed_employee_groups`:** Factored into `calculate_assignment_score`.
    *   [x] **`requires_keyholder`:** Factored into `calculate_assignment_score`.
6.  **Managing Overstaffing/Understaffing:**
    *   [x] Basic understaffing check drives the assignment loop.
    *   [x] Overstaffing penalty implemented in `calculate_assignment_score`.

## Phase 3: Helper Functions and Data Structures

1.  **`_get_intervals_covered_by_shift`:**
    *   [x] Added helper to calculate intervals a shift covers.
2.  **`is_interval_covered(interval_start_time, interval_needs, current_staffing_for_interval_entry) -> bool`:**
    *   [x] A helper to check if a specific interval's needs (min_employees, types, keyholder) are met by the current staffing for that interval.
3.  **`get_employees_working_during_interval(interval_start_time, all_final_assignments) -> List[Employee]`:**
    *   [x] Helper to get a list of employees (and their properties) who are actually working during a specific interval based on the `final_assignments_for_day`.
4.  **Time Conversion Utilities:**
    *   [x] Addressed by importing `_time_str_to_datetime_time` from `coverage_utils.py`.

## Phase 4: Output and Integration

1.  **Assignment Object:**
    *   [x] Structure created in `_try_find_and_make_assignment`.
2.  **Logging:**
    *   [x] Logging implemented throughout the new functions.

## Phase 5: Refinement and Testing

1.  **Unit Tests:**
    *   [ ] Extensive unit tests for the new assignment algorithm, covering various scenarios of needs, shift availability, and employee availability.
2.  **Iterative Refinement:**
    *   [ ] The assignment algorithm will likely need tuning based on test results and observed behavior.

**Initial Focus for Implementation:**

*   [x] Start with adapting the main method signature (`generate_assignments_for_day`).
*   [x] Implement the basic loop through time intervals and fetching `current_interval_needs`.
*   [x] Develop simple assignment strategy (Full strategy implemented). 