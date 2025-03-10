# Scheduler Package

This package contains the components for generating and validating employee schedules in the Schichtplan application.

## Overview

The scheduler was refactored from the original monolithic `schedule_generator.py` file into this modular package structure to improve maintainability, readability, and testability.

## Components

The package consists of the following modules:

### `generator.py`

Contains the `ScheduleGenerator` class which is the main entry point for schedule generation. It:
- Coordinates the overall schedule generation process
- Applies business rules and constraints
- Handles error conditions and generation failures

### `resources.py`

Contains the `ScheduleResources` class which:
- Loads and manages all data resources needed for scheduling
- Provides methods to access employees, shifts, absences, etc.
- Encapsulates database access for the scheduler

### `validator.py`

Contains the `ScheduleValidator` class which:
- Validates generated schedules against business rules
- Identifies and reports validation errors
- Provides detailed error information through `ValidationError` objects

### `utility.py`

Contains utility functions used across the scheduler components:
- `is_early_shift()`: Determines if a shift starts early in the morning
- `is_late_shift()`: Determines if a shift ends late in the evening
- `requires_keyholder()`: Checks if a shift requires a keyholder

## Usage

```python
from services.scheduler import ScheduleGenerator

# Create a generator instance
generator = ScheduleGenerator()

# Generate a schedule
result = generator.generate_schedule("2023-01-01", "2023-01-07", True)
```

## Configuration

The schedule validation can be configured through the `ScheduleConfig` class:

```python
from services.scheduler import ScheduleGenerator, ScheduleConfig

config = ScheduleConfig(
    enforce_min_coverage=True,
    enforce_contracted_hours=True,
    enforce_keyholder=True,
    enforce_rest_periods=True,
    min_rest_hours=11
)

generator = ScheduleGenerator(config=config)
```

## Validation Errors

Validation errors are represented by the `ValidationError` class with the following properties:
- `error_type`: The type of validation error
- `message`: Human-readable error message
- `severity`: 'critical', 'warning', or 'info'
- `details`: Additional details about the error 