# Schedule Generation Tests

This directory contains tests for the schedule generation functionality in the Schichtplan application.

## Overview

The schedule generation tests are designed to verify that the schedule generator correctly handles various constraints, edge cases, and business rules. The tests are organized into several modules:

- `test_schedule_generation_extended.py`: Extended tests for schedule generation with comprehensive validation and edge cases.
- `test_schedule_constraints.py`: Tests for schedule generation with different constraints such as employee availability, shift requirements, and business rules.
- `test_schedule_generation_api.py`: Tests for the schedule generation API endpoints.

## Running the Tests

You can run all the schedule generation tests using the `run_schedule_tests.py` script in the project root:

```bash
python run_schedule_tests.py
```

Or you can run individual test modules:

```bash
# Run extended schedule generation tests
python -m src.backend.tests.schedule.test_schedule_generation_extended

# Run schedule constraints tests
python -m src.backend.tests.schedule.test_schedule_constraints

# Run schedule generation API tests
python -m pytest src.backend.tests.api.test_schedule_generation_api.py
```

## Test Modules

### Extended Schedule Generation Tests

The `test_schedule_generation_extended.py` module includes the following tests:

- **Basic Schedule Generation**: Tests basic schedule generation for a week.
- **Edge Case: No Employees**: Tests schedule generation with no active employees.
- **Edge Case: No Shifts**: Tests schedule generation with no active shifts.
- **Schedule with Specific Constraints**: Tests schedule generation with specific constraints like keyholders and weekly limits.
- **Schedule Validation**: Tests the schedule validation functionality separately.
- **Performance Scaling**: Tests schedule generation performance with different date ranges.

### Schedule Constraints Tests

The `test_schedule_constraints.py` module includes the following tests:

- **Keyholder Constraint**: Tests that the schedule generator respects the keyholder constraint.
- **Weekly Hours Constraint**: Tests that the schedule generator respects weekly hour limits.
- **Rest Time Constraint**: Tests that the schedule generator respects minimum rest time between shifts.
- **Employee Availability Constraint**: Tests that the schedule generator respects employee availability.
- **Shift Requirements Constraint**: Tests that the schedule generator respects shift minimum employee requirements.

### Schedule Generation API Tests

The `test_schedule_generation_api.py` module includes the following tests:

- **Generate Schedule Endpoint**: Tests the generate schedule endpoint.
- **Generate Schedule Invalid Dates**: Tests the generate schedule endpoint with invalid dates.
- **Generate Schedule Missing Parameters**: Tests the generate schedule endpoint with missing parameters.
- **Generate Schedule Invalid Version**: Tests the generate schedule endpoint with an invalid version.
- **Generate Schedule Long Period**: Tests the generate schedule endpoint with a long period.
- **Get Schedules Endpoint**: Tests the get schedules endpoint after generating schedules.
- **Schedule Version Management**: Tests schedule version management through the API.

## Test Data

The tests use a combination of real data from the database and test data created specifically for the tests. The test data includes:

- Employees with different attributes (contracted hours, keyholder status, etc.)
- Shifts with different requirements (min/max employees, active days, etc.)
- Settings with different constraints (keyholder requirement, weekly hour limits, etc.)
- Availabilities for employees

## Test Results

The tests produce detailed logs that include:

- Test execution time
- Number of schedules generated
- Number of warnings and errors
- Specific constraint violations
- Performance metrics

The logs are written to the console and can be redirected to a file if needed.

## Adding New Tests

To add new tests, you can:

1. Add new test functions to the existing modules
2. Create new test modules in the `src/backend/tests/schedule` directory
3. Add the new modules to the `TEST_MODULES` list in the `run_schedule_tests.py` script

When adding new tests, make sure to:

- Clean up any test data created during the test
- Restore any settings or data modified during the test
- Add appropriate assertions to verify the test results
- Add detailed logging to help diagnose test failures 