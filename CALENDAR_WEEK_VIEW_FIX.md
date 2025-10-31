# Calendar Week View Events Display Fix

## Problem

Events were not displaying in the **Week View** of the calendar, even though they were visible in the **Month View**.

## Root Causes

### 1. **Dynamic Tailwind Classes Not Working**

The original code used template literals to create dynamic Tailwind class names:

```tsx
// ❌ This doesn't work - Tailwind needs static class names
className={`bg-${event.color}-500/10 border-${event.color}-500`}
```

Tailwind CSS requires **static class names at build time** and cannot dynamically generate classes from runtime values.

### 2. **Missing Positioning Context**

The week view wasn't providing a proper `relative` positioned container for the `absolute` positioned events, so the events weren't being positioned correctly within the day cells.

### 3. **Missing z-index for Layering**

Events needed `z-10` to ensure they appear above the time grid and are clickable.

## Solution Implemented

### 1. **Static Color Style Mapping** ✅

Created a `colorStyles` object that maps color names to pre-defined Tailwind classes:

```tsx
const colorStyles: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  blue: {
    bg: "bg-blue-500/10",
    border: "border-blue-500",
    text: "text-blue-500",
  },
  red: {
    bg: "bg-red-500/10",
    border: "border-red-500",
    text: "text-red-500",
  },
  // ... other colors
};
```

### 2. **Applied Static Classes to Events** ✅

Used the color mapping to apply static Tailwind classes:

```tsx
className={cn(
  'px-3 py-1.5 cursor-pointer transition-all duration-300 border rounded-md',
  colorStyle.bg,      // Static class from map
  colorStyle.border,  // Static class from map
  'hover:opacity-75',
  !month && 'absolute z-10',  // Proper positioning and layering
  // ... other classes
)}
```

### 3. **Fixed Positioning Context in Day Content** ✅

Updated `calendar-body-day-content.tsx` to provide proper positioning:

```tsx
<div className="flex-1 relative overflow-hidden">
  {/* Time grid */}
  {hours.map((hour) => (
    <div key={hour} className="h-32 border-b border-border/50 group" />
  ))}

  {/* Absolute positioned container for events */}
  <div className="absolute inset-0 pointer-events-none">
    {dayEvents.map((event) => (
      <div key={event.id} className="absolute inset-0 pointer-events-auto">
        <CalendarEvent event={event} currentDay={date} />
      </div>
    ))}
  </div>
</div>
```

## Files Modified

1. **`src/frontend/src/components/calendar/calendar-event.tsx`**

   - Added `colorStyles` mapping
   - Created `getColorStyle()` helper function
   - Updated className generation to use static classes
   - Added `z-10` for proper layering

2. **`src/frontend/src/components/calendar/body/day/calendar-body-day-content.tsx`**
   - Added `relative overflow-hidden` to the day content container
   - Wrapped events in an absolute positioned container
   - Used `pointer-events-auto` to ensure events are clickable

## Result

✅ Events now display correctly in **Week View**
✅ Events are clickable and interactive
✅ Proper color-coded styling
✅ Consistent with **Month View** display
✅ Proper event positioning at correct times
✅ Multi-day events work correctly

## Testing

To verify the fix:

1. Navigate to the calendar
2. Switch between **Month View** and **Week View**
3. Verify events display in both views
4. Click on events to open the management dialog
5. Verify events show at the correct times

## Technical Notes

- Tailwind CSS cannot generate dynamic class names from runtime values
- The solution uses a finite set of predefined colors (blue, red, green, yellow, purple, pink, indigo, cyan)
- If additional colors are needed, add them to the `colorStyles` map
- The `pointer-events` management ensures proper click handling in nested containers
