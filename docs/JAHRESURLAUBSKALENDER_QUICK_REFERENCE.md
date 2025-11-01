# Jahresurlaubskalender Redesign - Quick Reference Guide

## 📋 Design Summary

### Current Design Problem

- **Layout**: Columns represent days (difficult to scan horizontally)
- **Readability**: Month headers spread across page top
- **Scalability**: Adding more data creates clutter

### New Design Solution

- **Layout**: Days as **horizontal rows** (intuitive scanning)
- **Structure**: 6 months in a single row per page, 2 pages total
- **Format**: DIN A4 Landscape (841.89 × 595.28 mm)

---

## 🎯 Key Specifications

| Aspect                | Details                                        |
| --------------------- | ---------------------------------------------- |
| **Paper Size**        | DIN A4 Landscape                               |
| **Pages**             | 2 (Page 1: Jan-Jun, Page 2: Jul-Dec)           |
| **Layout**            | 6 months displayed side-by-side                |
| **Column Structure**  | Each month is a vertical column (~137mm)       |
| **Row Structure**     | Each row represents one day (Mo-Su, days 1-31) |
| **Margins**           | 10mm all sides                                 |
| **Absence Indicator** | • (bullet point) = Approved absence            |

---

## 📐 Page Layout Overview

### Page 1: January - June (1st Half Year)

```
JAHRESURLAUBSKALENDER 2025 - JANUAR BIS JUNI

┌──────┬──────┬──────┬──────┬──────┬──────┐
│ JAN  │ FEB  │ MÄR  │ APR  │ MAI  │ JUN  │
├──────┼──────┼──────┼──────┼──────┼──────┤
│Mo 1  │Mo 1  │Mi 1  │Sa 1  │Th 1  │Su 1  │
│[•]   │[ ]   │[ ]   │[ ]   │[•]   │[•]   │
├──────┼──────┼──────┼──────┼──────┼──────┤
│Di 2  │Di 2  │Do 2  │Su 2  │Fr 2  │Mo 2  │
│[•]   │[•]   │[•]   │[•]   │[•]   │[•]   │
├──────┼──────┼──────┼──────┼──────┼──────┤
│...   │...   │...   │...   │...   │...   │
└──────┴──────┴──────┴──────┴──────┴──────┘

Legend: • = Genehmigter Urlaubsantrag
Gesamt 1. HJ: 47 genehmigte Abwesenheiten
```

### Page 2: July - December (2nd Half Year)

```
JAHRESURLAUBSKALENDER 2025 - JULI BIS DEZEMBER

┌──────┬──────┬──────┬──────┬──────┬──────┐
│ JUL  │ AUG  │ SEP  │ OKT  │ NOV  │ DEZ  │
├──────┼──────┼──────┼──────┼──────┼──────┤
│Tu 1  │Fr 1  │Mo 1  │We 1  │Sa 1  │Mo 1  │
│[ ]   │[•]   │[•]   │[ ]   │[•]   │[•]   │
├──────┼──────┼──────┼──────┼──────┼──────┤
│We 2  │Sa 2  │Tu 2  │Th 2  │Su 2  │Tu 2  │
│[•]   │[ ]   │[ ]   │[•]   │[ ]   │[ ]   │
├──────┼──────┼──────┼──────┼──────┼──────┤
│...   │...   │...   │...   │...   │...   │
└──────┴──────┴──────┴──────┴──────┴──────┘

Legend: • = Genehmigter Urlaubsantrag
Gesamt 2. HJ: 52 genehmigte Abwesenheiten
Insgesamt 2025: 99 genehmigte Abwesenheiten
```

---

## 🎨 Visual Hierarchy

### Font Sizes

| Element      | Size | Weight  | Purpose               |
| ------------ | ---- | ------- | --------------------- |
| Page Title   | 18pt | Bold    | Main heading          |
| Month Header | 12pt | Bold    | Column identification |
| Day Entry    | 9pt  | Regular | Content               |
| Legend       | 8pt  | Regular | Footer instructions   |

### Colors

| Element    | Color         | Hex Code |
| ---------- | ------------- | -------- |
| Text       | Black         | #000000  |
| Borders    | Light Gray    | #CCCCCC  |
| Headers    | Light Gray BG | #EEEEEE  |
| Background | White         | #FFFFFF  |

---

## 📏 Dimensional Breakdown

### Column Specifications

```
Total page width:  841.89mm
Margins:           20mm (left + right)
Usable width:      821.89mm

Per column (6 columns):
Column width:      821.89mm ÷ 6 = ~137mm
Border width:      ~0.5mm (grid lines)
Content width:     ~136.5mm
```

### Row Specifications

```
Maximum rows per month: 31 (January, March, May, etc.)
Row height: 12-14pt (includes padding)
Typical row content: "Mo  1  [•]" or "Di  2  [ ]"
```

### Spacing

```
Left margin:       10mm
Right margin:      10mm
Top margin:        10mm
Bottom margin:     10mm

Section spacing:
- Title to grid:   12pt
- Grid to legend:  12pt
- Legend height:   25mm
```

---

## 🔍 Data Presentation

### Day Cell Format

```
Structure: WEEKDAY + SPACE + DAY_NUMBER + SPACE + [INDICATOR]

Examples:
Mo  1  [•]     ← Monday, 1st, with absence
Di  2  [ ]     ← Tuesday, 2nd, no absence
We 31  [•]     ← Wednesday, 31st, with absence
```

### Absence Indicator

| Indicator | Meaning                          |
| --------- | -------------------------------- |
| `[•]`     | Approved absence on this day     |
| `[ ]`     | No absence on this day           |
| `—`       | Day does not exist in this month |

### Legend Section

```
Legende:
• = Genehmigter Urlaubsantrag (Approved Absence)
- = Nicht vorgesehen (Day does not exist)

Statistik (1. Halbjahr):
  Insgesamt: 47 genehmigte Abwesenheiten
  Durchschnitt pro Monat: 7.83 Tage
  Spitzenwert: Juni mit 9 Tagen
```

---

## 🛠️ Implementation Checklist

### Design Validation

- [x] 2-page format confirmed
- [x] 6 months per page layout
- [x] Days as horizontal rows
- [x] DIN A4 Landscape dimensions
- [x] Professional typography
- [x] Clear absence indicators
- [x] Comprehensive legend

### PDF Generation

- [ ] Create 2-page structure
- [ ] Implement 6-column grid
- [ ] Add month headers (centered, bold)
- [ ] Populate day rows (weekday + date + indicator)
- [ ] Handle short months (Feb, Apr, Jun, Sep, Nov)
- [ ] Apply consistent styling
- [ ] Generate legend with statistics
- [ ] Add page breaks

### Quality Assurance

- [ ] Verify all months render correctly
- [ ] Check short month handling (Feb, Apr, Jun, Sep, Nov)
- [ ] Validate absence indicator placement
- [ ] Test print at 300 DPI
- [ ] Check file size (target: <500KB)
- [ ] Verify page orientation (landscape)
- [ ] Test with various timezone/locale settings

---

## 💡 Key Design Advantages

### vs. Current Implementation

| Aspect               | Current                 | New Design                    |
| -------------------- | ----------------------- | ----------------------------- |
| **Readability**      | Column-based (vertical) | Row-based (horizontal) ✅     |
| **Scanning**         | Left-to-right, complex  | Top-to-bottom, intuitive ✅   |
| **Wall Display**     | Difficult to read       | Easy to scan from distance ✅ |
| **Month Overview**   | Scattered               | Continuous row ✅             |
| **Space Efficiency** | Cramped columns         | Balanced layout ✅            |
| **Data Density**     | High (difficult)        | Optimal ✅                    |

---

## 🎯 Use Cases

### 1. Planning & Approval

```
HR Manager reviews calendar to:
- See vacation clusters
- Identify coverage gaps
- Approve conflicting requests
- Plan staffing
```

### 2. Wall-Mounted Display

```
Break room calendar showing:
- All approved vacations
- Quick visual reference
- Easy team communication
```

### 3. Reporting & Analytics

```
Statistics show:
- Total absences per period
- Monthly distribution
- Peak vacation periods
- Coverage requirements
```

---

## 📊 Statistical Tracking

### Per-Page Statistics

```
Page 1 (Jan-Jun):
- Month-by-month breakdown
- H1 total count
- Average per month

Page 2 (Jul-Dec):
- Month-by-month breakdown
- H2 total count
- Average per month
- Annual total
```

### Example

```
Statistik (1. Halbjahr Jan-Jun 2025):
  Januar:    8 genehmigte Abwesenheiten
  Februar:   5 genehmigte Abwesenheiten
  März:      9 genehmigte Abwesenheiten
  April:     7 genehmigte Abwesenheiten
  Mai:       10 genehmigte Abwesenheiten
  Juni:      8 genehmigte Abwesenheiten
  ────────────────────────────────────
  1. Halbjahr:  47 genehmigte Abwesenheiten
  Durchschnitt:  7.83 pro Monat
  Spitzenwert:  Mai mit 10 Tagen

Statistik (2. Halbjahr Jul-Dez 2025):
  Juli:      9 genehmigte Abwesenheiten
  August:    11 genehmigte Abwesenheiten
  September: 8 genehmigte Abwesenheiten
  Oktober:   9 genehmigte Abwesenheiten
  November:  7 genehmigte Abwesenheiten
  Dezember:  8 genehmigte Abwesenheiten
  ────────────────────────────────────
  2. Halbjahr:  52 genehmigte Abwesenheiten
  Durchschnitt:  8.67 pro Monat
  Spitzenwert:  August mit 11 Tagen

Gesamt 2025: 99 genehmigte Abwesenheiten
```

---

## 🔧 Technical Stack

### PDF Generation (ReportLab)

```python
from reportlab.platypus import Table, SimpleDocTemplate
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm

# Page setup
doc = SimpleDocTemplate(
    buffer,
    pagesize=landscape(A4),
    topMargin=10*mm,
    bottomMargin=10*mm,
    leftMargin=10*mm,
    rightMargin=10*mm
)

# 6-column table
table = Table(data, colWidths=[137*mm] * 6)
```

### Data Organization

```python
# Absence lookup structure
absence_dates = {}
for absence in absences:
    for date in date_range(absence.start_date, absence.end_date):
        absence_dates[date] = True

# Day rendering
def render_day(month, day):
    date = Date(year, month, day)
    has_absence = date in absence_dates
    indicator = "•" if has_absence else " "
    return f"{weekday(date)}  {day:2d}  [{indicator}]"
```

---

## 📝 File References

### Documentation

- **Main Concept**: `docs/JAHRESURLAUBSKALENDER_REDESIGN_CONCEPT.md`
- **Visual Guide**: `docs/JAHRESURLAUBSKALENDER_VISUAL_GUIDE.md` (this file)
- **Current State**: `JAHRESURLAUBSKALENDER_ENHANCEMENT.md`

### Implementation Files

- **PDF Generator**: `src/backend/services/vacation_pdf_generator.py`
- **API Routes**: `src/backend/routes/vacation_pdf.py`
- **Tests**: `tests/backend/test_vacation_pdf.py`

---

## ✨ Summary

This redesign transforms the Jahresurlaubskalender into a **user-friendly, scannable calendar** that:

1. **Displays 6 months horizontally** for easy comparison
2. **Uses day-as-row layout** for intuitive scanning
3. **Maintains professional appearance** with clear typography
4. **Supports wall mounting** for office display
5. **Provides detailed statistics** for analysis
6. **Remains printable** at 300 DPI

The design balances **functionality** with **simplicity**, making it suitable for both administrative planning and team communication.
