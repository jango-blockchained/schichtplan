# Event Types Feature

## Overview
Event Types are a new category in the Schichtplan system designed to track informational events that don't directly affect employee scheduling like absences do. They are useful for marking special days in the calendar for awareness and planning purposes.

## Purpose

Event Types vs Absence Types:

- **Absence Types** (URL, KRANK, SCH): Track when employees are unavailable and cannot work
  - Directly affect schedule generation
  - Reduce available staff count
  - Require schedule adjustments

- **Event Types** (SPECIAL_OFFER, INVENTORY, TRAINING): Mark informational events
  - Don't affect employee availability
  - Used for awareness and planning
  - Help managers prepare for special situations

## Default Event Types

The system comes with three pre-configured event types:

1. **SPECIAL_OFFER (Sonderangebot)** - Purple (#9C27B0)
   - Use for: Special offer days, promotional events
   - Purpose: Alert staff that higher customer volume is expected
   - Example: "Black Friday Sale"

2. **INVENTORY (Inventur)** - Gray (#607D8B)
   - Use for: Inventory counting days
   - Purpose: Plan for reduced regular operations during inventory
   - Example: Annual store inventory

3. **TRAINING (Schulung)** - Teal (#009688)
   - Use for: Training events, team meetings
   - Purpose: Mark days when training or meetings are scheduled
   - Example: "Product knowledge training"

## Technical Implementation

### Frontend Types
```typescript
export interface EventType {
  id: string;
  name: string;
  color: string;
  description?: string;
  type: "event_type";
}

export type GroupType = EmployeeType | AbsenceType | EventType;
```

### Backend Model
```python
event_types = Column(
    JSON,
    nullable=True,
    default=lambda: [
        {
            "id": "SPECIAL_OFFER",
            "name": "Sonderangebot",
            "color": "#9C27B0",
            "description": "Special offer day - informational only",
            "type": "event_type",
        },
        # ... more default types
    ],
)
```

### Settings Storage
Event types are stored in the `settings` table under the `event_types` JSON column, and are accessible via:
- Backend: `Settings.event_types`
- Frontend: `settings.employee_groups.event_types`

## Usage

### Managing Event Types (Future Enhancement)
Currently, event types are managed through the settings system. Future enhancements could include:
- UI for adding/editing/removing event types
- Assigning event types to specific dates in the calendar
- Displaying event types in the schedule view
- Filtering schedules by event types
- Reporting on events

### API Access
Event types are included in the settings API response:
```json
{
  "employee_groups": {
    "employee_types": [...],
    "shift_types": [...],
    "absence_types": [...],
    "event_types": [
      {
        "id": "SPECIAL_OFFER",
        "name": "Sonderangebot",
        "color": "#9C27B0",
        "description": "Special offer day - informational only",
        "type": "event_type"
      }
    ]
  }
}
```

## Migration

A database migration is provided to add the `event_types` column to existing installations:

```bash
# Apply migration
flask db upgrade
```

The migration file: `src/backend/migrations/versions/add_event_types_column.py`

## Future Enhancements

Potential improvements for event types:

1. **Calendar Integration**: Display event types in calendar views
2. **Event Management UI**: Add/edit/delete event types in settings
3. **Event Assignment**: Assign events to specific dates
4. **Event Notifications**: Alert staff about upcoming events
5. **Event Reporting**: Analytics on events and their impact
6. **Event Templates**: Pre-defined event templates for common scenarios
7. **Recurring Events**: Support for recurring event patterns

## Related Files

### Frontend
- `src/frontend/src/types/index.ts` - TypeScript type definitions
- `src/frontend/src/hooks/useSettings.ts` - Default settings with event types
- `src/frontend/src/pages/UnifiedSettingsPage.tsx` - Settings merge logic

### Backend
- `src/backend/models/settings.py` - Settings model with event_types column
- `src/backend/migrations/versions/add_event_types_column.py` - Database migration

## Examples

### Example Use Cases

1. **Promotional Event**
   ```json
   {
     "id": "PROMO_2024_Q1",
     "name": "Q1 Clearance Sale",
     "color": "#9C27B0",
     "description": "Expect 50% increase in customer volume",
     "type": "event_type"
   }
   ```

2. **Annual Inventory**
   ```json
   {
     "id": "INVENTORY_2024",
     "name": "Annual Inventory Count",
     "color": "#607D8B",
     "description": "Store closes at 4 PM for inventory",
     "type": "event_type"
   }
   ```

3. **Team Training**
   ```json
   {
     "id": "SAFETY_TRAINING",
     "name": "Safety Training Workshop",
     "color": "#009688",
     "description": "Mandatory safety training 2-4 PM",
     "type": "event_type"
   }
   ```
