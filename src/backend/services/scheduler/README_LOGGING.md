# Scheduler Logging System

## Overview

The Scheduler component has been enhanced with a comprehensive logging system that provides detailed diagnostic information at various levels. This system ensures that the schedule generation process is fully traceable, helping with debugging and understanding the scheduler's behavior.

## Key Features

- **Unified Logging**: Logs are stored in multiple locations but managed by a single system
- **Step-Based Process Tracking**: Schedule generation is broken down into steps with timing information
- **Diagnostic Summaries**: Concise summaries are stored in the application's diagnostic directory
- **Detailed Debug Logs**: Comprehensive logs with all debug information
- **Integration with Application Logging**: Scheduler logs are integrated with the main application's logging system

## Log Locations

The scheduler logging system writes to three primary locations:

1. **Main Scheduler Logs**: `~/.schichtplan/logs/scheduler_[timestamp]_[session_id].log`
   - Contains detailed debug information
   - Includes timing and performance data
   - Logs all steps and sub-steps

2. **Application Logs**: `src/logs/schedule.log`
   - Key scheduler events integrated with the application's logging
   - Uses the application's standard logging format
   - Includes high-level information about schedule generation

3. **Diagnostic Summaries**: `src/logs/diagnostics/schedule_diagnostic_[session_id].log`
   - Concise summaries of each scheduler run
   - Easy-to-read format for quick analysis
   - Contains start/end times and key metrics

## Using the Logging System

### Setting Up Scheduler with Proper Context

To properly initialize the scheduler with application context and logging:

```python
from src.backend.services.scheduler.utils import setup_scheduler_with_context

# Create scheduler with application context
scheduler = setup_scheduler_with_context(
    log_level=logging.DEBUG,  # Set desired log level
    diagnostic_path=None,     # Optional custom path for diagnostic logs
    config=None               # Optional scheduler configuration
)

# Use the scheduler
result = scheduler.generate_schedule(
    start_date=date(2025, 3, 17),
    end_date=date(2025, 3, 23),
    create_empty_schedules=True
)

# Get log file paths
main_log = scheduler.logging_manager.get_log_path()
diagnostic_log = scheduler.logging_manager.get_diagnostic_log_path()
app_log = scheduler.logging_manager.get_app_log_path()
```

### One-Step Scheduler Testing

For quick testing of the scheduler with proper logging:

```python
from src.backend.services.scheduler.utils import run_scheduler_test
from datetime import date

# Run scheduler test with a single function call
result = run_scheduler_test(
    start_date=date(2025, 3, 17),
    end_date=date(2025, 3, 23),
    create_empty_schedules=True,
    version=None,
    config=None,
    log_level=logging.DEBUG,
    diagnostic_path=None
)
```

## Enhanced LoggingManager API

The `LoggingManager` class has been enhanced with methods to track the scheduling process:

```python
# Start tracking a scheduling process
logging_manager.start_process("Schedule Generation")

# Track individual steps
logging_manager.start_step("Resource Loading")
# ... perform resource loading ...
logging_manager.end_step({"resources_loaded": 10})

# Log detailed data within a step
logging_manager.log_step_data("Employee Count", len(employees))

# End the overall process with statistics
logging_manager.end_process({
    "assignments_created": 25,
    "valid_assignments": 23,
    "invalid_assignments": 2
})
```

## Testing

The scheduler logging system can be tested using the provided example script:

```bash
# Navigate to the scheduler directory
cd src/backend/services/scheduler

# Run the test script
python scheduler_test.py
```

## Debugging with Logs

When debugging scheduler issues:

1. Check the diagnostic summary first (`src/logs/diagnostics/schedule_diagnostic_*.log`)
2. Look for errors in the application log (`src/logs/schedule.log`)
3. Examine detailed debug information in the main scheduler log (`~/.schichtplan/logs/scheduler_*.log`)
4. Use the log timestamps to correlate events across different log files

## Custom Log Paths

You can customize the log file locations:

```python
# Custom log directories
scheduler = setup_scheduler_with_context(
    log_level=logging.DEBUG,
    diagnostic_path="/path/to/custom/diagnostics",
    app_log_dir="/path/to/custom/app_logs"
)
``` 