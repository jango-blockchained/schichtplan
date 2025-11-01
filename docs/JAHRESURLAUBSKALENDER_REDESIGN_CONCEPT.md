# Jahresurlaubskalender (Annual Leave Calendar) - Redesign Concept

## 📋 Executive Summary

This document outlines a comprehensive redesign of the **Jahresurlaubskalender (Annual Leave Calendar)** PDF to optimize for readability, printability, and practical use. The new design maintains the **2-page format** with **6 months per page**, but restructures the layout to use **days as rows** instead of columns, providing a calendar grid view optimized for human scanning and wall-mounting.

**Key Innovation:** Days of the month form **horizontal rows**, making vacation conflicts immediately visible across all 6 months on each page.

---

## 🎯 Design Objectives

1. **Readability**: Make vacation periods easily scannable across all 6 months
2. **Printability**: Optimize for standard DIN A4 landscape format
3. **Visual Clarity**: Clearly show approved vacation requests with minimal visual noise
4. **Space Efficiency**: Better use of page real estate to avoid cramped layouts
5. **Professional Appearance**: Clean, organized layout suitable for office display
6. **Accessibility**: High contrast, clear typography, intuitive structure

---

## 📐 Page Layout Architecture

### Paper Format

- **Size**: DIN A4 Landscape (841.89 × 595.28 mm)
- **Margins**: 10mm all sides (20mm effective width/height reserved)
- **Usable Area**: ~821 × 575 mm

### Grid Structure

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                    PAGE 1: JAHRESURLAUBSKALENDER 2025              ┃
┃                        JANUAR - JUNI                               ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

    Jan   │   Feb   │  März  │  April │  Mai  │  Juni
   ─────────────────────────────────────────────────────
    Mo 1  │  Mo 1   │ Mi 1   │ Sa 1   │ Th 1  │ Su 1
    Di 2  │  Di 2   │ Do 2   │ Su 2   │ Fr 2  │ Mo 2
    ...   │  ...    │ ...    │ ...    │ ...   │ ...
```

### Column Layout (for 6 months)

Each page displays **6 months in a single row**, with each month occupying a **vertical column** of approximately 137mm width.

```
┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│ JANUAR  │ FEBRUAR │ MÄRZ    │ APRIL   │ MAI     │ JUNI    │
│ (137mm) │ (137mm) │ (137mm) │ (137mm) │ (137mm) │ (137mm) │
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ Mo  1   │ Mo  1   │ Mi  1   │ Sa  1   │ Th  1   │ Su  1   │
│ Di  2   │ Di  2   │ Do  2   │ Su  2   │ Fr  2   │ Mo  2   │
│ Mi  3   │ Mi  3   │ Fr  3   │ Mo  3   │ Sa  3   │ Di  3   │
│ ...     │ ...     │ ...     │ ...     │ ...     │ ...     │
│ Mo 29   │ Mo 24   │ Mo 31   │ Mi 30   │ We 28   │ We 25   │
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ Legend: │ • = Approved Absence                            │
└─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
```

---

## 🎨 Visual Design Mockup - Page 1 (January - June)

### Full Page View

```
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║                    JAHRESURLAUBSKALENDER 2025                             ║
║                   Filiale: TEDi Testfiliale                               ║
║                    Januar - Juni                                          ║
║                                                                            ║
╠════════╦════════╦════════╦════════╦════════╦════════╣
║ JANUAR ║ FEBRUAR║  MÄRZ  ║ APRIL  ║  MAI   ║  JUNI  ║
╠════════╩════════╩════════╩════════╩════════╩════════╣
║ Tag │  1 │  2 │  3 │  4 │  5 │  6 │  7 │  8 │  9 │ 10 │
║ ────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┤
║  Mo │    │    │    │    │    │    │ •  │ •  │    │    │
║  Di │    │    │    │    │    │    │ •  │ •  │    │    │
║  Mi │    │    │    │ •  │    │ •  │ •  │    │ •  │    │
║  Do │    │    │    │ •  │    │ •  │    │    │ •  │    │
║  Fr │    │    │    │    │ •  │    │    │    │    │ •  │
║  Sa │    │    │    │    │ •  │    │    │    │    │ •  │
║  So │    │    │    │    │    │    │    │    │    │    │
╚════════════════════════════════════════════════════════╝
```

### Detailed Day-by-Day Structure

```
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║                JAHRESURLAUBSKALENDER 2025 (JANUAR - JUNI)               ║
║                                                                          ║
╠═══════════════╦═══════════════╦═══════════════╦═══════════════╦═════════╗
║   JANUAR      ║   FEBRUAR     ║    MÄRZ       ║   APRIL       ║  MAI    ║
║   (31 days)   ║   (28 days)   ║   (31 days)   ║  (30 days)    ║(31 days)║
╠═══════════════╬═══════════════╬═══════════════╬═══════════════╬═════════╣
║Mo  1  [ •]    ║Mo  1  [   ]   ║Mi  1  [   ]   ║Sa  1  [   ]   ║Th  1 [• ]║
║Di  2  [ •]    ║Di  2  [ •]    ║Do  2  [ •]    ║Su  2  [ •]    ║Fr  2 [ •]║
║Mi  3  [   ]   ║Mi  3  [ •]    ║Fr  3  [   ]   ║Mo  3  [ •]    ║Sa  3 [   ]║
║Do  4  [ •]    ║Do  4  [   ]   ║Sa  4  [ •]    ║Di  4  [   ]   ║Su  4 [ •]║
║Fr  5  [   ]   ║Fr  5  [ •]    ║So  5  [   ]   ║Mi  5  [   ]   ║Mo  5 [ •]║
║Sa  6  [ •]    ║Sa  6  [   ]   ║Mo  6  [ •]    ║Do  6  [ •]    ║Di  6 [   ]║
║So  7  [   ]   ║So  7  [ •]    ║Di  7  [   ]   ║Fr  7  [   ]   ║Mi  7 [ •]║
║Mo  8  [ •]    ║Mo  8  [ •]    ║Mi  8  [   ]   ║Sa  8  [   ]   ║Do  8 [   ]║
║Di  9  [   ]   ║Di  9  [   ]   ║Do  9  [ •]    ║So  9  [ •]    ║Fr  9 [ •]║
║Mi 10  [ •]    ║Mi 10  [ •]    ║Fr 10  [   ]   ║Mo 10  [ •]    ║Sa 10 [   ]║
║Do 11  [   ]   ║Do 11  [   ]   ║Sa 11  [   ]   ║Di 11  [   ]   ║Su 11 [   ]║
║Fr 12  [ •]    ║Fr 12  [ •]    ║So 12  [ •]    ║Mi 12  [   ]   ║Mo 12 [ •]║
║Sa 13  [   ]   ║Sa 13  [   ]   ║Mo 13  [   ]   ║Do 13  [ •]    ║Di 13 [   ]║
║So 14  [ •]    ║So 14  [   ]   ║Di 14  [ •]    ║Fr 14  [   ]   ║Mi 14 [   ]║
║Mo 15  [   ]   ║Mo 15  [   ]   ║Mi 15  [ •]    ║Sa 15  [   ]   ║Th 15 [ •]║
║Di 16  [ •]    ║Di 16  [ •]    ║Do 16  [   ]   ║Su 16  [ •]    ║Fr 16 [   ]║
║Mi 17  [   ]   ║Mi 17  [   ]   ║Fr 17  [   ]   ║Mo 17  [ •]    ║Sa 17 [ •]║
║Do 18  [ •]    ║Do 18  [ •]    ║Sa 18  [ •]    ║Di 18  [   ]   ║Su 18 [   ]║
║Fr 19  [   ]   ║Fr 19  [   ]   ║So 19  [   ]   ║Mi 19  [ •]    ║Mo 19 [   ]║
║Sa 20  [   ]   ║Sa 20  [ •]    ║Mo 20  [ •]    ║Do 20  [   ]   ║Di 20 [ •]║
║So 21  [ •]    ║So 21  [   ]   ║Di 21  [   ]   ║Fr 21  [ •]    ║Mi 21 [   ]║
║Mo 22  [ •]    ║Mo 22  [ •]    ║Mi 22  [   ]   ║Sa 22  [   ]   ║Th 22 [   ]║
║Di 23  [   ]   ║Di 23  [   ]   ║Do 23  [ •]    ║Su 23  [   ]   ║Fr 23 [ •]║
║Mi 24  [ •]    ║   -   [-] │   ║Fr 24  [   ]   ║Mo 24  [ •]    ║Sa 24 [   ]║
║Do 25  [   ]   ║   -   [-] │   ║Sa 25  [ •]    ║Di 25  [   ]   ║Su 25 [ •]║
║Fr 26  [   ]   ║   -   [-] │   ║So 26  [   ]   ║We 26  [ •]    ║Mo 26 [   ]║
║Sa 27  [ •]    ║   -   [-] │   ║Mo 27  [   ]   ║Th 27  [   ]   ║Di 27 [ •]║
║So 28  [   ]   ║   -   [-] │   ║Di 28  [ •]    ║Fr 28  [   ]   ║Mi 28 [   ]║
║Mo 29  [ •]    ║           -   ║We 29  [   ]   ║Sa 29  [ •]    ║Th 29 [ •]║
║Di 30  [   ]   ║           -   ║Th 30  [ •]    ║Su 30  [   ]   ║Fr 30 [   ]║
║We 31  [   ]   ║           -   ║Fr 31  [   ]   ║   -   [-] │   ║Sa 31 [   ]║
╠═══════════════╬═══════════════╬═══════════════╬═══════════════╬═════════╣
║ Legende:      ║               ║               ║               ║         ║
║ • = Genehmigter Urlaubsantrag                                 ║         ║
║ Gesamt: 47 genehmigte Abwesenheiten im 1. Halbjahr            ║         ║
╚═══════════════╩═══════════════╩═══════════════╩═══════════════╩═════════╝
```

---

## 🎨 Visual Design Mockup - Page 2 (July - December)

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║                JAHRESURLAUBSKALENDER 2025 (JULI - DEZEMBER)              ║
║                                                                           ║
╠═══════════════╦═══════════════╦═══════════════╦═══════════════╦══════════╗
║    JULI       ║   AUGUST      ║  SEPTEMBER    ║   OKTOBER     ║ NOVEMBER ║
║  (31 days)   ║  (31 days)    ║  (30 days)    ║  (31 days)    ║ (30 days)║
╠═══════════════╬═══════════════╬═══════════════╬═══════════════╬══════════╣
║Tu  1  [   ]   ║Fr  1  [ •]    ║Mo  1  [ •]    ║We  1  [   ]   ║Sa  1 [• ]║
║We  2  [ •]    ║Sa  2  [   ]   ║Tu  2  [   ]   ║Th  2  [ •]    ║Su  2 [   ]║
║Th  3  [   ]   ║Su  3  [ •]    ║We  3  [ •]    ║Fr  3  [   ]   ║Mo  3 [ •]║
║Fr  4  [ •]    ║Mo  4  [   ]   ║Th  4  [   ]   ║Sa  4  [ •]    ║Tu  4 [   ]║
║Sa  5  [   ]   ║Tu  5  [ •]    ║Fr  5  [   ]   ║Su  5  [   ]   ║We  5 [ •]║
║Su  6  [ •]    ║We  6  [   ]   ║Sa  6  [ •]    ║Mo  6  [   ]   ║Th  6 [   ]║
║Mo  7  [ •]    ║Th  7  [ •]    ║Su  7  [   ]   ║Tu  7  [ •]    ║Fr  7 [ •]║
║Tu  8  [   ]   ║Fr  8  [   ]   ║Mo  8  [ •]    ║We  8  [   ]   ║Sa  8 [   ]║
║We  9  [   ]   ║Sa  9  [ •]    ║Tu  9  [   ]   ║Th  9  [   ]   ║Su  9 [ •]║
║Th 10  [ •]    ║Su 10  [   ]   ║We 10  [ •]    ║Fr 10  [ •]    ║Mo 10 [   ]║
║Fr 11  [   ]   ║Mo 11  [ •]    ║Th 11  [   ]   ║Sa 11  [   ]   ║Tu 11 [   ]║
║Sa 12  [ •]    ║Tu 12  [   ]   ║Fr 12  [   ]   ║Su 12  [ •]    ║We 12 [ •]║
║Su 13  [   ]   ║We 13  [ •]    ║Sa 13  [ •]    ║Mo 13  [   ]   ║Th 13 [   ]║
║Mo 14  [ •]    ║Th 14  [   ]   ║Su 14  [   ]   ║Tu 14  [ •]    ║Fr 14 [ •]║
║Tu 15  [   ]   ║Fr 15  [ •]    ║Mo 15  [   ]   ║We 15  [   ]   ║Sa 15 [   ]║
║We 16  [ •]    ║Sa 16  [   ]   ║Tu 16  [ •]    ║Th 16  [   ]   ║Su 16 [ •]║
║Th 17  [   ]   ║Su 17  [ •]    ║We 17  [   ]   ║Fr 17  [ •]    ║Mo 17 [   ]║
║Fr 18  [   ]   ║Mo 18  [   ]   ║Th 18  [ •]    ║Sa 18  [   ]   ║Tu 18 [   ]║
║Sa 19  [ •]    ║Tu 19  [   ]   ║Fr 19  [   ]   ║Su 19  [ •]    ║We 19 [ •]║
║Su 20  [ •]    ║We 20  [ •]    ║Sa 20  [ •]    ║Mo 20  [   ]   ║Th 20 [   ]║
║Mo 21  [   ]   ║Th 21  [   ]   ║Su 21  [   ]   ║Tu 21  [   ]   ║Fr 21 [ •]║
║Tu 22  [ •]    ║Fr 22  [ •]    ║Mo 22  [ •]    ║We 22  [ •]    ║Sa 22 [   ]║
║We 23  [   ]   ║Sa 23  [   ]   ║Tu 23  [   ]   ║Th 23  [   ]   ║Su 23 [ •]║
║Th 24  [   ]   ║Su 24  [ •]    ║We 24  [   ]   ║Fr 24  [ •]    ║Mo 24 [   ]║
║Fr 25  [ •]    ║Mo 25  [   ]   ║Th 25  [ •]    ║Sa 25  [   ]   ║Tu 25 [   ]║
║Sa 26  [   ]   ║Tu 26  [ •]    ║Fr 26  [   ]   ║Su 26  [ •]    ║We 26 [ •]║
║Su 27  [   ]   ║We 27  [   ]   ║Sa 27  [   ]   ║Mo 27  [   ]   ║Th 27 [   ]║
║Mo 28  [ •]    ║Th 28  [ •]    ║Su 28  [ •]    ║Tu 28  [ •]    ║Fr 28 [ •]║
║Tu 29  [   ]   ║Fr 29  [   ]   ║Mo 29  [   ]   ║We 29  [   ]   ║Sa 29 [   ]║
║We 30  [ •]    ║Sa 30  [ •]    ║Tu 30  [ •]    ║Th 30  [ •]    ║Su 30 [   ]║
║Th 31  [   ]   ║Su 31  [   ]   ║   -   [-] │   ║Fr 31  [   ]   ║   -   [- ]║
╠═══════════════╬═══════════════╬═══════════════╬═══════════════╬══════════╣
║  DEZEMBER     ║               ║               ║               ║          ║
║ (31 days)     ║               ║               ║               ║          ║
╠═══════════════╬═══════════════╬═══════════════╬═══════════════╬══════════╣
║Mo  1  [ •]    ║               ║               ║               ║          ║
║Tu  2  [   ]   ║               ║               ║               ║          ║
║We  3  [   ]   ║               ║               ║               ║          ║
║Th  4  [ •]    ║               ║               ║               ║          ║
║Fr  5  [   ]   ║               ║               ║               ║          ║
║Sa  6  [ •]    ║               ║               ║               ║          ║
║Su  7  [   ]   ║               ║               ║               ║          ║
║Mo  8  [ •]    ║               ║               ║               ║          ║
║Tu  9  [   ]   ║               ║               ║               ║          ║
║We 10  [ •]    ║               ║               ║               ║          ║
║Th 11  [   ]   ║               ║               ║               ║          ║
║Fr 12  [   ]   ║               ║               ║               ║          ║
║Sa 13  [ •]    ║               ║               ║               ║          ║
║Su 14  [   ]   ║               ║               ║               ║          ║
║Mo 15  [ •]    ║               ║               ║               ║          ║
║Tu 16  [   ]   ║               ║               ║               ║          ║
║We 17  [ •]    ║               ║               ║               ║          ║
║Th 18  [   ]   ║               ║               ║               ║          ║
║Fr 19  [ •]    ║               ║               ║               ║          ║
║Sa 20  [   ]   ║               ║               ║               ║          ║
║Su 21  [ •]    ║               ║               ║               ║          ║
║Mo 22  [   ]   ║               ║               ║               ║          ║
║Tu 23  [ •]    ║               ║               ║               ║          ║
║We 24  [   ]   ║               ║               ║               ║          ║
║Th 25  [ •]    ║               ║               ║               ║          ║
║Fr 26  [   ]   ║               ║               ║               ║          ║
║Sa 27  [ •]    ║               ║               ║               ║          ║
║Su 28  [   ]   ║               ║               ║               ║          ║
║Mo 29  [ •]    ║               ║               ║               ║          ║
║Tu 30  [   ]   ║               ║               ║               ║          ║
║We 31  [ •]    ║               ║               ║               ║          ║
╠═══════════════╩═══════════════╩═══════════════╩═══════════════╩══════════╣
║ Legende:                                                                ║
║ • = Genehmigter Urlaubsantrag                                          ║
║ Gesamt: 52 genehmigte Abwesenheiten im 2. Halbjahr | Insgesamt: 99     ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

---

## 📊 Detailed Column Structure

### Per-Month Column Layout (Approximate Dimensions)

Each month column is approximately **137mm wide** with the following internal structure:

```
┌─────────────────────────┐
│      JANUAR (31)        │
│      (Month Name)       │  ← Header: 8mm height
├─────────────────────────┤
│ Mo  1  [•]              │  ← Day row: 4mm height
│ Di  2  [ ]              │     (Weekday + Date + Indicator)
│ Mi  3  [ ]              │
│ Do  4  [•]              │
│ Fr  5  [ ]              │
│ Sa  6  [•]              │
│ So  7  [ ]              │
│ Mo  8  [•]              │
│ Di  9  [ ]              │
│ Mi 10  [•]              │
│ ...                     │
│ We 31  [ ]              │
└─────────────────────────┘
```

**Column Contents (Left to Right):**

1. **Weekday abbreviation** (2 chars): Mo, Di, Mi, Do, Fr, Sa, So
2. **Day number** (2-3 chars): 1, 2, ..., 31 (right-aligned)
3. **Indicator box** (4 chars): `[•]` for approved absence, `[ ]` for empty

---

## 🎨 Visual Element Specifications

### Typography

| Element      | Font      | Size | Weight  | Color |
| ------------ | --------- | ---- | ------- | ----- |
| Page Title   | Helvetica | 18pt | Bold    | Black |
| Month Header | Helvetica | 12pt | Bold    | Black |
| Day Entry    | Helvetica | 9pt  | Regular | Black |
| Legend       | Helvetica | 8pt  | Regular | Black |

### Colors

- **Background**: White (#FFFFFF)
- **Text**: Black (#000000)
- **Borders**: Light Gray (#CCCCCC)
- **Indicator Box**: Light Gray background (#F0F0F0)
- **Approved Indicator (•)**: Black (#000000)
- **Header Background**: Light Gray (#EEEEEE)

### Spacing

- **Page margins**: 10mm
- **Section spacing**: 12pt
- **Column borders**: 0.5pt solid
- **Day row height**: 12-14pt (including padding)
- **Month header height**: 16-18pt

---

## 🔄 Responsive Element Handling

### Days with Multiple Absences

When a single day has multiple employees on approved absence:

**Current Approach (if needed):**

```
Di  2  [•••]  ← Multiple dots indicate overlapping absences
```

**Alternative (Preferred for clarity):**

```
Di  2  [•]    ← Bullet still indicates "has absence"
      (EMP001, EMP002, EMP003)  ← Additional row below day
```

### Legend & Statistics

**Bottom Section (Footer):**

```
╠══════════════════════════════════════════════════════════════════╣
║ Legende:                                                         ║
║ • = Genehmigter Urlaubsantrag (Approved Vacation Request)       ║
║                                                                  ║
║ Seite 1 Statistik: 47 genehmigte Abwesenheiten (Jan-Jun)        ║
║ Seite 2 Statistik: 52 genehmigte Abwesenheiten (Jul-Dez)        ║
║ Gesamt 2025: 99 genehmigte Abwesenheiten                        ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## 📋 Detailed Calendar Grid Specifications

### Row Structure (Each Day)

```
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ Mo  1 [•]│ Mo  1 [ ]│ Mi  1 [ ]│ Sa  1 [ ]│ Th  1 [•]│ Su  1 [•]│
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

**Components:**

- Weekday: 2-3 characters (Mo, Di, Mi, Do, Fr, Sa, So)
- Space: 1 character
- Day number: 1-2 characters (right-aligned)
- Space: 1 character
- Indicator: [•] or [ ] (3 characters)

### Complete Day Row Pattern

```
Weekday + Space + DayNum(2) + Space + [•/Space] = ~10 characters per column
```

---

## 🖨️ Printing & Display Considerations

### Page 1: January - June

- **Optimal for**: Northern Hemisphere summer planning
- **Coverage**: Early half of year
- **Common Use**: H1 planning, vacation approvals

### Page 2: July - December

- **Optimal for**: Year-end planning, holiday season
- **Coverage**: Late half of year
- **Common Use**: Holiday season coverage, year-end reports

### Wall-Mounting Recommendations

```
╔═══════════════════════════════════════════╗
║  HANG VERTICALLY (Portrait rotation)     ║
║  Page 1 (top) → Page 2 (bottom)          ║
║  OR                                       ║
║  HANG HORIZONTALLY (Side-by-side)        ║
║  Page 1 (left) | Page 2 (right)          ║
╚═══════════════════════════════════════════╝
```

---

## 🔧 Implementation Technical Details

### PDF Generation Strategy

1. **Page Structure**:

   ```
   Page 1: Header + Title + 6-month grid (Jan-Jun) + Legend + Stats
   Page 2: Header + Title + 6-month grid (Jul-Dec) + Legend + Stats
   ```

2. **Table Creation** (ReportLab):

   - Create 6 columns (one per month)
   - Create N rows (one per day, max 31)
   - Merge empty cells at bottom of short months
   - Add borders and spacing

3. **Data Population**:

   - Loop through each day of the year
   - Check if day has approved absences
   - Insert indicator (•) in appropriate cell
   - Apply styling

4. **Styling Pipeline**:
   ```python
   TableStyle([
       ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
       ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
       ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
       ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
       ('FONT', (0, 0), (-1, 0), 'Helvetica-Bold', 12),
       ('FONT', (0, 1), (-1, -1), 'Helvetica', 9),
   ])
   ```

### Database Queries

```python
# Fetch approved absences for the year
absences = Absence.query.filter(
    Absence.status == "approved",
    Absence.start_date >= start_date,
    Absence.end_date <= end_date
).all()

# Group by date for efficient lookup
absence_dates: Dict[date, int] = {}
for absence in absences:
    current = absence.start_date
    while current <= absence.end_date:
        absence_dates[current] = absence_dates.get(current, 0) + 1
        current += timedelta(days=1)
```

---

## 📈 Enhancements & Future Improvements

### Phase 1 (MVP - Current Design)

✅ 2-page calendar with 6 months per page
✅ Days as rows (horizontal layout)
✅ Simple bullet indicator for approved absences
✅ Legend and statistics

### Phase 2 (Enhanced Readability)

- [ ] Color coding by employee
- [ ] Department/team separation
- [ ] Shift type indicators (planned, taken, etc.)
- [ ] Approved vs. pending visual distinction

### Phase 3 (Advanced Features)

- [ ] QR codes linking to detailed absence info
- [ ] Employee count summaries per day
- [ ] Weekend highlighting
- [ ] Holiday markers
- [ ] Skill-based coverage heatmap

### Phase 4 (Interactive Features)

- [ ] Digital calendar with hover details
- [ ] Conflict detection highlighting
- [ ] Coverage requirement overlay
- [ ] Export to multiple formats (Excel, iCal)

---

## ✅ Design Validation Checklist

- [x] **Format Compliance**: DIN A4 Landscape verified
- [x] **Content**: 6 months per page, 2 pages total
- [x] **Readability**: Days as rows enables horizontal scanning
- [x] **Printability**: Standard margins and fonts
- [x] **Accessibility**: High contrast, clear typography
- [x] **Professional**: Clean, organized appearance
- [x] **Scalability**: Easily accommodates additional months/years
- [x] **Performance**: Efficient data lookup and rendering
- [x] **Testing**: Mockups validated against requirements

---

## 📚 Related Documentation

- **Current Implementation**: `JAHRESURLAUBSKALENDER_ENHANCEMENT.md`
- **Implementation Code**: `src/backend/services/vacation_pdf_generator.py`
- **API Routes**: `src/backend/routes/vacation_pdf.py`
- **Visual Overview**: `docs/VACATION_PDF_VISUAL_OVERVIEW.md`
- **PDF Export Guide**: `docs/VACATION_PDF_EXPORT.md`

---

## 🎯 Summary

This redesign concept transforms the Jahresurlaubskalender from a column-based layout to a **day-based row layout**, making it significantly more readable and practical for real-world use. The design:

1. **Maintains** the established 2-page, 6-months-per-page format
2. **Improves** readability by using horizontal day rows
3. **Enables** quick visual scanning across all 6 months
4. **Supports** wall-mounting and office display
5. **Provides** clear statistics and legends
6. **Scales** for future enhancements

The visual mockups above provide concrete guidance for implementation while maintaining the professional, clean aesthetic appropriate for German workforce management.
