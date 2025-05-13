# Schedule Generation Special Days Integration

## Task ID: TASK-20240710-Schedule-Generation-Integration
## Status: pending
## Priority: high
## Dependencies: TASK-20240710-Settings-Refactor, TASK-20240710-Backend-Holiday-API

## Description
Integrate the special days/holidays feature with the schedule generation engine to ensure that no shifts are assigned on days when the store is closed due to holidays or special events.

## Requirements

### Core Functionality
1. Extend schedule generation to check for special days
2. Skip shift assignments on days where `is_closed` is true
3. Apply custom hours for special days where provided
4. Update scheduler logging to include special days handling

### Integration Points
- Update `ScheduleGenerator` class in backend scheduler service
- Modify availability checking logic in `AvailabilityChecker`
- Update resource loading in `ScheduleResources`

## Implementation Steps

### Step 1: Update Schedule Resources
Extend the `ScheduleResources` class to load special days:

```python
# In src/backend/services/scheduler/resources.py
def load_resources(self, version_id=None):
    # Existing resource loading code...
    
    # Load settings including special days
    settings = self.db.query(Settings).first()
    special_days = settings.special_days if settings and hasattr(settings, 'special_days') else {}
    
    # Convert to internal format and add to resources
    self.special_days = {
        date: {
            'is_closed': details.get('is_closed', False),
            'description': details.get('description', ''),
            'custom_hours': details.get('custom_hours', None)
        }
        for date, details in special_days.items()
    }
    
    return self
```

### Step 2: Update Schedule Generator
Modify the schedule generation logic to check for special days:

```python
# In src/backend/services/scheduler/generator.py
def _create_date_shifts(self):
    # Existing code...
    
    for date in self.date_range:
        date_str = date.strftime('%Y-%m-%d')
        
        # Check if this is a special day that's closed
        if (date_str in self.resources.special_days and 
            self.resources.special_days[date_str]['is_closed']):
            self.logger.debug(f"Skipping shift creation for {date_str} - store closed (special day)")
            continue
            
        # For special days with custom hours, adjust shift times
        custom_hours = None
        if (date_str in self.resources.special_days and 
            self.resources.special_days[date_str].get('custom_hours')):
            custom_hours = self.resources.special_days[date_str]['custom_hours']
            self.logger.debug(f"Using custom hours for {date_str}")
        
        # Create shifts for this date
        # Rest of existing logic, possibly adjusted for custom_hours...
```

### Step 3: Update Availability Checker
Modify the availability checker to include special days:

```python
# In src/backend/services/scheduler/availability.py
def is_employee_available(self, employee_id, date, shift_id):
    # Check if the date is a special closed day first
    date_str = date.strftime('%Y-%m-%d')
    if (date_str in self.resources.special_days and 
        self.resources.special_days[date_str]['is_closed']):
        return False
        
    # Rest of existing availability logic...
```

### Step 4: Update Scheduler Logging
Add logging for special days handling:

```python
# In src/backend/services/scheduler/logging_utils.py or generator.py
def _log_special_days(self):
    special_days_in_range = {}
    for date in self.date_range:
        date_str = date.strftime('%Y-%m-%d')
        if date_str in self.resources.special_days:
            special_days_in_range[date_str] = self.resources.special_days[date_str]
    
    if special_days_in_range:
        self.logger.info(f"Special days in schedule range: {len(special_days_in_range)}")
        for date, details in special_days_in_range.items():
            status = "CLOSED" if details['is_closed'] else "CUSTOM HOURS"
            self.logger.debug(f"Special day: {date} - {status} - {details['description']}")
```

### Step 5: Add Scheduler Diagnostics
Update the scheduler diagnostic tools to include special days information:

```python
# In src/backend/tools/debug/scheduler_companion.py
def diagnostic_special_days():
    """Check special days configuration and impact on scheduling"""
    settings = db.session.query(Settings).first()
    special_days = settings.special_days if settings and hasattr(settings, 'special_days') else {}
    
    print(f"Special days configured: {len(special_days)}")
    
    # Get current schedule range
    # Check how many schedule dates would be affected
    # Display warnings for any issues
```

### Step 6: Update Frontend Schedule Components
Ensure schedule view components display information about special days:

```typescript
// In src/frontend/src/components/Schedule/ScheduleTable.tsx
// Add visual indicators for special days in the schedule table

// In src/frontend/src/hooks/useScheduleGeneration.ts
// Update to handle special days information from backend
```

## Technical Considerations

### Performance Impact
- Minimal additional overhead as special days checks are lightweight
- Consider optimizing by pre-filtering date ranges that don't intersect with any special days

### Edge Cases
- Handle timezone differences correctly for special days
- Consider what happens when a special day is added/removed after a schedule is generated
- Define behavior for recurring special days spanning multiple years

### Migration Considerations
- Ensure backward compatibility with existing schedule data
- Add data validation for special days format

## Testing Approach
1. Unit tests:
   - Test special days checking logic
   - Test behavior with various special day configurations
   
2. Integration tests:
   - Verify schedule generation with special days present
   - Test edge cases (first/last day of schedule is special, etc.)
   
3. Manual testing:
   - Create schedules with known special days
   - Verify UI correctly displays special day information

## Acceptance Criteria
1. Schedule generation correctly skips assignments on closed special days
2. Custom hours are respected for relevant special days
3. UI properly indicates special days in the schedule view
4. Scheduler logs provide clear information about special days handling
5. Diagnostic tools report on special days configuration and impact

## Documentation Updates
1. Update scheduler documentation to describe special days handling
2. Document the format and structure of special days data
3. Add troubleshooting information for special days issues