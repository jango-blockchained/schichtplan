# Multi-Day Event Spanning - Implementation Complete

## Problem Solved

Multi-day events were showing as separate individual entries on each day instead of spanning visually across the calendar cells.

## Solution Implemented

Refactored the calendar layout to use **two separate overlay systems**:

### 1. **Multi-Day Events Layer** (z-index: 10)

- Renders events that span 2+ days as visual bars
- Calculates span across the calendar grid
- Uses percentage-based positioning for responsive layout
- Events span from first day to last day in a week (wraps at week boundaries)

**Logic**:

```typescript
// Find event boundaries
const startIndex = calendarDays.findIndex((day) => isSameDay(day, event.start));
const endIndex = calendarDays.findIndex((day) => isSameDay(day, event.end));

// Calculate visual span
const cellsInThisWeek = Math.min(
  7 - (startIndex % 7),
  endIndex - startIndex + 1
);
const columnStart = startIndex % 7;
const width = cellsInThisWeek * cellWidth;
```

### 2. **Single-Day Events Layer** (z-index: 20)

- Renders events that occur only on one day
- Positioned within individual day cells
- Stacked vertically with gaps
- Higher z-index so they appear on top

**Logic**:

```typescript
const dayEvents = visibleEvents.filter(
  (event) => isSameDay(event.start, day) && isSameDay(event.end, day)
);
```

### 3. **Day Cells Layer** (z-index: default)

- Bare grid cells with day numbers only
- Positioned absolutely to allow event overlays
- Day number positioned in top-left corner

## Visual Result

### Before

```
Oct 6:  Thomas Weber - Urlaub
Oct 7:  Thomas Weber - Urlaub
Oct 8:  Thomas Weber - Urlaub
Oct 9:  Thomas Weber - Urlaub
```

(Separate entries for each day)

### After

```
Oct 6-9: [============ Thomas Weber - Urlaub ============]
```

(Single spanning bar across all 4 days)

## Technical Details

### Positioning Strategy

- **Absolute positioning**: All events use absolute positioning within grid container
- **Percentage-based**: Left/width calculated as percentage of calendar width
- **Row calculation**: `top = rowIndex * (100 / numRows)%`
- **Responsive**: Works with any calendar width

### Event Rendering Order

1. Day cells (grid cells with borders and date)
2. Multi-day events (spanning bars, z-index 10)
3. Single-day events (stacked in cells, z-index 20)

### Day Cell Structure

```
┌─────────────────────┐
│ 6                   │ ← Positioned absolutely (top-2, left-2)
│                     │
│                     │ ← Empty space for event bar
│                     │
└─────────────────────┘
```

## Layout Calculation

```
Calendar Grid: 7 columns × N rows
Cell Width: 100% / 7 = 14.28%
Cell Height: 100% / N = variable

Multi-day Event Span:
- Left: (columnStart * cellWidth)%
- Width: (numCellsSpanning * cellWidth)%
- Top: (weekRow * 100/N)%
- Height: 100/N%
```

## Event Handling

### Multi-day Events

- Only rendered once per week row
- Wraps at week boundaries
- Spans up to 7 days in a single row

### Single-day Events

- Rendered in overlay on top of spanning events
- Stacked vertically within day cell
- Can show multiple single-day events per day

## Files Modified

- `src/frontend/src/components/calendar/body/month/calendar-body-month.tsx`

## Key Features

✅ **Proper Multi-day Spanning**: Events visually span across calendar cells
✅ **Week Boundary Wrapping**: Events wrap to next row at week end
✅ **Responsive**: Percentage-based positioning works at any width
✅ **Layered Rendering**: Proper z-index ordering for overlap handling
✅ **Backward Compatible**: Single-day events still work as before
✅ **Compact Display**: Time info shown only on first/last day

## Testing Recommendations

- [ ] Multi-day events spanning 2-7 days
- [ ] Events spanning across week boundaries
- [ ] Multiple single-day events in same cell
- [ ] Mixed multi-day and single-day events
- [ ] Hover interactions on event bars
- [ ] Edit/delete functionality
- [ ] Event details display (first/last day info)
- [ ] Responsive resizing of browser window
