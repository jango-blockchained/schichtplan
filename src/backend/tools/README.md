# Schichtplan Development Tools

This directory contains various tools and utilities for development, testing, and maintenance of the Schichtplan application.

## Directory Structure

### Data Management

- **db_operations/**: Tools for database operations and fixes
  - Database checking, fixing, and maintenance scripts

- **migrations/**: Database migration tools
  - Scripts for managing database versions and schema changes
  - Tools for resetting and rebuilding the database

- **data_generators/**: Sample data creation tools
  - Scripts to generate test employees, shifts, and demo data

### Development Tools

- **debug/**: Debugging utilities
  - Tools for diagnosing and fixing issues in the application

- **performance/**: Performance testing tools
  - Scripts for measuring and analyzing application performance

- **test_runners/**: Test execution utilities
  - Tools for running specific tests or test suites

### Validation & Utility

- **validators/**: Data validation tools
  - Scripts for checking data integrity and correctness
  - Verification tools for various application components

- **utility/**: General utility scripts
  - Miscellaneous helper tools

- **initialization/**: Setup and initialization scripts
  - Tools for initial application setup
  - Database creation and initialization

- **updates/**: Data update utilities
  - Scripts for updating application data
  - One-time fixes and migrations

- **scheduler/**: Scheduler-specific tools
  - Scripts for testing and generating schedules

## Usage

Most tools can be run directly with Python:

```bash
python -m src.backend.tools.[subdirectory].[script_name]
```

For example:

```bash
# Initialize the database
python -m src.backend.tools.initialization.init_db

# Run a specific test
python -m src.backend.tools.test_runners.run_single_test TestSchedule.test_schedule_creation
```

Some tools require the application context and should be run from the project root. 