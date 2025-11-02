# Date Format Standards

## Overview
This document defines the standard date and date range formats used throughout the Schichtplan application.

## Date Format Standard

### Format: ISO 8601 Date Format (YYYY-MM-DD)

**Frontend (TypeScript/JavaScript):**
- Use date-fns `format()` function with `"yyyy-MM-dd"` format string
- Example: `format(new Date(), "yyyy-MM-dd")` → `"2025-01-15"`

**Backend (Python):**
- Use `strftime()` with `"%Y-%m-%d"` format string
- Example: `date.today().strftime("%Y-%m-%d")` → `"2025-01-15"`
- Use `strptime()` for parsing: `datetime.strptime("2025-01-15", "%Y-%m-%d").date()`

### Why ISO 8601?
- **Unambiguous**: No confusion between US (MM/DD/YYYY) and European (DD/MM/YYYY) formats
- **Sortable**: Lexicographic sorting equals chronological sorting
- **API-friendly**: Standard format for REST APIs and JSON
- **Database-compatible**: Works directly with SQL date types

## Date Range Matching

### Overlapping Range Logic
When filtering data by date range, use **overlapping range matching**:

**Logic:**
```
range1_start <= range2_end AND range1_end >= range2_start
```

**Example:**
```
Request range: 2025-01-01 to 2025-01-07
Version range: 2025-01-03 to 2025-01-05

Overlaps? YES
- version_start (2025-01-03) <= request_end (2025-01-07) ✓
- version_end (2025-01-05) >= request_start (2025-01-01) ✓
```

### Implementation Examples

**Frontend (TypeScript):**
```typescript
const overlaps = versionStart <= currentTo && versionEnd >= currentFrom;
```

**Backend (Python/SQLAlchemy):**
```python
query = query.filter(
    and_(
        VersionMeta.date_range_start <= end_date,
        VersionMeta.date_range_end >= start_date,
    )
)
```

### Common Pitfalls to Avoid

❌ **Don't use exact matching for date ranges:**
```typescript
// WRONG - only matches identical ranges
const matches = versionStart === currentFrom && versionEnd === currentTo;
```

✅ **Use overlapping logic instead:**
```typescript
// CORRECT - matches any overlapping ranges
const overlaps = versionStart <= currentTo && versionEnd >= currentFrom;
```

## Date Range Types

### Week-Based Ranges
- Identifier format: `YYYY-Www` (e.g., `"2025-W03"`)
- Monday-based weeks (configurable)
- Always 7 days: Monday through Sunday

### Custom Ranges
- Any arbitrary start and end date
- Must be in ISO 8601 format
- Used for special reporting periods or non-week-aligned schedules

## API Conventions

### Request Parameters
```
GET /api/v2/schedules/versions?start_date=2025-01-01&end_date=2025-01-07
```

### Response Format
```json
{
  "versions": [...],
  "date_range": {
    "start": "2025-01-01",
    "end": "2025-01-07"
  }
}
```

## Database Storage

### Date Columns
- Store as DATE type (not DATETIME or TIMESTAMP)
- Always store in UTC equivalent
- Use ISO 8601 format when serializing to JSON

### Date Range Columns
```python
class VersionMeta(db.Model):
    date_range_start = db.Column(db.Date, nullable=False)
    date_range_end = db.Column(db.Date, nullable=False)
```

## Testing Date Logic

### Test Cases for Overlapping Logic

1. **Fully contained**: Version range entirely within request range
   - Request: 2025-01-01 to 2025-01-31
   - Version: 2025-01-10 to 2025-01-20
   - Expected: ✅ Overlaps

2. **Partial overlap (start)**: Version starts before request range
   - Request: 2025-01-15 to 2025-01-31
   - Version: 2025-01-10 to 2025-01-20
   - Expected: ✅ Overlaps

3. **Partial overlap (end)**: Version ends after request range
   - Request: 2025-01-01 to 2025-01-15
   - Version: 2025-01-10 to 2025-01-20
   - Expected: ✅ Overlaps

4. **Fully containing**: Version range contains entire request range
   - Request: 2025-01-10 to 2025-01-20
   - Version: 2025-01-01 to 2025-01-31
   - Expected: ✅ Overlaps

5. **No overlap (before)**: Version ends before request starts
   - Request: 2025-01-15 to 2025-01-31
   - Version: 2025-01-01 to 2025-01-10
   - Expected: ❌ No overlap

6. **No overlap (after)**: Version starts after request ends
   - Request: 2025-01-01 to 2025-01-10
   - Version: 2025-01-15 to 2025-01-31
   - Expected: ❌ No overlap

## Related Files

- **Frontend**: `src/frontend/src/pages/SchedulePage.tsx` - Date range filtering
- **Backend**: `src/backend/api/schedules.py` - Version endpoint
- **Service**: `src/backend/services/version_manager_service.py` - Version queries
