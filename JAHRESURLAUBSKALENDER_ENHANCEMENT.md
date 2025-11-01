# Jahresurlaubskalender (Yearly Vacation Calendar) Enhancement

## Problem Statement
The Jahresurlaubskalender needed to be reviewed and adjusted with the following requirements:
1. **Format**: DIN A4 Landscape
2. **Layout**: 6 months per side (2 pages total)
3. **Feature**: Show "genehmigte Anträge" (approved vacation requests) in the calendar

## What Was Changed

### 1. PDF Generator Method Signature
**Before:**
```python
def generate_yearly_calendar(self, year: int) -> io.BytesIO:
```

**After:**
```python
def generate_yearly_calendar(
    self,
    year: int,
    employees: list[Employee] = None,
    absences: list[Absence] = None,
    settings: Settings | None = None,
) -> io.BytesIO:
```

### 2. Calendar Layout
**Before:**
- Attempted to fit 6 months in a single horizontal row
- No proper grid structure
- Difficult to read and not scalable

**After:**
- 2 pages with 6 months per page
- 2x3 grid layout (2 rows × 3 columns) per page
- Page 1: January - June
- Page 2: July - December
- Proper spacing and alignment

### 3. Visual Indicators for Approved Absences
**Before:**
- No indication of approved absences
- Just an empty calendar grid

**After:**
- Bullet point (•) displayed on dates with approved absences
- Only shows `status="approved"` absences
- Multiple absences on the same date are tracked
- Legend at bottom: "Legende: • = Genehmigter Urlaubsantrag | Gesamt: X genehmigte Anträge"

### 4. API Route Enhancement
**File**: `src/backend/routes/vacation_pdf.py`

**Before:**
```python
generator = VacationPDFGenerator()
pdf_buffer = generator.generate_yearly_calendar(year=year)
```

**After:**
```python
# Fetch employees
employees = Employee.query.filter_by(is_active=True).all()

# Fetch ALL approved absences for the year
absences = Absence.query.filter(
    Absence.status == "approved",
    Absence.start_date <= end_date,
    Absence.end_date >= start_date,
).all()

# Get settings
settings = Settings.query.first()

# Generate PDF with data
generator = VacationPDFGenerator()
pdf_buffer = generator.generate_yearly_calendar(
    year=year,
    employees=employees,
    absences=absences,
    settings=settings,
)
```

## Technical Implementation Details

### Absence Date Mapping
The generator creates a date-to-count mapping for efficient lookup:
```python
absence_dates = {}
for absence in approved_absences:
    start = max(absence.start_date, date(year, 1, 1))
    end = min(absence.end_date, date(year, 12, 31))
    
    current = start
    while current <= end:
        date_key = (current.month, current.day)
        absence_dates[date_key] = absence_dates.get(date_key, 0) + 1
        current = current + timedelta(days=1)
```

### Calendar Cell Generation
Days with absences show both the day number and indicator:
```python
if absence_count > 0:
    cell_text = f"<b>{day_num}</b><br/><font size='5'>•</font>"
    day_cells_data[week_num][day_of_week] = Paragraph(
        cell_text, self.small_style
    )
else:
    day_cells_data[week_num][day_of_week] = str(day_num)
```

## Testing

### Test Coverage
All tests passing (9 total):
1. ✅ test_admin_yearly_form_generation
2. ✅ test_employee_request_form_generation
3. ✅ test_employee_request_form_blank
4. ✅ test_overview_form_generation
5. ✅ test_yearly_calendar_generation
6. ✅ test_status_text_conversion
7. ✅ test_yearly_calendar_shows_approved_absences_only (NEW)
8. ✅ test_yearly_calendar_grid_layout (NEW)
9. ✅ test_yearly_calendar_with_settings (NEW)

### New Enhanced Tests
Created `test_vacation_calendar_enhanced.py` with three comprehensive tests:

1. **test_yearly_calendar_shows_approved_absences_only**
   - Verifies only approved absences appear (not requested or declined)
   - Confirms legend shows correct count

2. **test_yearly_calendar_grid_layout**
   - Validates 2-page layout
   - Checks page size is A4 landscape
   - Ensures all 12 months are present

3. **test_yearly_calendar_with_settings**
   - Verifies store name from settings appears in title

## PDF Output Verification

Generated test PDF shows:
- **Format**: DIN A4 Landscape (841.89 x 595.28 points) ✅
- **Pages**: 2 ✅
- **Layout**: Proper 2x3 grid per page ✅
- **Month Distribution**:
  - Page 1: January, February, March (row 1) + April, May, June (row 2)
  - Page 2: July, August, September (row 1) + October, November, December (row 2)
- **Visual Indicators**: Bullet points (•) on approved absence dates ✅
- **Legend**: "Legende: • = Genehmigter Urlaubsantrag | Gesamt: X genehmigte Anträge" ✅
- **Store Name**: Included in title when settings available ✅

### Sample PDF Text Extract
```
Jahresurlaubskalender 2024

January
Mo Di Mi Do Fr Sa So
1  2  3  4  5  6  7
8• 9• 10• 11• 12• 13 14
...

Legende: • = Genehmigter Urlaubsantrag | Gesamt: 8 genehmigte Anträge
```

## Benefits

1. **Better Readability**: 2x3 grid is easier to scan than a cramped 6-in-a-row layout
2. **Approved Absences Visible**: Managers can immediately see when employees are on approved vacation
3. **Professional Format**: Standard DIN A4 landscape format suitable for printing
4. **Comprehensive Legend**: Clear explanation of symbols used
5. **Backward Compatible**: Optional parameters mean old code still works
6. **Well Tested**: Enhanced test suite ensures functionality

## Files Changed

1. `src/backend/services/vacation_pdf_generator.py` - Updated calendar generation logic
2. `src/backend/routes/vacation_pdf.py` - Enhanced API endpoint to fetch and pass data
3. `tests/backend/test_vacation_calendar_enhanced.py` - New comprehensive tests (NEW FILE)

## Usage Example

From the VacationPlanningPage in the frontend:
```typescript
// User clicks "PDF Export" -> "Jahreskalender"
handleExportPDF('yearly-calendar');

// This calls:
const url = `${apiBaseUrl}/api/v2/vacation-pdf/yearly-calendar?year=${currentYear}`;
window.open(url, '_blank');
```

The backend now:
1. Fetches all active employees
2. Queries all approved absences for the year
3. Retrieves settings for store name
4. Generates a properly formatted 2-page calendar with visual indicators

## Summary

The Jahresurlaubskalender now meets all requirements:
- ✅ DIN A4 Landscape format
- ✅ 6 months per page (2 pages total)
- ✅ Shows approved vacation requests with visual indicators
- ✅ Professional, printable layout
- ✅ Comprehensive test coverage
- ✅ All existing tests still passing
