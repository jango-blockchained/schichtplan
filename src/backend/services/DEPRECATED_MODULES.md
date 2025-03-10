# Deprecated Modules

This document tracks modules that are deprecated and scheduled for removal.

## `services.schedule_generator`

**Replaced by:** `services.scheduler` package

### Deprecation Timeline

- **Phase 1: Compatibility Layer (Current)**
  - Added deprecation warnings
  - Imports from new scheduler package
  - Original file remains functional

- **Phase 2: Usage Audit (2 weeks)**
  - Review application logs for any direct usage of the deprecated module
  - Identify and update any remaining code that uses the original module
  - Create compatibility shims where needed

- **Phase 3: Feature Freeze (1 month)**
  - No new features or fixes for the original module
  - All development should use the new scheduler package
  - Add more explicit warnings in logs when the original module is used

- **Phase 4: Removal (2 months)**
  - Remove the original `schedule_generator.py` file
  - Update any documentation references
  - Clean up imports

### Migrating Code

To migrate from the old module to the new package:

```python
# OLD
from services.schedule_generator import ScheduleGenerator, ScheduleGenerationError
from services.schedule_generator import is_early_shift, is_late_shift, requires_keyholder

# NEW
from services.scheduler import ScheduleGenerator, ScheduleGenerationError
from services.scheduler import is_early_shift, is_late_shift, requires_keyholder
```

Additional utilities available in the new package:

```python
from services.scheduler import (
    time_to_minutes,
    shifts_overlap,
    time_overlaps,
    calculate_duration,
    calculate_rest_hours
)
```

### Backward Compatibility Notes

- All public APIs from the original module are maintained in the new package
- The `ScheduleConfig` class in the new package provides more configuration options
- The validator component is now separated and can be used independently 