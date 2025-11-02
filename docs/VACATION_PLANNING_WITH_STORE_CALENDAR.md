# Vacation Planning with Store Opening Days and Special Days

## Overview

The vacation planning system now takes into account:

- **Store opening days** - configured in Settings (Monday-Sunday)
- **Special days** - custom closed days or days with modified hours
- **Non-working days** (weekends) - automatically excluded from store working days

## Architecture

### Backend Components

#### 1. Vacation Planning Service (`src/backend/services/vacation_planning.py`)

Provides core vacation planning logic with the following key methods:

**`is_store_open_on_date(target_date: date) -> bool`**

- Checks if store is open on a given date
- Considers special days first (closed or custom hours)
- Falls back to regular opening days configuration

**`get_store_hours(target_date: date) -> tuple[str, str]`**

- Returns opening and closing hours for a date
- Handles special days with custom hours
- Returns default store hours otherwise

**`get_working_days_in_range(start_date: date, end_date: date) -> list[date]`**

- Returns all working (store open) days in a date range
- Used for counting actual working days for vacation

**`get_closed_days_in_range(start_date: date, end_date: date) -> dict[str, dict]`**

- Returns all closed days in a date range with details
- Includes reason (weekend, special_day, holiday)
- Includes custom hours if applicable

**`validate_vacation_dates(start_date: date, end_date: date) -> dict`**

- Validates vacation dates and provides comprehensive analysis
- Returns:
  - `is_valid`: bool
  - `working_days`: count of working days
  - `closed_days`: count of non-working days
  - `total_days`: total calendar days
  - `closed_day_list`: detailed info about each closed day
  - `warnings`: list of warning messages
  - `message`: human-readable summary

**`get_vacation_summary_for_period(start_date: date, end_date: date) -> dict`**

- Returns a summary of working/closed days for a period
- Useful for displaying in UI to help users plan vacations

**`count_working_days(start_date: date, end_date: date) -> int`**

- Simple count of working days in a range

**`log_vacation_analysis(employee_id, start_date, end_date, analysis)`**

- Logs vacation planning decisions for audit trail

#### 2. Validation Endpoints (`src/backend/routes/absences_validation.py`)

**`POST /api/v2/absences/validate`**

- Validates vacation dates against store calendar
- Request body: `{ "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD" }`
- Returns detailed analysis with warnings

**`POST /api/v2/absences/period-summary`**

- Gets working/closed day breakdown for a period
- Request body: `{ "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD" }`
- Returns summary with lists of working and closed days

### Data Model

#### Settings Model (`src/backend/models/settings.py`)

**`opening_days`** - JSON column with format:

```json
{
  "0": true, // Monday
  "1": true, // Tuesday
  "2": true, // Wednesday
  "3": true, // Thursday
  "4": true, // Friday
  "5": true, // Saturday
  "6": false // Sunday
}
```

**`special_days`** - JSON column with format:

```json
{
  "2024-12-25": {
    "name": "Weihnachtstag",
    "is_closed": true,
    "is_holiday": true
  },
  "2024-12-26": {
    "name": "2nd Christmas Day",
    "is_closed": false,
    "custom_hours": {
      "opening": "10:00",
      "closing": "18:00"
    }
  }
}
```

**`store_opening`** - Default store opening time (e.g., "09:00")
**`store_closing`** - Default store closing time (e.g., "20:00")

## Frontend Integration

### Updated Components

**`VacationPlanningPage.tsx`** - Main vacation planning interface

- Should call validation endpoints before creating/updating absences
- Should display warnings about non-working days

**`MultistepVacationPlanningModal.tsx`** - Multi-step vacation modal

- Should show period summary when dates are selected
- Should highlight closed days in date picker

**`VacationAbsenceModal.tsx`** - Single vacation entry modal

- Should validate dates before submission
- Should show warnings about non-working days

### Suggested Frontend Enhancements

1. **Date Picker Enhancement**

   - Disable selection of non-working days (optional - could allow selection but warn)
   - Highlight working days in green, closed days in gray
   - Show special day names as tooltips

2. **Validation Display**

   - Show warning banner if vacation includes non-working days
   - Display breakdown: "15 calendar days (10 working days, 5 non-working days)"
   - List specific closed days with reasons

3. **Period Summary Display**
   - Show list of closed days during vacation period
   - Show which days have custom hours vs fully closed

Example implementation:

```typescript
// In VacationPlanningPage
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

    // Show warnings if vacation includes closed days
    if (analysis.warnings && analysis.warnings.length > 0) {
      toast({
        title: "Vacation Period Information",
        description: analysis.message,
        variant: "default",
      });
    }

    // Display closed days
    if (analysis.closed_day_list && analysis.closed_day_list.length > 0) {
      // Show list of closed days
    }

    return analysis;
  } catch (error) {
    console.error("Validation failed:", error);
  }
};
```

## Usage Examples

### Example 1: Simple Validation

```python
from datetime import date
from src.backend.services.vacation_planning import VacationPlanningService

service = VacationPlanningService()

# Validate a vacation period
analysis = service.validate_vacation_dates(
    date(2024, 12, 23),  # Monday
    date(2024, 12, 30),  # Monday (next week)
)

print(analysis)
# Output:
# {
#     "is_valid": True,
#     "working_days": 5,
#     "closed_days": 2,
#     "total_days": 8,
#     "closed_day_list": [
#         {
#             "date": "2024-12-25",
#             "reason": "special_day",
#             "type": "closed",
#             "description": "Weihnachtstag"
#         },
#         {
#             "date": "2024-12-29",
#             "reason": "weekend",
#             "type": "closed",
#             "description": "Sonntag (geschlossen)"
#         }
#     ],
#     "warnings": ["Vacation period includes 2 non-working day(s)..."],
#     "message": "Vacation spans 8 calendar days (5 working days, 2 non-working days)"
# }
```

### Example 2: Get Period Summary

```python
from datetime import date
from src.backend.services.vacation_planning import VacationPlanningService

service = VacationPlanningService()

summary = service.get_vacation_summary_for_period(
    date(2024, 12, 23),
    date(2024, 12, 27),
)

print(summary)
# Output:
# {
#     "period_start": "2024-12-23",
#     "period_end": "2024-12-27",
#     "total_days": 5,
#     "working_days_count": 3,
#     "closed_days_count": 2,
#     "working_days": ["2024-12-23", "2024-12-24", "2024-12-26"],
#     "closed_days": {
#         "2024-12-25": {"reason": "special_day", ...},
#         "2024-12-22": {"reason": "weekend", ...}
#     }
# }
```

### Example 3: REST API Usage

```bash
# Validate vacation dates
curl -X POST http://localhost:5000/api/v2/absences/validate \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-12-23",
    "end_date": "2024-12-27"
  }'

# Get period summary
curl -X POST http://localhost:5000/api/v2/absences/period-summary \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-12-23",
    "end_date": "2024-12-27"
  }'
```

## Configuration

### Setting Store Opening Days

Store opening days are configured in Settings:

- Access via admin panel or API
- Keys are numeric strings (0=Monday, 6=Sunday)
- Values are boolean (true=open, false=closed)

### Setting Special Days

Special days are managed via:

- Frontend: Special Days settings page
- API: `/api/v2/special-days` endpoints
- Database: `settings.special_days` JSON column

Each special day can:

- Mark store as fully closed (`is_closed: true`)
- Set custom hours different from default
- Include a name/description for display

## Testing

Test files should be added to:

- `tests/backend/services/test_vacation_planning.py` - Service tests
- `tests/backend/routes/test_absences_validation.py` - Endpoint tests

Key test cases:

- Vacation across regular weekends
- Vacation across special closed days
- Vacation with custom hours
- All working days (no closed days)
- All closed days (no working days)
- Empty period (start = end)
- Invalid dates (end before start)

## Future Enhancements

1. **Holiday Integration**

   - Automatically import public holidays from Holiday API
   - Mark imported holidays as special_days

2. **Vacation Entitlements**

   - Track remaining vacation days per employee
   - Account for only working days in entitlement calculation

3. **Conflict Detection**

   - Check if multiple employees are on vacation simultaneously
   - Warn if vacation leaves coverage gaps

4. **Approval Workflow**

   - Manager approval before vacation becomes final
   - Automatic conflict resolution suggestions

5. **Calendar Export**
   - Export vacation calendar with closed day markers
   - iCal format for calendar applications
