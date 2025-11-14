# UI Enhancements - Implementation Notes for Developers

## Overview

This document provides technical details for maintaining and extending the new UI features implemented in Schichtplan.

## Architecture

### Component Structure

```
App
└── MainLayout
    ├── SidebarProvider (auto-open enabled)
    ├── AppSidebar (navigation)
    ├── Main Content Area
    │   ├── Header (page width selector)
    │   └── Main (full/default width wrapper)
    │       └── Outlet (page content)
    └── GlobalAIDialog
        ├── AIAssistantOrb (button layer)
        ├── MinimalAIAssistant (popup layer)
        ├── ConversationalAIChat (full chat)
        └── Dialog (full-screen container)
```

## Component Details

### 1. AIAssistantOrb

**Location:** `src/frontend/src/components/ai/AIAssistantOrb.tsx`

**Key Features:**

- Canvas-based glow rendering
- Magnetic mouse interaction
- Particle system
- RequestAnimationFrame animation loop

**Important Methods:**

```typescript
createParticle(x, y); // Creates particle at position
handleMouseMove(e); // Tracks cursor for magnetic effect
animate(); // RAF loop for particles
```

**Customizable Constants:**

```typescript
MAGNETIC_RADIUS = 150; // Distance for magnetic effect
```

**State Management:**

- `mousePos`: Current cursor position (visual only)
- `orbPos`: Offset from button center (magnetic effect)
- `particles`: Active particle array
- `isHovering`: Hover state for effects

### 2. MinimalAIAssistant

**Location:** `src/frontend/src/components/ai/MinimalAIAssistant.tsx`

**Key Features:**

- Draggable container
- Expandable to full screen
- Message persistence
- Two-mode UI

**Important Methods:**

```typescript
handleMouseDown(e); // Start drag
handleSendMessage(); // Send chat message
handleExpand(); // Transition to full screen
```

**State Management:**

- `isOpen`: Visibility toggle
- `isExpanded`: Full-screen mode
- `messages`: Chat history
- `input`: Current text input
- `isDragging`: Drag state
- `position`: Draggable offset

**Position Tracking:**

- Uses mouse down/move/up events
- Stores delta from drag start
- Applies to fixed positioning

### 3. ConversationalAIChat (Enhanced)

**Location:** `src/frontend/src/components/ai/ConversationalAIChat.tsx`

**Changes Made:**

- Removed sidebar (was multi-column grid)
- Full-width message area
- Optimized spacing and sizing
- Removed context preview collapsible
- Enhanced header with animated icon

**Key Methods:**

```typescript
handleSendMessage(); // Process message
scrollToBottom(); // Auto-scroll messages
handleFeedback(); // Record user feedback
```

**Styling Highlights:**

- Message bubbles: `rounded-xl` with different colors
- Container: `max-w-4xl` for readable width
- Animations: `fade-in slide-in-from-bottom`
- Gradients: Background fade for depth

### 4. GlobalAIDialog (Enhanced)

**Location:** `src/frontend/src/components/ai/GlobalAIDialog.tsx`

**Features:**

- Orchestrates all three components
- Mode switching (minimal ↔ full)
- Keyboard shortcuts
- State coordination

**Important Props:**

```typescript
onMaximize(); // Callback from minimal to full
isOpen; // Visibility from useAIDialog hook
```

## State Management

### Using useAIDialog Hook

```typescript
import { useAIDialog } from "@/hooks/useAIDialog";

const { isOpen, closeDialog, toggleDialog } = useAIDialog();
```

### Local Component States

- **Orb:** `isHovering`, `particles`, `orbPos`
- **Minimal:** `isOpen`, `isExpanded`, `isDragging`, `position`, `messages`
- **Chat:** `messages`, `currentInput`, `isLoading`, `currentSession`
- **Dialog:** Managed by useAIDialog hook

## Styling System

### Tailwind Classes Used

```typescript
// Layout
"fixed", "relative", "absolute", "inset-0";
"flex", "flex-col", "gap-3", "p-4";

// Colors
"bg-gradient-to-br", "text-primary", "border-primary";
"bg-muted", "text-muted-foreground";

// Effects
"shadow-lg", "rounded-xl", "backdrop-blur";
"drop-shadow", "animate-pulse", "animate-spin";

// Responsive
"sm:", "md:", "lg:", "hidden", "flex";

// Animations
"transition-all", "duration-300", "ease-out";
"animate-in", "fade-in", "slide-in-from-bottom";
```

### Custom CSS

- Canvas rendering for Orb glow
- RequestAnimationFrame for particles
- CSS animations for borders and pulse

## Performance Considerations

### Optimization Techniques

1. **Particle System:**

   - Max ~50 particles at any time
   - Cleanup when opacity < 0.01
   - Efficient array filtering

2. **Canvas Rendering:**

   - Only redraws on hover state change
   - Efficient gradient calculations
   - Proper cleanup on unmount

3. **Animation Loop:**

   - Single RAF per component
   - Cleanup in useEffect return
   - No memory leaks

4. **Event Handlers:**
   - Debounced mouse move (via RAF)
   - Proper listener cleanup
   - Event capture for nested elements

### Memory Management

```typescript
// Cleanup example:
useEffect(() => {
  const animate = () => {
    /* ... */
  };
  const frameId = requestAnimationFrame(animate);
  return () => cancelAnimationFrame(frameId);
}, []);
```

## Browser Compatibility

### Supported Features

- Canvas API (for glow)
- RequestAnimationFrame (for animations)
- CSS transforms and transitions
- Gradient rendering
- Backdrop filters

### Fallbacks

- Canvas fails gracefully (glow doesn't render)
- Animations still work with CSS
- Performance degrades gracefully

### Tested On

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Testing Guidelines

### Unit Tests

```typescript
// Test magnetic attraction
test("Orb moves toward cursor", () => {
  // Mock mouse position
  // Assert position change
});

// Test particle creation
test("Particles spawn on hover", () => {
  // Mock hover
  // Assert particle count increases
});
```

### Integration Tests

```typescript
// Test drag functionality
test("Can drag minimal assistant", () => {
  // Simulate drag
  // Assert position changed
});

// Test expand transition
test("Minimal expands to full chat", () => {
  // Click expand button
  // Assert modal opens
});
```

### Visual Regression

- Screenshot comparisons for Orb states
- Animation smoothness verification
- Particle effect consistency

## Debugging Tips

### Canvas Rendering

```typescript
// Enable canvas debugging:
ctx.strokeStyle = "red";
ctx.strokeRect(0, 0, canvas.width, canvas.height);
```

### Particle System

```typescript
// Log particle count:
console.log("Active particles:", particles.length);
```

### Animation Performance

```typescript
// Use browser DevTools:
- Performance tab → Record
- Look for frame rate drops
- Check for memory leaks
```

### Event Handling

```typescript
// Track mouse events:
console.log("Mouse position:", e.clientX, e.clientY);
console.log("Magnetic offset:", orbPos);
```

## Future Enhancement Hooks

### Extensibility Points

1. **Particle Effects:**

   - Different particle types
   - Custom colors/shapes
   - Physics variations

2. **Animations:**

   - More entrance effects
   - Exit animations
   - Transition variations

3. **Theming:**

   - Custom color schemes
   - Dark/light mode variants
   - Brand colors

4. **Settings:**
   - User preferences
   - Intensity levels
   - Enable/disable features

## Dependencies

### External Libraries

- `lucide-react` - Icons
- `react-query` - Data fetching (existing)
- `axios` - API calls (existing)
- `sonner` - Toast notifications (existing)

### No New Dependencies Added

- All features use existing libraries
- CSS-in-JS via Tailwind
- Canvas is native browser API
- RequestAnimationFrame is native

## File Organization

```
src/frontend/src/
├── components/
│   └── ai/
│       ├── AIAssistantOrb.tsx          [NEW]
│       ├── MinimalAIAssistant.tsx      [NEW]
│       ├── ConversationalAIChat.tsx    [MODIFIED]
│       ├── GlobalAIDialog.tsx          [MODIFIED]
│       └── ... other AI components
└── layouts/
    └── MainLayout.tsx                  [MODIFIED]
```

## Deployment Checklist

- [x] All imports properly resolved
- [x] No unused variables
- [x] No console.log statements (in production)
- [x] Error handling implemented
- [x] Mobile responsive verified
- [x] Keyboard shortcuts working
- [x] Memory leaks fixed
- [x] Animation performance acceptable

## Maintenance Notes

### Regular Updates

- Monitor particle performance
- Watch for memory issues
- Track animation smoothness
- Gather user feedback

### Common Issues & Fixes

1. **Orb not rendering:** Check z-index conflicts
2. **Drag not working:** Verify mouse event handlers
3. **Animations choppy:** Profile in DevTools
4. **Messages not sending:** Check AI service health

## Support & Contact

For technical issues:

1. Check browser console for errors
2. Review logs in `instance/logs/`
3. Test in incognito mode
4. Check GitHub issues

---

**Last Updated:** November 2025
**Status:** Production Ready
**Version:** 1.0
