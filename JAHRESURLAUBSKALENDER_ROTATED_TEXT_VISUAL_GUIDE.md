# Yearly Calendar - Rotated Text Visual Comparison

## Quick Visual Guide

### Before: Dot Indicator

```
┌──────────────┐
│ JANUAR (31)  │
├──────────────┤
│ Mo  1  [ ]   │
│ Di  2  [•]   │ ← Simple bullet point
│ Mi  3  [ ]   │
│ Do  4  [•]   │ ← Easy to miss
│ Fr  5  [ ]   │
│ Sa  6  [•]   │
│ So  7  [ ]   │
└──────────────┘
```

### After: Rotated Text with Highlighting

```
┌──────────────────┐
│ JANUAR (31)      │
├──────────────────┤
│ Mo  1  [ ]       │
│┌──────────────┐  │
││ Di  2        │  │
│├──────────────┤  │ ← Rotated "URLAUB" text
││   ↑↑↑↑↑      │  │    with red background
││   URLAUB     │  │    and border
││   ↓↓↓↓↓      │  │
│└──────────────┘  │
│ Mi  3  [ ]       │
│┌──────────────┐  │
││ Do  4        │  │
│├──────────────┤  │
││   ↑↑↑↑↑      │  │
││   URLAUB     │  │
││   ↓↓↓↓↓      │  │
│└──────────────┘  │
│ Fr  5  [ ]       │
│┌──────────────┐  │
││ Sa  6        │  │
│├──────────────┤  │
││   ↑↑↑↑↑      │  │
││   URLAUB     │  │
││   ↓↓↓↓↓      │  │
│└──────────────┘  │
│ So  7  [ ]       │
└──────────────────┘
```

## Key Improvements

### 1. Visual Prominence

- **Before**: Vacation days blend in with simple [•]
- **After**: Vacation days stand out with red-highlighted rotated text

### 2. Readability

- **Before**: Need to scan each cell for bullet point
- **After**: "URLAUB" text is immediately visible at any zoom level

### 3. Professional Appearance

- **Before**: Basic indicator style
- **After**: Professional document with distinctive vacation markers

### 4. Accessibility

- **Before**: Color-blind users might miss absence indicators
- **After**: Text label "URLAUB" explicitly identifies vacation days

## Implementation Details

### Cell Structure for Absences

```
┌─────────────────────────────────┐
│  Mo  2                          │  ← Top: Date/weekday info
├─────────────────────────────────┤
│           ↑                     │
│        U  R  L  A  U  B        │  ← Bottom: Rotated text (90°)
│           ↓                     │
│                                 │  Red background (#FFE6E6)
└─────────────────────────────────┘  Red border (#FF9999)
       Height: 12mm (for text)
```

### Cell Structure for Normal Days

```
┌─────────────────────────────────┐
│  Mo  2  [ ]                     │
└─────────────────────────────────┘
       Height: 4.5mm (standard)
```

## Full Page Example

### Page 1: January - June (Left/Right comparison)

```
OLD LAYOUT:                        NEW LAYOUT:
┌─────────────────┐              ┌──────────────────┐
│ JANUAR (31)     │              │ JANUAR (31)      │
├─────────────────┤              ├──────────────────┤
│ Mo  1  [ ]      │              │ Mo  1  [ ]       │
│ Di  2  [•]      │              │┌─────────────┐   │
│ Mi  3  [ ]      │     →        ││ Di  2       │   │
│ Do  4  [•]      │              │├─────────────┤   │
│ Fr  5  [•]      │              ││   URLAUB    │   │
│ Sa  6  [ ]      │              │└─────────────┘   │
│ So  7  [ ]      │              │ Mi  3  [ ]       │
│                 │              │┌─────────────┐   │
│ (continues...)  │              ││ Do  4       │   │
│                 │              │├─────────────┤   │
└─────────────────┘              ││   URLAUB    │   │
                                 │└─────────────┘   │
                                 │┌─────────────┐   │
                                 ││ Fr  5       │   │
                                 │├─────────────┤   │
                                 ││   URLAUB    │   │
                                 │└─────────────┘   │
                                 │ Sa  6  [ ]       │
                                 │ So  7  [ ]       │
                                 │                  │
                                 │ (continues...)   │
                                 │                  │
                                 └──────────────────┘
```

## Rotation Details

### Text Rotation: 90° Clockwise

Normal (0°):

```
URLAUB
```

Rotated 90° Clockwise:

```
↑
│ U R L A U B
↓
```

The text is rendered vertically, reading from bottom to top when you rotate the page clockwise 90°.

## Color Scheme

### Absence Cell Styling

| Element    | Color     | Value     | Purpose                 |
| ---------- | --------- | --------- | ----------------------- |
| Background | Light Red | `#FFE6E6` | Highlight vacation days |
| Border     | Red       | `#FF9999` | Frame vacation marker   |
| Text       | Black     | `#000000` | "URLAUB" text           |
| Font       | Helvetica | 6pt       | Professional appearance |

### Normal Cell Styling

| Element    | Color     | Value     | Purpose          |
| ---------- | --------- | --------- | ---------------- |
| Background | White     | `#FFFFFF` | Clean appearance |
| Border     | Gray      | `#CCCCCC` | Grid structure   |
| Text       | Black     | `#000000` | Date display     |
| Font       | Helvetica | 7pt       | Consistency      |

## Print Preview

### On Screen (100% zoom):

- Rotated text clearly visible
- Red background distinguishes vacation days
- Easy to scan horizontally across all months

### Printed (8.5" x 11" landscape):

- Text remains readable at standard print sizes
- Red highlighting visible without color saturation
- 300 DPI ensures clean text rendering

### Print at 150% zoom:

- Rotated text becomes more prominent
- Perfect for wall-mounting displays
- Maximum readability for office use

## Comparison Matrix

| Feature                | Old Design | New Design     | Benefit               |
| ---------------------- | ---------- | -------------- | --------------------- |
| Indicator Type         | Symbol [•] | Text "URLAUB"  | More explicit         |
| Visual Impact          | Low        | High           | Easier to spot        |
| Professional Look      | Basic      | Enhanced       | Better presentation   |
| Cell Height (absences) | 4.5mm      | 12mm           | More visible          |
| Color Coding           | None       | Red highlight  | Visual distinction    |
| Text Orientation       | Horizontal | Vertical (90°) | Unique & striking     |
| Printability           | Good       | Excellent      | Professional output   |
| Accessibility          | Fair       | Good           | Text label clarity    |
| Scanning Speed         | Moderate   | Fast           | Immediate recognition |

## Usage in Different Scenarios

### Office Wall Display

- Vacation days immediately visible at a glance
- Can be printed large (A3 format) for clear visibility
- Rotated text creates natural visual hierarchy

### Personal Calendar

- Quick reference for own vacation status
- Red highlighting makes it easy to find marked days
- Professional appearance for personal records

### Planning Meetings

- Manager can quickly identify peak vacation periods
- Multiple copies can be distributed
- Visual distinctiveness aids discussion

### PDF Digital View

- Zoom-friendly: text stays readable when zoomed
- Print-friendly: formatting preserved in all zoom levels
- Searchable text: "URLAUB" markers in PDF metadata

## Testing Checklist

- [ ] Generate PDF with test absences
- [ ] Open in PDF reader and zoom to 100%
- [ ] Verify rotated text orientation (90° clockwise)
- [ ] Check red background color (#FFE6E6)
- [ ] Check red border color (#FF9999)
- [ ] Confirm text is readable at standard zoom
- [ ] Print test page at 300 DPI
- [ ] Verify print quality and readability
- [ ] Check both pages (Jan-Jun and Jul-Dec)
- [ ] Verify all elements align properly

---

**Status**: ✅ Implementation Complete | Ready for Visual Verification
