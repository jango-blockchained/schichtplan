# Scheduler Module Instructions

These instructions apply when working with files in `src/backend/services/scheduler/`.

## Module Overview

The scheduler module is the core of the scheduling algorithm, handling complex shift generation with:
- Interval-based coverage requirements
- Keyholder constraint enforcement
- Employee availability and skill matching
- Compliance with labor laws and company policies

## Key Files

- `generator.py` - Main ScheduleGenerator class (coordinates generation flow)
- `resources.py` - ScheduleResources (data loading and caching)
- `validator.py` - ScheduleValidator (rule validation and constraint checking)
- `utility.py` - Utility functions (shift classification, time calculations)

## Critical Concepts

### Coverage is Interval-Based
DO NOT assume shift templates define all staffing needs. The system:
1. Calculates required staff for EACH time interval (e.g., every 15-60 minutes)
2. Takes MAX(`min_employees`) when coverage periods overlap
3. Combines requirements from multiple coverage records

### Keyholder Logic
Keyholders must be present:
- X minutes BEFORE store opening
- Y minutes AFTER store closing
- These values are configured in Settings and enforced during validation

## Coding Guidelines

### Performance
- Use caching in ScheduleResources for repeated data access
- Avoid N+1 queries - preload related entities
- Profile with `instance/logs/diagnostics/` output before optimizing

### Logging
- Use scheduler-specific logger: `from src.backend.utils.logger import logger`
- Log to `instance/logs/schedule.log` for detailed generation steps
- Include diagnostic context (schedule_id, employee_id, shift details)

### Testing
- Test with real-world scenarios from `src/backend/tools/scheduler/`
- Validate edge cases: split weeks, month boundaries, keyholder constraints
- Check performance with large employee pools (50+ employees)

### Error Handling
- Raise descriptive exceptions (e.g., `InsufficientCoverageError`)
- Include context in error messages (which interval, which requirement failed)
- Never silently ignore validation failures

## Common Pitfalls

1. **Forgetting interval aggregation**: Coverage requirements overlap and combine
2. **Ignoring keyholder timing**: Not accounting for pre-opening/post-closing time
3. **Missing availability checks**: Assigning shifts when employee is unavailable
4. **Hard-coding time values**: Always use Settings for configurable values
5. **Incomplete validation**: Must validate ALL constraints before finalizing schedule

## Refactoring Guidelines

- Keep generator.py as coordinator only (no business logic)
- Move validation logic to validator.py
- Extract complex calculations to utility.py
- Maintain separation of concerns between modules

## Debugging Resources

When scheduler issues occur:
1. Check `instance/logs/schedule.log` for detailed generation trace
2. Use diagnostic tools in `src/backend/tools/debug/`
3. Review test harnesses in `src/backend/tools/scheduler/`
4. Enable verbose logging in generator.py temporarily

## Documentation

Update `src/backend/services/scheduler/README.md` when making architectural changes.
