# Schedule Generator Diagnostic Tool

## Overview

The Schedule Generator Diagnostic Tool is a comprehensive testing and debugging utility designed to identify issues, bottlenecks, and potential improvements in the schedule generation process. It provides detailed logging of each step, performance metrics, and actionable recommendations.

## Features

- Detailed step-by-step logging of the entire scheduling process
- Identification of performance bottlenecks
- Database state validation and issue detection
- Detailed error reporting and root cause analysis
- Automatic recommendations for resolving identified issues
- Performance statistics and metrics
- JSON output for integration with other tools

## Usage

There are two ways to run the diagnostic tool:

### Option 1: Direct Script

```bash
# From the project root directory
python src/backend/tools/debug/schedule_generator_diagnostic.py --start-date 2023-05-01 --end-date 2023-05-07
```

### Option 2: Command-line Wrapper (Recommended)

```bash
# From the project root directory
python src/backend/tools/diagnose_scheduler.py [options]
```

## Command-line Options

```
Date Options:
  --start-date START_DATE   Start date in YYYY-MM-DD format
  --end-date END_DATE       End date in YYYY-MM-DD format
  --days DAYS               Number of days if no dates provided (default: 7)
  --next-week               Use next week for date range

Output Options:
  --quiet                   Reduce console output
  --json                    Output results in JSON format
```

## Examples

```bash
# Run diagnostic for the current week
python src/backend/tools/diagnose_scheduler.py

# Run diagnostic for a specific date range
python src/backend/tools/diagnose_scheduler.py --start-date 2023-05-01 --end-date 2023-05-07

# Run diagnostic for next week
python src/backend/tools/diagnose_scheduler.py --next-week

# Run diagnostic and output results in JSON format
python src/backend/tools/diagnose_scheduler.py --json > diagnostic_results.json
```

## Understanding the Output

The diagnostic tool outputs information in several formats:

### Console Output

The console output provides a summary of the diagnostic run, including:

- Session ID and log file location
- Key statistics about the schedule generation
- Performance bottlenecks identified
- Recommendations for resolving issues

### Log File

The detailed log file contains:

- Timestamps for each action
- Hierarchical logging with steps and substeps
- Colored output for different message types
- Complete error traces
- Performance metrics for each step
- Detailed validation results

Log files are stored in the `logs/diagnostics` directory with names like `schedule_diagnostic_{session_id}.log`.

### JSON Results

The JSON results file contains structured data including:

- Session information
- Date range used
- Statistics on employees, shifts, and schedule entries
- Performance bottlenecks with timing information
- Complete list of recommendations
- Error and warning counts

JSON result files are stored in the `logs/diagnostics` directory with names like `diagnostic_result_{session_id}.json`.

## Interpreting Results

### Common Issues and Solutions

#### No assignments made

If the diagnostic reports zero assignments made, check:
- Employee availability data
- Shift templates
- Coverage requirements
- Constraints that might be too restrictive

#### Performance bottlenecks

If specific steps are identified as bottlenecks:
- For assignment bottlenecks: Consider simplifying constraints or optimizing the assignment algorithm
- For validation bottlenecks: Consider reducing validation rules or optimizing validation process
- For database bottlenecks: Check indexes and query performance

#### High error count

If many errors are reported:
- Check the log file for detailed error messages
- Review database state including employees, shifts, and coverage requirements
- Check for inconsistent data or missing required values

## Debugging with the Tool

The diagnostic tool can be used for iterative debugging:

1. Run the diagnostic to identify issues
2. Fix the most critical issues identified
3. Run the diagnostic again to confirm fixes and identify remaining issues
4. Repeat until all issues are resolved

## Adding Custom Diagnostics

To extend the tool with custom diagnostics:

1. Open `src/backend/tools/debug/schedule_generator_diagnostic.py`
2. Locate the `run_diagnostic` method in the `ScheduleGeneratorDiagnostic` class
3. Add your custom diagnostic code in the appropriate section
4. Use the provided logging methods (`_log_step`, `_log_info`, etc.) to maintain consistent logging

## Integration with Development Workflow

This diagnostic tool is designed to be part of the development workflow:

- Run before implementing changes to establish a baseline
- Run after implementing changes to verify improvements
- Include in CI/CD pipelines to detect regressions
- Use during debugging sessions to pinpoint issues

## Troubleshooting the Diagnostic Tool

If the diagnostic tool itself encounters issues:

- Make sure you're running it from the project root directory
- Check that all required dependencies are installed
- Ensure the database is accessible
- Check permissions for creating log files
- Check for syntax errors if you've modified the tool

For persistent issues, check the error messages in the console output or contact the project maintainers. 