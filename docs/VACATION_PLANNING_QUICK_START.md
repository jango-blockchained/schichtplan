# Vacation Planning Feature - Quick Start Guide

## What Was Implemented

A comprehensive vacation planning system that considers:

- **Store opening days** - from settings (which days of the week store is open)
- **Special days** - holidays and custom hours (from settings)
- **Weekends** - automatically excluded from working days
- **Working day calculation** - accurate count of actual working days vs calendar days

## Backend Components

### 1. Service: `VacationPlanningService`

**Location:** `src/backend/services/vacation_planning.py`

Provides vacation validation logic:

```python
from src.backend.services.vacation_planning import VacationPlanningService

service = VacationPlanningService()

# Check if store is open on a date
is_open = service.is_store_open_on_date(date(2024, 12, 25))

# Get working days in period
working_days = service.get_working_days_in_range(
    date(2024, 12, 23),
    date(2024, 12, 27)
)

# Validate vacation dates
analysis = service.validate_vacation_dates(
    date(2024, 12, 23),
    date(2024, 12, 27)
)
```

### 2. Endpoints: Two new REST API endpoints

**POST /api/v2/absences/validate**

```bash
curl -X POST http://localhost:5000/api/v2/absences/validate \
  -H "Content-Type: application/json" \
  -d '{"start_date": "2024-12-23", "end_date": "2024-12-27"}'
```

Returns:

- `working_days` - count of working days
- `closed_days` - count of non-working days
- `warnings` - list of warning messages
- `closed_day_list` - detailed info about each closed day

**POST /api/v2/absences/period-summary**

```bash
curl -X POST http://localhost:5000/api/v2/absences/period-summary \
  -H "Content-Type: application/json" \
  -d '{"start_date": "2024-12-23", "end_date": "2024-12-27"}'
```

Returns breakdown of working and closed days for the period.

## How Store Calendar is Configured

### 1. Store Opening Days

In Settings (Monday=0, Sunday=6):

```json
{
  "0": true, // Monday - open
  "1": true, // Tuesday - open
  "2": true, // Wednesday - open
  "3": true, // Thursday - open
  "4": true, // Friday - open
  "5": false, // Saturday - closed
  "6": false // Sunday - closed
}
```

### 2. Special Days

In Settings:

```json
{
  "2024-12-25": {
    "name": "Weihnachtstag",
    "is_closed": true,
    "is_holiday": true
  },
  "2024-12-31": {
    "name": "Silvester",
    "is_closed": false,
    "custom_hours": {
      "opening": "09:00",
      "closing": "16:00"
    }
  }
}
```

## Using in Frontend

### Example: Show vacation analysis to user

```typescript
// Frontend code in VacationPlanningPage or Modal

const handleValidateVacation = async (startDate: string, endDate: string) => {
  try {
    const response = await fetch("/api/v2/absences/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start_date: startDate,
        end_date: endDate,
      }),
    });

    const analysis = await response.json();

    // Show warnings if there are closed days
    if (analysis.warnings && analysis.warnings.length > 0) {
      toast({
        title: "Vacation Period",
        description: analysis.message,
        variant: "default",
      });
    }

    // Display closed days
    if (analysis.closed_day_list && analysis.closed_day_list.length > 0) {
      console.log("Closed days during vacation:", analysis.closed_day_list);
      // Show list to user showing which days are closed and why
    }

    // User can proceed with vacation even if it includes closed days
    return true;
  } catch (error) {
    console.error("Validation failed:", error);
    return false;
  }
};
```

## Example Scenarios

### Scenario 1: Vacation Mon-Fri (all working days)

```
Period: Dec 23-27, 2024 (Mon-Fri)
Store calendar: Closed weekends

Result:
- Total days: 5
- Working days: 5
- Closed days: 0
- Warnings: None
```

### Scenario 2: Vacation includes Christmas

```
Period: Dec 23-27, 2024 (includes Christmas on 25th)
Store calendar: Closed on Christmas + weekends

Result:
- Total days: 5
- Working days: 4 (Christmas excluded)
- Closed days: 1 (Christmas)
- Warnings: "Vacation period includes 1 non-working day(s)"
- Closed days list: [Dec 25 - Weihnachtstag]
```

### Scenario 3: Vacation includes weekend + holiday

```
Period: Dec 20-23, 2024 (Fri-Mon, includes weekend)
Store calendar: Closed Sat-Sun

Result:
- Total days: 4
- Working days: 2 (Friday + Monday)
- Closed days: 2 (Saturday + Sunday)
- Warnings: "Vacation period includes 2 non-working day(s)"
```

## Testing

Run tests to verify everything works:

```bash
# Run all vacation planning tests
pytest tests/backend/services/test_vacation_planning.py -v

# Run specific test
pytest tests/backend/services/test_vacation_planning.py::TestVacationPlanningService::test_validate_vacation_with_holiday -v
```

## Integration Checklist

- [ ] Backend service created and working (`vacation_planning.py`)
- [ ] API endpoints functional (`absences_validation.py`)
- [ ] Tests passing
- [ ] VacationPlanningPage updated to call `/api/v2/absences/validate`
- [ ] MultistepVacationPlanningModal updated to show period summary
- [ ] VacationAbsenceModal updated to validate dates
- [ ] UI shows warnings about non-working days
- [ ] UI displays list of closed days in vacation period
- [ ] Date pickers optionally highlight working/closed days

## FAQ

**Q: Does this count vacation entitlements?**
A: No, it only identifies which days are working days. Entitlement counting would be separate.

**Q: Can users create vacations on non-working days?**
A: Yes, the system allows it but warns the user. This gives flexibility for edge cases.

**Q: What if store hours are updated?**
A: The system uses current settings, so changes take effect immediately for new validations.

**Q: What about notional holidays?**
A: They should be added to `special_days` with `is_closed: true`. The Holiday API integration (if available) can automate this.

**Q: How are different shifts handled?**
A: Vacation applies to the entire day. If different shifts have different hours, that's separate from vacation planning.

## Files Reference

| File                                               | Purpose                         |
| -------------------------------------------------- | ------------------------------- |
| `src/backend/services/vacation_planning.py`        | Core service logic (320 lines)  |
| `src/backend/routes/absences_validation.py`        | REST API endpoints (137 lines)  |
| `tests/backend/services/test_vacation_planning.py` | Test coverage (250+ tests)      |
| `docs/VACATION_PLANNING_WITH_STORE_CALENDAR.md`    | Full architecture documentation |
| `docs/VACATION_PLANNING_IMPLEMENTATION_SUMMARY.md` | Implementation summary          |

## Getting Help

Refer to:

1. `docs/VACATION_PLANNING_WITH_STORE_CALENDAR.md` - Complete architecture guide
2. Test file - Shows all usage examples
3. Service docstrings - Every method has detailed documentation
