## Task Plan: Debug and Fix Schedule Generation

**Goal:** Identify and resolve the root cause of no shifts being assigned during schedule generation.

**Phase 1: Initial Diagnostics & Data Verification**
- [x] **Task 1.1: Review and Enhance Logging**
    - [x] Sub-task 1.1.1: Ensure comprehensive logging is enabled for all relevant scheduler components (`ScheduleGenerator`, `DistributionManager`, `AvailabilityChecker`, `ConstraintChecker`, `ScheduleResources`).
    - [x] Sub-task 1.1.2: Verify that log messages clearly indicate the number of items (employees, shifts, coverage rules) being processed and filtered at each critical step.
    - [x] Sub-task 1.1.3: Ensure diagnostic logs from `ProcessTracker` are being written and are accessible.
- [x] **Task 1.2: Run Standalone Scheduler Test**
    - [x] Sub-task 1.2.1: Utilize `standalone_scheduler_test.py` to bypass Flask context issues and isolate the scheduler logic. This will help confirm if the core scheduling algorithm is functional independent of the web application framework.
    - [x] Sub-task 1.2.2: Analyze the output from the standalone test for errors or warnings during resource loading and the generation process.
- [x] **Task 1.3: Database and Resource Verification**
    - [x] Sub-task 1.3.1: Verify active employees exist with correct configurations (roles, contracts, employment status). Use `scheduler_companion.py --diagnostic` or direct database queries.
    - [x] Sub-task 1.3.2: Verify `ShiftTemplate` records:
        - [x] Confirm `active_days` are correctly set for the period being scheduled (e.g., `["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]` or specific days).
        - [x] Check for any templates with empty, null, or malformed `active_days`. The `scheduler_companion.py --fix-active-days` command can be useful here.
    - [x] Sub-task 1.3.3: Verify `Coverage` rules:
        - [x] Ensure rules exist for the target dates/days of the week.
        - [x] Confirm `min_employees` is greater than zero for shifts that need staffing.
        - [x] Check that `shift_id` in coverage rules correctly references existing `ShiftTemplate` IDs.
    - [x] Sub-task 1.3.4: Examine `Absence` records for the target period to ensure employees are not unexpectedly marked as on leave.
    - [x] Sub-task 1.3.5: Review `EmployeeAvailability` records, ensuring they are not overly restrictive (e.g., too many `UNAVAILABLE` entries) for the required shifts.
- [x] **Task 1.4: Execute Comprehensive Diagnostics with `scheduler_companion.py`**
    - [x] Sub-task 1.4.1: Run `python -m src.backend.tools.debug.scheduler_companion --diagnostic` to get an overview of potential issues.
    - [x] Sub-task 1.4.2: Carefully review the output for reported problems in resource loading, coverage processing, or shift creation logic.

**Phase 2: Deep Dive into Scheduler Logic (Iterative, based on Phase 1 findings)**
- [ ] **Task 2.1: Analyze Resource Loading (`ScheduleResources`)**
    - [ ] Sub-task 2.1.1: If logs indicate "Resource verification failed" or missing resources, step through `ScheduleResources.load()` and `ScheduleResources.verify_loaded_resources()`.
    - [ ] Sub-task 2.1.2: Check database queries within these methods for correctness.
- [ ] **Task 2.2: Analyze Demand Generation (`_process_coverage()` in `generator.py`)**
    - [ ] Sub-task 2.2.1: If logs show "No coverage requirements found" or similar, trace how coverage rules are filtered and applied to specific dates in `_process_coverage()`.
    - [ ] Sub-task 2.2.2: Verify the logic in helper methods like `_coverage_applies_to_date()`.
    - [ ] Outcome: Confirm that the system correctly identifies the need for shifts.
- [ ] **Task 2.3: Analyze Shift Creation (`_create_date_shifts()` in `generator.py`)**
    - [ ] Sub-task 2.3.1: If logs show "No applicable shift templates found" or "No active shifts match coverage needs", trace how `ShiftTemplate`s are filtered and instantiated for specific dates.
    - [ ] Sub-task 2.3.2: Verify the logic in helper methods like `_shift_applies_to_date()`.
    - [ ] Outcome: Confirm that potential shift instances are correctly created based on active templates.
- [ ] **Task 2.4: Analyze Employee Availability (`get_available_employees()` in `distribution.py` via `AvailabilityChecker`)**
    - [ ] Sub-task 2.4.1: If logs show "Available employees for shift type X: 0", then for a specific date and shift, trace how employee availability is determined by `AvailabilityChecker.is_employee_available()`.
    - [ ] Sub-task 2.4.2: Verify that `Absence` records are correctly processed.
    - [ ] Sub-task 2.4.3: Confirm that `EmployeeAvailability` (Fixed, Preferred, Available, UNAVAILABLE) is correctly interpreted.
    - [ ] Outcome: Ensure that the pool of potentially available employees is accurately identified.
- [ ] **Task 2.5: Analyze Assignment Logic (`assign_employees_by_type()` and `assign_employees_with_distribution()` in `distribution.py`)**
    - [ ] Sub-task 2.5.1: If employees and shifts seem available but no assignments occur, step through the assignment logic for a specific shift.
    - [ ] Sub-task 2.5.2: Identify where the process might be prematurely exiting or why no employees are ultimately selected.
    - [ ] Outcome: Pinpoint the failure point within the core assignment and distribution algorithms.
- [ ] **Task 2.6: Analyze Constraint Application (`ConstraintChecker`)**
    - [ ] Sub-task 2.6.1: If available employees are not being assigned, check if work rule constraints are blocking them. Review `ConstraintChecker.exceeds_constraints()`.
    - [ ] Sub-task 2.6.2: Look for specific constraint violation messages in debug logs (e.g., max hours, rest periods, consecutive days).
    - [ ] Sub-task 2.6.3: Consider temporarily relaxing constraints (e.g., increasing max consecutive days, reducing min rest time in `SchedulerConfig`) for testing purposes to see if assignments occur.
    - [ ] Outcome: Determine if scheduling constraints are the primary blocker.

**Phase 3: Solution Implementation and Testing**
- [ ] **Task 3.1: Implement Code/Data Fixes**
    - [ ] Sub-task 3.1.1: Based on findings from Phase 1 & 2, correct issues in the database (e.g., update `active_days` in `ShiftTemplate`, adjust `Coverage` rules, modify `EmployeeAvailability`).
    - [ ] Sub-task 3.1.2: If code logic is flawed, implement necessary changes in the relevant Python files (e.g., filtering logic in `generator.py`, assignment rules in `distribution.py`).
- [ ] **Task 3.2: Clarify and Integrate "Max Shifts Per Week" Constraint**
    - [ ] Sub-task 3.2.1: Determine if "Max Shifts Per Week" (e.g., 5 per week as mentioned in guide) is intended as a hard constraint to be enforced by `ConstraintChecker.exceeds_constraints()` or as a preference in distribution logic.
    - [ ] Sub-task 3.2.2: If it's a hard constraint, modify `ConstraintChecker.exceeds_constraints()` to use `count_weekly_shifts()` and a configurable parameter (e.g., `self.config.max_shifts_per_week`) to block assignments.
    - [ ] Sub-task 3.2.3: If it's a preference, ensure it's correctly implemented in the distribution logic (`distribution.py`) and document its behavior.
    - [ ] Sub-task 3.2.4: Add relevant configuration options to `SchedulerConfig` if a new hard constraint is introduced.
- [ ] **Task 3.3: Retest Schedule Generation Rigorously**
    - [ ] Sub-task 3.3.1: Rerun `standalone_scheduler_test.py` with the fixes.
    - [ ] Sub-task 3.3.2: If the standalone test passes, retest schedule generation through the full application (e.g., `python run.py` and triggering generation via the API or a test script like `test_schedule_generation.py`).
- [ ] **Task 3.4: Test Edge Cases and Variations**
    - [ ] Sub-task 3.4.1: Test with different date ranges, including those spanning month/year boundaries.
    - [ ] Sub-task 3.4.2: Test with varying employee availability and coverage requirements (high demand, low demand, specific employee unavailability).
    - [ ] Sub-task 3.4.3: Test with new employees or employees with recently changed contracts/availability.
- [ ] **Task 3.5: Verify Frontend Display**
    - [ ] Sub-task 3.5.1: Once backend generation is successful, ensure that generated schedules are correctly fetched and displayed in the frontend components (`ScheduleView.tsx`, `ScheduleTable.tsx`).

**Phase 4: Documentation and Cleanup**
- [ ] **Task 4.1: Update Project Documentation**
    - [ ] Sub-task 4.1.1: Update `schichtplan-guide.md` (or relevant sections) with any new insights, common pitfalls discovered, or changes to the scheduling logic, including clarification on the "Max Shifts Per Week" constraint.
    - [ ] Sub-task 4.1.2: Document any changes made to configuration or data requirements.
- [ ] **Task 4.2: Refine Diagnostic Tools**
    - [ ] Sub-task 4.2.1: Enhance `scheduler_companion.py` or other diagnostic scripts based on the debugging experience to make future troubleshooting easier.
- [ ] **Task 4.3: Code Cleanup**
    - [ ] Sub-task 4.3.1: Remove any temporary debugging code, `print()` statements, or overly verbose logging configurations that are no longer needed.
    - [ ] Sub-task 4.3.2: Ensure the codebase is clean, well-commented where necessary, and adheres to project styling guidelines.

This plan should provide a structured approach to resolving the schedule generation issue.
Let me know when you're ready to proceed with the first phase!
