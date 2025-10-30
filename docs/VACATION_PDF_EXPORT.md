# Vacation Planning PDF Export Feature

## Overview
The vacation planning PDF export feature provides various professional PDF forms for managing employee vacation requests and planning. All forms are generated in German and follow standard business document layouts.

## Available PDF Forms

### 1. Admin Yearly Form (Jahresplanung Admin)
**Endpoint:** `GET /api/v2/vacation-pdf/admin-yearly?year=YYYY`

**Purpose:** Administrative overview for yearly vacation planning

**Features:**
- Lists all employees with vacation entitlements
- Shows taken vacation days (approved and past)
- Shows planned vacation days (approved and future)
- Calculates remaining vacation days
- Color-coded status indicators:
  - **OK** (Green): Vacation days available
  - **Voll** (Orange): All days used
  - **Überbucht** (Red): Over-allocated
- Remarks column for manual notes
- Landscape A4 format

**Use Case:** HR/management to track and plan vacation allocations for the entire year.

### 2. Employee Request Form (Urlaubsantrag)
**Endpoint:** `GET /api/v2/vacation-pdf/employee-request?employee_id=ID&absence_id=ID`

**Purpose:** Official vacation request form for employees

**Features:**
- Employee information section (name, employee ID, email, annual entitlement)
- Vacation request details (from/to dates, number of days, remarks)
- Signature fields for employee (date and signature)
- Approval section for supervisor:
  - Checkboxes for approved/declined
  - Date and signature fields
- Legal notice about submission deadlines
- Portrait A4 format

**Use Cases:**
- Employee submits vacation request (blank form: no `absence_id`)
- Pre-filled form for existing request (with `absence_id`)
- Print and sign workflow
- Archive approved requests

### 3. Overview Form (Übersicht Alle Mitarbeiter)
**Endpoint:** `GET /api/v2/vacation-pdf/overview?year=YYYY`

**Purpose:** Comprehensive overview of all employees and their vacation details

**Features:**
- Detailed table with all employees
- Multiple rows per employee for each vacation period
- Columns: Nr., Mitarbeiter, Personal-Nr., Anspruch, Von, Bis, Tage, Status, Verbleibend, Bemerkung
- Status translation (Beantragt, Genehmigt, Abgelehnt)
- Summary statistics (total employees, total vacation days)
- Generation timestamp
- Landscape A4 format

**Use Case:** Detailed reporting for HR, management meetings, or auditing purposes.

### 4. Yearly Calendar (Jahreskalender)
**Endpoint:** `GET /api/v2/vacation-pdf/yearly-calendar?year=YYYY`

**Purpose:** Visual calendar showing vacation periods across the year

**Features:**
- Two pages (January-June, July-December)
- 6 months per page in 6 columns
- Calendar grid with all days
- Employee IDs shown on vacation days
- **Rotated text (90°)** when multiple employees have vacation on same date
- Visual overview of vacation coverage
- Landscape A4 format

**Use Cases:**
- Wall calendar for planning room
- Quick visual check of staffing during vacation periods
- Identifying overlap and coverage gaps

## Frontend Integration

### VacationPlanningPage
Added PDF export dropdown menu in the action buttons area:
```typescript
<DropdownMenu>
  <DropdownMenuTrigger>
    <Button variant="outline">
      <Download className="h-4 w-4 mr-2" />
      PDF Export
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Jahresplanung (Admin)</DropdownMenuItem>
    <DropdownMenuItem>Übersicht (Alle Mitarbeiter)</DropdownMenuItem>
    <DropdownMenuItem>Jahreskalender</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### FormularsPage
Added employee selector and vacation request form generation:
- Select employee from dropdown
- Click "Formular öffnen" to generate blank request form
- Form opens in new browser tab for printing/saving

## Technical Implementation

### Backend Architecture

**Service Layer:** `src/backend/services/vacation_pdf_generator.py`
- `VacationPDFGenerator` class with 4 main methods
- Uses ReportLab library for PDF generation
- Supports landscape and portrait orientations
- Custom styles for titles, headers, tables
- German text and date formatting

**Routes:** `src/backend/routes/vacation_pdf.py`
- RESTful API endpoints
- Input validation (year range, employee/absence existence)
- Error handling with appropriate HTTP status codes
- Returns PDF as downloadable file (`send_file`)

**Models:** Integrates with existing database models
- `Employee`: vacation_per_year, employee info
- `Absence`: vacation records, status, dates
- `Settings`: store name, address for headers

### PDF Generation Details

**Libraries Used:**
- `reportlab`: Core PDF generation
- `reportlab.platypus`: Document templates, tables, flowables
- `reportlab.pdfgen.canvas`: Low-level drawing for calendar

**Table Styling:**
- Grid lines with borders
- Header backgrounds (light grey)
- Alternating row colors for readability
- Center/left alignment as appropriate
- Font sizes optimized for A4 paper

**Calendar Rendering:**
- Custom canvas drawing for month grids
- Day cells with borders
- Rotated text using `canvas.rotate(90)`
- Multiple employee IDs per cell when overlapping

## Testing

### Manual Test Script
Run: `python3 test_vacation_pdfs_manual.py`

Generates 5 sample PDFs in `pdf_test_output/`:
1. `admin_yearly_2025.pdf`
2. `employee_request_MUS_filled.pdf`
3. `employee_request_SCH_blank.pdf`
4. `overview_2025.pdf`
5. `calendar_2025.pdf`

### Unit Tests
Location: `tests/backend/test_vacation_pdf.py`

Tests:
- Admin yearly form generation
- Employee request form (filled and blank)
- Overview form generation
- Yearly calendar generation
- Status text conversion

Run with: `pytest tests/backend/test_vacation_pdf.py`

## Usage Examples

### Admin Planning at Year Start
```bash
# Generate planning form for 2024
curl -o vacation_plan_2024.pdf \
  "http://localhost:5000/api/v2/vacation-pdf/admin-yearly?year=2024"
```

### Employee Requests Vacation
```bash
# Generate blank form for employee ID 5
curl -o vacation_request.pdf \
  "http://localhost:5000/api/v2/vacation-pdf/employee-request?employee_id=5"
```

### Generate Overview Report
```bash
# Comprehensive overview for 2024
curl -o vacation_overview_2024.pdf \
  "http://localhost:5000/api/v2/vacation-pdf/overview?year=2024"
```

### Create Wall Calendar
```bash
# Visual calendar for planning room
curl -o vacation_calendar_2024.pdf \
  "http://localhost:5000/api/v2/vacation-pdf/yearly-calendar?year=2024"
```

## Future Enhancements

Potential improvements:
- [ ] Add year selector in frontend UI
- [ ] Support for multi-year overview
- [ ] Custom date ranges for overview
- [ ] Export to Excel format
- [ ] Email PDF directly to employees
- [ ] Digital signature integration
- [ ] Custom branding/logo support
- [ ] Configurable PDF layouts
- [ ] Vacation conflict detection in calendar
- [ ] Holiday/special day markers in calendar

## Troubleshooting

### PDF Generation Fails
- Check reportlab is installed: `pip install reportlab`
- Verify employee/absence data exists in database
- Check year parameter is valid (2020-2030 range)

### Rotated Text Not Visible
- Canvas rotation requires sufficient cell height
- Check font size is appropriate (5-6pt for rotated text)
- Verify multiple employees on same date

### Missing Data in Forms
- Ensure employees are active (`is_active=True`)
- Verify absence_type_id is "vacation"
- Check date ranges overlap with requested year

## Related Files

- `src/backend/services/vacation_pdf_generator.py` - Core PDF generation
- `src/backend/routes/vacation_pdf.py` - API endpoints
- `src/frontend/src/pages/VacationPlanningPage.tsx` - Frontend UI
- `src/frontend/src/pages/FormularsPage.tsx` - Form selection
- `tests/backend/test_vacation_pdf.py` - Unit tests
- `test_vacation_pdfs_manual.py` - Manual testing script
