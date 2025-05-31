# Schichtplan Task Plan (Prioritized & Checklist Format)

## 🚦 Execution Order (Priority)

1. Complete backend scheduler assignment logic and scoring
2. Ensure backend data consistency and validation
3. Refactor fragile imports and demo data safeguards
4. Consolidate constraint and coverage logic
5. Refactor frontend to align with backend data
6. Expand tests and perform manual QA
7. Update documentation and developer experience
8. Profile performance and improve monitoring

---

## ✅ Task Checklist

### 1. Backend: Scheduler Assignment Logic
- [ ] Implement core assignment loop in `distribution.py` (`assign_employees_for_day` and related methods)
    - [ ] Iterate through shifts and identify available employees
    - [ ] Score employee-shift pairs
    - [ ] Select best employees for each shift
    - [ ] Create `ScheduleAssignment` records
- [ ] Integrate scoring adjustments:
    - [ ] Implement `_calculate_history_adjustment_v2` for fair distribution
    - [ ] Implement `_calculate_preference_adjustment_v2` for employee preferences
    - [ ] Integrate other planned scoring factors (workload, overstaffing, ML hooks)
- [ ] Refactor `_save_to_database` in `generator.py` for bulk insertion
- [ ] Standardize data structures (dicts vs. objects) throughout scheduler logic
- [ ] Implement `_load_employee_preferences` in `DistributionManager`

### 2. Backend: Data Consistency and Validation
- [ ] Refactor fragile import mechanisms in `resources.py`, `availability.py`, `constraints.py`, `coverage_utils.py`
- [ ] Validate and clean up data:
    - [ ] Ensure all shift assignments include complete time data
    - [ ] Add comprehensive validation during data loading (shift times, coverage rules, etc.)
    - [ ] Investigate and resolve inconsistent use of `getattr`/`hasattr`
- [ ] Safeguard demo data generation (disable in production)

### 3. Backend: Constraint and Coverage Logic
- [ ] Consolidate constraint checking to a single, consistent approach
- [ ] Replace broad exception handling with specific error types
- [ ] Review and clarify coverage overlap and fallback logic

### 4. Frontend: Data Handling and UI Improvements
- [ ] Refactor frontend data mapping/grouping logic in `ScheduleTable.tsx` and related components
- [ ] Remove frontend workarounds for missing time data or duplicate entries
- [ ] Simplify state management in hooks like `useScheduleData.ts` and `useVersionControl.ts`

### 5. Testing and Validation
- [ ] Expand backend tests for assignment logic, data validation, and constraints
- [ ] Add/extend frontend tests for UI and data handling
- [ ] Perform manual QA for schedule generation with various data scenarios

### 6. Documentation and Developer Experience
- [ ] Update developer docs for new assignment logic, data structures, and API changes
- [ ] Add code comments in complex or refactored areas
- [ ] Review and update README for setup, development, and troubleshooting

### 7. Performance and Monitoring
- [ ] Profile schedule generation and optimize bottlenecks
- [ ] Improve logging for clarity and context
- [ ] Monitor logs and error reports for regressions

---

*Copy this checklist into your GitHub project board or use it to track progress in your team meetings. Each task can be split into individual issues as needed.* 