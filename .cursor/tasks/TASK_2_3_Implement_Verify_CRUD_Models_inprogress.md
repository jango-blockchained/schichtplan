# Task: Implement/Verify Full CRUD for All Core Models

**ID:** TASK_2_3_Implement_Verify_CRUD_Models
**Status:** in_progress
**Priority:** High
**Category:** Backend Stability & Core Features

**Description:**
Ensure that all core data models (Employee, ShiftTemplate, Coverage, Absence, EmployeeAvailability, Schedule/Assignment, Version) have fully functional and tested CRUD (Create, Read, Update, Delete) operations exposed via API routes where necessary.

**Progress:**
- Verified the existence of API routes providing CRUD operations for:
    - Employee (partially, via validation task)
    - Absence (partially, via validation task)
    - EmployeeAvailability (partially, via validation task)
    - ShiftTemplate (`src/backend/routes/shifts.py`)
    - Coverage (`src/backend/api/coverage.py`)
- Created initial test files and basic CRUD test cases for:
    - ShiftTemplate API routes (`src/backend/tests/api/test_shifts_api.py`)
    - Coverage API routes (`src/backend/tests/api/test_coverage_api.py`)

**Next Steps:**
- Verify CRUD operations and testing for remaining core models: Schedule/Assignment and Version.
- Ensure comprehensive unit test coverage for all CRUD endpoints (including invalid input, edge cases) for all core models.
- Update task status to completed once all core models have verified and tested CRUD operations.
