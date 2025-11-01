# Jahresurlaubskalender Redesign - Visual Implementation Guide

## Overview

This document provides detailed visual examples and implementation guidance for the redesigned Jahresurlaubskalender PDF layout. It supplements the main design concept with concrete mockups for developers and designers.

---

## Single Month Column Example

### Standard Month Layout

```
┌────────────────────────┐
│    JANUAR 2025 (31)    │
├────────────────────────┤
│ Mo   1  [•]            │
│ Di   2  [•]            │
│ Mi   3  [ ]            │
│ Do   4  [•]            │
│ Fr   5  [ ]            │
│ Sa   6  [•]            │
│ So   7  [ ]            │
│ Mo   8  [•]            │
│ Di   9  [ ]            │
│ Mi  10  [•]            │
│ Do  11  [ ]            │
│ Fr  12  [•]            │
│ Sa  13  [ ]            │
│ So  14  [•]            │
│ Mo  15  [ ]            │
│ Di  16  [•]            │
│ Mi  17  [ ]            │
│ Do  18  [•]            │
│ Fr  19  [ ]            │
│ Sa  20  [ ]            │
│ So  21  [•]            │
│ Mo  22  [•]            │
│ Di  23  [ ]            │
│ Mi  24  [•]            │
│ Do  25  [ ]            │
│ Fr  26  [ ]            │
│ Sa  27  [•]            │
│ So  28  [ ]            │
│ Mo  29  [•]            │
│ Di  30  [ ]            │
│ Mi  31  [ ]            │
└────────────────────────┘
```

### Dimensions & Alignment

```
Column width: ~137mm
Header height: 8mm
Row height: 4-5mm (allows ~31 rows per month)

Content within column:
- 2mm left padding
- 20mm weekday + date
- 10mm indicator box
- 2mm right padding
= 36mm content width per 137mm column
```

---

## Two-Column Comparison

### Side-by-Side View

```
January vs February Layout:

┌────────────────────────┬────────────────────────┐
│    JANUAR (31 days)    │   FEBRUAR (28 days)    │
├────────────────────────┼────────────────────────┤
│ Mo   1  [•]            │ Mo   1  [ ]            │
│ Di   2  [•]            │ Di   2  [•]            │
│ Mi   3  [ ]            │ Mi   3  [•]            │
│ Do   4  [•]            │ Do   4  [ ]            │
│ Fr   5  [ ]            │ Fr   5  [•]            │
│ Sa   6  [•]            │ Sa   6  [ ]            │
│ So   7  [ ]            │ So   7  [•]            │
│ Mo   8  [•]            │ Mo   8  [•]            │
│ Di   9  [ ]            │ Di   9  [ ]            │
│ Mi  10  [•]            │ Mi  10  [•]            │
│ Do  11  [ ]            │ Do  11  [ ]            │
│ Fr  12  [•]            │ Fr  12  [•]            │
│ Sa  13  [ ]            │ Sa  13  [ ]            │
│ So  14  [•]            │ So  14  [•]            │
│ Mo  15  [ ]            │ Mo  15  [ ]            │
│ Di  16  [•]            │ Di  16  [•]            │
│ Mi  17  [ ]            │ Mi  17  [ ]            │
│ Do  18  [•]            │ Do  18  [•]            │
│ Fr  19  [ ]            │ Fr  19  [ ]            │
│ Sa  20  [ ]            │ Sa  20  [•]            │
│ So  21  [•]            │ So  21  [ ]            │
│ Mo  22  [•]            │ Mo  22  [•]            │
│ Di  23  [ ]            │ Di  23  [ ]            │
│ Mi  24  [•]            │ Mi  24  [•]            │
│ Do  25  [ ]            │ Do  25  [ ]            │
│ Fr  26  [ ]            │ Fr  26  [•]            │
│ Sa  27  [•]            │ Sa  27  [ ]            │
│ So  28  [ ]            │ So  28  [•]            │
│ Mo  29  [•]            │       —  [-]           │
│ Di  30  [ ]            │       —  [-]           │
│ Mi  31  [ ]            │       —  [-]           │
└────────────────────────┴────────────────────────┘
```

---

## Three-Month Row (Half Page)

### Compact Display

```
┌─────────┬─────────┬─────────┐
│ JANUAR  │ FEBRUAR │ MÄRZ    │
├─────────┼─────────┼─────────┤
│Mo 1 [•] │Mo 1 [ ] │Mi 1 [ ] │
│Di 2 [•] │Di 2 [•] │Do 2 [•] │
│Mi 3 [ ] │Mi 3 [•] │Fr 3 [ ] │
│Do 4 [•] │Do 4 [ ] │Sa 4 [•] │
│Fr 5 [ ] │Fr 5 [•] │So 5 [ ] │
│Sa 6 [•] │Sa 6 [ ] │Mo 6 [•] │
│So 7 [ ] │So 7 [•] │Di 7 [ ] │
│Mo 8 [•] │Mo 8 [•] │Mi 8 [ ] │
│Di 9 [ ] │Di 9 [ ] │Do 9 [•] │
│Mi10 [•] │Mi10 [•] │Fr10 [ ] │
│Do11 [ ] │Do11 [ ] │Sa11 [ ] │
│Fr12 [•] │Fr12 [•] │So12 [•] │
│Sa13 [ ] │Sa13 [ ] │Mo13 [ ] │
│So14 [•] │So14 [ ] │Di14 [•] │
│Mo15 [ ] │Mo15 [ ] │Mi15 [•] │
│Di16 [•] │Di16 [•] │Do16 [ ] │
│Mi17 [ ] │Mi17 [ ] │Fr17 [ ] │
│Do18 [•] │Do18 [•] │Sa18 [•] │
│Fr19 [ ] │Fr19 [ ] │So19 [ ] │
│Sa20 [ ] │Sa20 [•] │Mo20 [•] │
│So21 [•] │So21 [ ] │Di21 [ ] │
│Mo22 [•] │Mo22 [•] │Mi22 [ ] │
│Di23 [ ] │Di23 [ ] │Do23 [•] │
│Mi24 [•] │Mi24 [ ] │Fr24 [ ] │
│Do25 [ ] │   -     │Sa25 [•] │
│Fr26 [ ] │   -     │So26 [ ] │
│Sa27 [•] │   -     │Mo27 [ ] │
│So28 [ ] │         │Di28 [•] │
│Mo29 [•] │         │Mi29 [ ] │
│Di30 [ ] │         │Do30 [•] │
│Mi31 [ ] │         │Fr31 [ ] │
└─────────┴─────────┴─────────┘
```

---

## Full Six-Month Page (Actual Layout)

### Page 1: January through June

```
╔════════════════════════════════════════════════════════════════╗
║                 JAHRESURLAUBSKALENDER 2025                     ║
║              JANUAR - JUNI (1. HALBJAHR)                       ║
║                                                                ║
║ Filiale: TEDi Testfiliale                Erstellt: 01.01.2025 ║
╠════╦════╦════╦════╦════╦════╣
║ JAN║ FEB║MÄR ║APR ║ MAI║ JUN║
╠════╬════╬════╬════╬════╬════╣
║ 1  ║ 1  ║ 1  ║ 1  ║ 1  ║ 1  ║
║M[•]║M[ ]║Mi[ ]║S[ ]║Th[•]║S[•]║
║ 2  ║ 2  ║ 2  ║ 2  ║ 2  ║ 2  ║
║Di[•]║Di[•]║Do[•]║So[•]║Fr[•]║Mo[•]║
║ 3  ║ 3  ║ 3  ║ 3  ║ 3  ║ 3  ║
║Mi[ ]║Mi[•]║Fr[ ]║Mo[•]║Sa[ ]║Di[ ]║
║ 4  ║ 4  ║ 4  ║ 4  ║ 4  ║ 4  ║
║Do[•]║Do[ ]║Sa[•]║Di[ ]║So[•]║Mi[•]║
║ 5  ║ 5  ║ 5  ║ 5  ║ 5  ║ 5  ║
║Fr[ ]║Fr[•]║So[ ]║We[ ]║Mo[•]║Do[ ]║
║ 6  ║ 6  ║ 6  ║ 6  ║ 6  ║ 6  ║
║Sa[•]║Sa[ ]║Mo[•]║Th[•]║Di[ ]║Fr[•]║
║ 7  ║ 7  ║ 7  ║ 7  ║ 7  ║ 7  ║
║So[ ]║So[•]║Di[ ]║Fr[ ]║We[•]║Sa[ ]║
║ 8  ║ 8  ║ 8  ║ 8  ║ 8  ║ 8  ║
║Mo[•]║Mo[•]║We[ ]║Sa[ ]║Th[ ]║So[•]║
║ 9  ║ 9  ║ 9  ║ 9  ║ 9  ║ 9  ║
║Di[ ]║Di[ ]║Th[•]║So[•]║Fr[•]║Mo[ ]║
║10  ║10  ║10  ║10  ║10  ║10  ║
║Mi[•]║Mi[•]║Fr[ ]║Mo[•]║Sa[ ]║Di[•]║
║11  ║11  ║11  ║11  ║11  ║11  ║
║Th[ ]║Th[ ]║Sa[ ]║Di[ ]║So[ ]║We[ ]║
║12  ║12  ║12  ║12  ║12  ║12  ║
║Fr[•]║Fr[•]║So[•]║We[ ]║Mo[•]║Th[•]║
║13  ║13  ║13  ║13  ║13  ║13  ║
║Sa[ ]║Sa[ ]║Mo[ ]║Th[•]║Di[ ]║Fr[ ]║
║14  ║14  ║14  ║14  ║14  ║14  ║
║So[•]║So[ ]║Di[•]║Fr[ ]║We[•]║Sa[•]║
║15  ║15  ║15  ║15  ║15  ║15  ║
║Mo[ ]║Mo[ ]║We[•]║Sa[ ]║Th[ ]║So[ ]║
║16  ║16  ║16  ║16  ║16  ║16  ║
║Di[•]║Di[•]║Th[ ]║So[•]║Fr[•]║Mo[ ]║
║17  ║17  ║17  ║17  ║17  ║17  ║
║We[ ]║We[ ]║Fr[ ]║Mo[•]║Sa[ ]║Di[•]║
║18  ║18  ║18  ║18  ║18  ║18  ║
║Th[•]║Th[•]║Sa[•]║Di[ ]║So[ ]║We[ ]║
║19  ║19  ║19  ║19  ║19  ║19  ║
║Fr[ ]║Fr[ ]║So[ ]║We[•]║Mo[•]║Th[•]║
║20  ║20  ║20  ║20  ║20  ║20  ║
║Sa[ ]║Sa[•]║Mo[•]║Th[ ]║Di[ ]║Fr[ ]║
║21  ║21  ║21  ║21  ║21  ║21  ║
║So[•]║So[ ]║Di[ ]║Fr[•]║We[ ]║Sa[•]║
║22  ║22  ║22  ║22  ║22  ║22  ║
║Mo[•]║Mo[•]║We[ ]║Sa[ ]║Th[•]║So[•]║
║23  ║23  ║23  ║23  ║23  ║23  ║
║Di[ ]║Di[ ]║Th[•]║So[ ]║Fr[ ]║Mo[•]║
║24  ║24  ║24  ║24  ║24  ║24  ║
║We[•]║We[ ]║Fr[ ]║Mo[•]║Sa[•]║Di[•]║
║25  ║25  ║25  ║25  ║25  ║25  ║
║Th[ ]║—   ║Sa[•]║Di[ ]║So[ ]║We[ ]║
║26  ║—   ║26  ║26  ║26  ║26  ║
║Fr[ ]║—   ║So[ ]║We[•]║Mo[ ]║Th[•]║
║27  ║—   ║27  ║27  ║27  ║27  ║
║Sa[•]║—   ║Mo[•]║Th[ ]║Di[•]║Fr[•]║
║28  ║    ║28  ║28  ║28  ║28  ║
║So[ ]║    ║Di[ ]║Fr[•]║We[ ]║Sa[ ]║
║29  ║    ║29  ║29  ║29  ║29  ║
║Mo[•]║    ║We[ ]║Sa[ ]║Th[•]║So[•]║
║30  ║    ║30  ║30  ║30  ║30  ║
║Di[ ]║    ║Th[•]║Su[ ]║Fr[ ]║Mo[ ]║
║31  ║    ║31  ║    ║31  ║    ║
║We[ ]║    ║Fr[ ]║    ║Sa[ ]║    ║
╠════╬════╬════╬════╬════╬════╣
║Legende: • = Genehmigter Urlaubsantrag                         ║
║Statistik 1. HJ: 47 genehmigte Abwesenheiten                   ║
╚════╩════╩════╩════╩════╩════╝
```

---

## Absence Indicator Variations

### Single Employee Absence

```
Day with absence:
┌──────┐
│Mo 5  │
│[•]   │
└──────┘
```

### Multiple Employee Absences (Same Day)

**Option A: Multiple Dots**

```
Di 10
[•••]  ← 3 employees absent
```

**Option B: Count Indicator**

```
Di 10
[•×3]  ← Abbreviation for count
```

**Option C: Extended Legend**

```
Di 10
[•]    (EMP001, EMP002, EMP003)
```

**Recommended: Option A** (simplest, visually clear)

---

## Header & Footer Sections

### Page Header

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│         JAHRESURLAUBSKALENDER 2025                      │
│                                                         │
│   Filiale: TEDi Testfiliale Berlin                      │
│   Periode: 1. Januar - 30. Juni 2025                    │
│   Erstellt: 01. Januar 2025                             │
│   Berichtsheft: HR-Ressourcenplanung                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Page Footer

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│ Legende:                                                │
│ • = Genehmigter Urlaubsantrag (Approved Absence)       │
│ - = Nicht vorgesehen (Day does not exist in month)     │
│                                                         │
│ Statistik (1. Halbjahr Jan-Jun 2025):                  │
│   Insgesamt: 47 genehmigte Abwesenheiten               │
│   Durchschnitt pro Monat: 7.83 Tage                    │
│   Spitzenwert: Juni mit 9 Tagen                        │
│                                                         │
│ ────────────────────────────────────────────────────── │
│ Seite 1 von 2  │  Jahresurlaubskalender 2025           │
│ 01.01.2025     │  TEDi Testfiliale                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Cell Content Breakdown

### Day Cell Structure

```
Row Content (per column):
┌─────────────────────┐
│ Weekday Day [Status]│
└─────────────────────┘

Components:
1. Weekday (left-aligned):
   Mo, Di, Mi, Do, Fr, Sa, So (2-3 chars)

2. Day Number (center, right-padded):
   1, 2, ..., 31 (2 chars, right-aligned)

3. Status Indicator (right-aligned):
   [•] = Approved absence
   [ ] = No absence

Example Row:
"Di  15  [•]" = Tuesday, 15th, approved absence
"Sa   3  [ ]" = Saturday, 3rd, no absence
```

### Space Calculation

```
Total column width: ~137mm

Content allocation:
- Left margin: 2mm
- Weekday field: 20mm (for "Mo", spacing)
- Day number: 15mm (right-aligned "15")
- Separator: 3mm
- Indicator box: 12mm ("[•]")
- Right margin: 2mm
───────────────────────
Total: ~54mm actual, padded to 137mm with grid borders
```

---

## Typography & Styling Guide

### Font Selection

```
Primary Font: Helvetica (widely available, professional)
Fallback: Arial (system availability)
Print: DejaVu Sans (PDF compatibility)

Font Sizes:
- Title: 18pt (bold) - Page header
- Month Header: 12pt (bold) - Column header
- Day Content: 9pt (regular) - Day rows
- Legend: 8pt (regular) - Footer section
- Statistics: 7pt (regular) - Fine print
```

### Font Weights & Styles

```
Title: JAHRESURLAUBSKALENDER 2025
  Font: Helvetica Bold
  Size: 18pt
  Color: Black (#000000)

Month: JANUAR
  Font: Helvetica Bold
  Size: 12pt
  Color: Black (#000000)
  Background: Light Gray (#EEEEEE)

Day: "Mo  1  [•]"
  Font: Helvetica Regular
  Size: 9pt
  Color: Black (#000000)
  Background: White (#FFFFFF)

Legend: "• = Genehmigter Urlaubsantrag"
  Font: Helvetica Regular
  Size: 8pt
  Color: Black (#333333)
```

---

## Color Scheme Reference

### Standard Colors

| Element           | Color           | Hex     | RGB           | Usage            |
| ----------------- | --------------- | ------- | ------------- | ---------------- |
| Background        | White           | #FFFFFF | 255, 255, 255 | Page background  |
| Text              | Black           | #000000 | 0, 0, 0       | All text content |
| Borders           | Light Gray      | #CCCCCC | 204, 204, 204 | Grid lines       |
| Header Background | Very Light Gray | #EEEEEE | 238, 238, 238 | Column headers   |
| Cell Background   | White           | #FFFFFF | 255, 255, 255 | Data cells       |
| Indicator (•)     | Black           | #000000 | 0, 0, 0       | Absence marker   |

### Print vs. Digital Considerations

```
Print Version:
- Maximum contrast for legibility
- Black borders (1px)
- Gray shading for headers
- Black dots for indicators

Digital Version:
- Slightly softer borders (#DDDDDD)
- Optional blue hyperlinks for dates
- Interactive highlighting on hover
```

---

## Spacing & Measurements

### Horizontal Spacing (Per Page)

```
Page Width: 841.89mm (DIN A4 Landscape)

Layout:
- Left margin: 10mm
- Content width: 821.89mm
- Right margin: 10mm
- Total usable: 821.89mm

For 6 columns:
- Column width: 821.89mm ÷ 6 = ~136.98mm ≈ 137mm
- Gutter width: ~0.5mm (border)
- Content per column: ~136.5mm (accounting for borders)
```

### Vertical Spacing (Per Page)

```
Page Height: 595.28mm (DIN A4 Landscape)

Layout breakdown:
- Top margin: 10mm
- Title section: 20mm
- Column headers: 8mm
- Content rows: ~420mm (max 31 rows × 13.5mm)
- Legend section: 25mm
- Bottom margin: 10mm
- Total: ~493mm (leaves room for flexibility)
```

---

## Rendering Quality Specifications

### Print Resolution

```
DPI: 300 (Professional print quality)
Line Width: 0.5pt for borders
Font Anti-aliasing: ClearType (for screens)
```

### PDF Compression

```
Compression: Flate (standard PDF compression)
Image Quality: N/A (vector graphics only)
File Size Target: < 500KB per 2-page calendar
```

---

## Month-Specific Adjustments

### Short Months (Feb)

```
February has 28 days (29 in leap years)

Layout handling:
┌──────────────────┐
│ FEBRUAR (28)     │
├──────────────────┤
│ Mo   1  [ ]      │
│ Di   2  [•]      │
│ ...              │
│ So  28  [ ]      │
│ — [empty row]    │
│ — [empty row]    │
│ — [empty row]    │
└──────────────────┘

Note: Empty rows filled with "—" or blank cells
```

### Leap Year February

```
2024: 29 days (leap year)
┌──────────────────┐
│ FEBRUAR (29)     │
├──────────────────┤
│ Mo   1  [ ]      │
│ Di   2  [•]      │
│ ...              │
│ Do  29  [•]      │
│ — [empty row]    │
│ — [empty row]    │
└──────────────────┘
```

---

## Implementation Notes

### ReportLab Configuration

```python
from reportlab.platypus import Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

# Table structure for 6-month layout
data = []
for month_idx in range(6):
    data.append([month_name])  # Header row

for day in range(1, 32):  # Max 31 days
    row = []
    for month_idx in range(6):
        cell_content = generate_day_cell(month_idx, day)
        row.append(cell_content)
    data.append(row)

table = Table(data, colWidths=[137*mm for _ in range(6)])
table.setStyle(TableStyle([
    ('FONT', (0, 0), (-1, 0), 'Helvetica-Bold', 12),
    ('FONT', (0, 1), (-1, -1), 'Helvetica', 9),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#EEEEEE')),
    ('ROWHEIGHTS', [13.5*mm for _ in range(len(data))]),
]))
```

### Data Preparation

```python
# Query approved absences for the year
from datetime import date, timedelta

absence_lookup = {}
for absence in absences:
    current = absence.start_date
    while current <= absence.end_date:
        key = (current.month, current.day)
        absence_lookup[key] = True
        current += timedelta(days=1)

# Check if day has absence
def day_has_absence(month, day):
    return absence_lookup.get((month, day), False)
```

---

## Testing Checklist

- [ ] All 31 days render for January, March, May, July, August, October, December
- [ ] February renders 28 days (or 29 in leap years)
- [ ] April, June, September, November render 30 days
- [ ] Empty rows appear for missing days at end of short months
- [ ] Absence indicators (•) display correctly for all marked dates
- [ ] Column headers align across all 6 columns
- [ ] Legend renders at bottom with correct statistics
- [ ] Page breaks between Page 1 and Page 2
- [ ] Both pages render in landscape orientation
- [ ] Text remains readable at 300 DPI print resolution
- [ ] File size under 500KB for 2-page PDF

---

## Summary

This visual guide provides concrete mockups and specifications for implementing the redesigned Jahresurlaubskalender. The key features:

1. **Day-as-rows** layout for intuitive horizontal scanning
2. **6 months per page** in a single-row grid
3. **Clear absence indicators** with bullet points
4. **Professional typography** and spacing
5. **Comprehensive legends** and statistics
6. **Print-optimized** for 300 DPI output

All dimensions, colors, and specifications are documented for accurate implementation in ReportLab or similar PDF generation libraries.
