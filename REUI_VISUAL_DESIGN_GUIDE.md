# ReUI Design System - Visual Design Guide

**Status:** Design Reference Document  
**Version:** 1.0  
**Last Updated:** 2025-11-02

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Color Palette](#color-palette)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Component Styles](#component-styles)
6. [Animation Patterns](#animation-patterns)
7. [Accessibility](#accessibility)
8. [Retina Display Support](#retina-display-support)

---

## Design Philosophy

### Core Principles

1. **Enterprise Sophistication** - Professional yet approachable
2. **Clarity Through Hierarchy** - Information organized by importance
3. **Purposeful Motion** - Animations guide attention and provide feedback
4. **Accessibility First** - WCAG 2.1 AA compliant by design
5. **Consistency** - Predictable patterns across all interfaces
6. **Scalability** - Works from 10 to 1000+ employees

### Design Metaphor

The Schichtplan interface is like a **professional operations center**:
- Clear visibility of all critical information
- Quick access to frequent actions
- Intentional hierarchy prevents overwhelm
- Smooth transitions create fluidity
- Accessible to operators of all skill levels

---

## Color Palette

### Primary Colors (Professional Blues)

| Token | Color | Use Case |
|-------|-------|----------|
| Primary Dark | #1e40af | Primary buttons, active states |
| Primary | #2563eb | Primary actions, focus states |
| Primary Light | #60a5fa | Hover states, borders |
| Primary Lighter | #93c5fd | Disabled states, backgrounds |

### Semantic Colors

| Token | Color | Use Case |
|-------|-------|----------|
| Success | #059669 | Positive actions, completed states |
| Warning | #d97706 | Caution, pending states |
| Destructive | #dc2626 | Delete, cancel, negative actions |
| Info | #0891b2 | Information, notifications |

### Neutral Scale

| Token | Color | Use Case |
|-------|-------|----------|
| Background | #ffffff | Page background |
| Surface | #f9fafb | Card backgrounds, elevated surfaces |
| Muted | #f3f4f6 | Hover states, subtle backgrounds |
| Border | #e5e7eb | Borders, dividers |
| Text Primary | #111827 | Primary text |
| Text Secondary | #6b7280 | Secondary text, captions |
| Text Tertiary | #9ca3af | Placeholder text, disabled text |

### Color Usage Guidelines

**Do:**
- Use primary blue for main CTAs
- Use semantic colors for status indication
- Ensure sufficient contrast (4.5:1 minimum)
- Test with colorblind modes

**Don't:**
- Use color alone for important information
- Mix too many colors in one interface
- Use colors outside the defined palette
- Forget about accessibility contrast

---

## Typography

### Font Stack

```css
--font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI',
               Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
```

### Heading Hierarchy

| Level | Size | Weight | Line-Height | Letter-Spacing | Usage |
|-------|------|--------|-------------|-----------------|-------|
| H1 | 32px | 600 | 1.2 | -0.5px | Page titles |
| H2 | 24px | 600 | 1.3 | -0.5px | Section headers |
| H3 | 20px | 500 | 1.35 | -0.25px | Subsection headers |
| H4 | 16px | 500 | 1.4 | 0px | Card titles |

### Body Text Scale

| Level | Size | Weight | Line-Height | Letter-Spacing | Usage |
|-------|------|--------|-------------|-----------------|-------|
| Base | 14px | 400 | 1.5 | 0px | Primary body text |
| Small | 12px | 400 | 1.5 | 0px | Secondary text, labels |
| Xs | 11px | 400 | 1.4 | 0px | Captions, help text |

### Text Styles Examples

```
Page Title (H1)
Section Header (H2)
Subsection Header (H3)
Card Title (H4)

Primary text appears as body copy in regular weight.
Secondary text is more subtle with muted color.
Caption text is small and restrained.
```

### Font Weight Usage

| Weight | Token | Use Cases |
|--------|-------|-----------|
| 400 | Regular | Body text, descriptions |
| 500 | Medium | Form labels, button text |
| 600 | Semibold | Headings, emphasis |
| 700 | Bold | Rarely used, only for emphasis |

---

## Spacing & Layout

### Spacing Scale (4px Grid)

| Token | Value | Use Cases |
|-------|-------|-----------|
| Micro | 2px | Stroke width, thin borders |
| Xs | 4px | Tight spacing |
| Sm | 8px | Component padding |
| Base | 12px | Card padding, small gaps |
| Md | 16px | Default spacing (most common) |
| Lg | 24px | Section spacing |
| Xl | 32px | Page margins, major spacing |
| 2xl | 48px | Major sections |
| 3xl | 64px | Page layout |

### Common Spacing Combinations

```
Card Internal Padding:     16px (md)
Small Component Padding:   8px (sm)
Between Items:            12px (base) or 16px (md)
Between Sections:         24px (lg) or 32px (xl)
Page Margins:             32px (xl) or more on wide screens
```

### Layout Grid

- **Base Grid:** 4px
- **Column Count:** 12 columns
- **Gap Sizes:**
  - Mobile (< 640px): 12px
  - Tablet (640px - 1023px): 16px
  - Desktop (1024px+): 20px

### Responsive Breakpoints

```
Mobile:    320px - 639px   (1 column, stacked layout)
Tablet:    640px - 1023px  (2 columns)
Desktop:   1024px - 1919px (3 columns)
Wide:      1920px+         (4+ columns, centered)
```

---

## Component Styles

### Buttons

#### Sizes

| Size | Height | Padding | Font-Size |
|------|--------|---------|-----------|
| Small | 28px | 8px 12px | 12px |
| Base | 36px | 10px 16px | 14px |
| Large | 44px | 12px 20px | 16px |

#### Variants

**Default (Primary)**
- Background: #2563eb
- Text: white
- Hover: #1e40af
- Active: #1e3a8a
- Disabled: #93c5fd + 40% opacity

**Secondary (Outline)**
- Border: 1px #e5e7eb
- Background: transparent
- Text: #111827
- Hover: #f3f4f6
- Active: #e5e7eb

**Ghost (Tertiary)**
- Background: transparent
- Text: #111827
- Hover: #f3f4f6
- Active: #e5e7eb
- No border

**Destructive**
- Background: #dc2626
- Text: white
- Hover: #b91c1c
- Active: #991b1b
- Disabled: similar to default disabled

#### Button States

```
Normal     → Hover (+5% brightness) → Active (+10% brightness) → Disabled (40% opacity)
```

### Form Inputs

#### Input Sizing

- **Height:** 36px (matches buttons)
- **Horizontal Padding:** 12px
- **Vertical Padding:** 10px
- **Border Radius:** 4px
- **Border Width:** 1px

#### Input States

| State | Border | Background | Text |
|-------|--------|-----------|------|
| Normal | #e5e7eb | #ffffff | #111827 |
| Hover | #d1d5db | #ffffff | #111827 |
| Focus | #2563eb | #ffffff | #111827 |
| Error | #dc2626 | #ffffff | #dc2626 |
| Disabled | #e5e7eb | #f9fafb | #9ca3af |

#### Focus Ring

- **Width:** 2px
- **Offset:** 2px
- **Color:** #2563eb
- **Blur:** None (crisp ring)

### Cards

#### Card Styles

**Standard Card**
- Border: 1px solid #e5e7eb
- Border-radius: 6px
- Padding: 20px
- Background: #ffffff
- Box-shadow: 0 1px 3px rgba(0,0,0,0.1)

**Hover State**
- Box-shadow: 0 4px 6px rgba(0,0,0,0.1)
- Transition: 150ms ease-out

**Compact Card**
- Padding: 16px
- Border-radius: 4px
- Otherwise same as standard

### Tables

#### Table Sizing

| Element | Height | Value |
|---------|--------|-------|
| Header Row | 40px | Slightly smaller |
| Data Row | 44px | Touch-friendly |
| Cell Padding | Vert/Horiz | 8px / 12px |

#### Table Styling

- **Header Background:** #f9fafb
- **Header Text:** #111827 (bold)
- **Striped Rows:** Alternate #ffffff and #f9fafb
- **Hover Row:** #f3f4f6
- **Border:** 1px solid #e5e7eb

#### Row Highlighting

```
Normal:     #ffffff
Hover:      #f3f4f6
Selected:   #93c5fd (20% opacity background)
```

### Modals & Dialogs

#### Modal Sizing

| Type | Width | Max-Width |
|------|-------|-----------|
| Default | 92vw | 500px |
| Wide | 92vw | 800px |
| Full | 92vw | 100% |

#### Modal Styling

- **Border Radius:** 8px
- **Backdrop:** rgba(0,0,0,0.5)
- **Shadow:** 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)
- **Padding:** 24px
- **Animation:** Fade in 150ms + Scale in 200ms

### Badges

#### Badge Sizes

| Size | Padding | Font-Size | Border-Radius |
|------|---------|-----------|----------------|
| Small | 2px 8px | 11px | 2px |
| Base | 4px 12px | 12px | 4px |
| Large | 6px 16px | 13px | 6px |

#### Badge Variants

| Variant | Background | Text |
|---------|-----------|------|
| Default | #2563eb | white |
| Secondary | #e5e7eb | #111827 |
| Success | #d1fae5 | #059669 |
| Warning | #fef3c7 | #d97706 |
| Destructive | #fee2e2 | #dc2626 |

### Avatars

#### Avatar Sizing

| Size | Dimensions | Font-Size | Use Case |
|------|-----------|-----------|----------|
| Xs | 24px × 24px | 10px | List inline |
| Sm | 32px × 32px | 12px | List items |
| Base | 40px × 40px | 14px | Default |
| Lg | 56px × 56px | 16px | Profile sections |
| Xl | 80px × 80px | 20px | Profile hero |

#### Avatar Styling

- **Border-Radius:** full (circular)
- **Border:** 2px solid #ffffff
- **Background:** Primary color (if no image)
- **Text:** white, semibold

---

## Animation Patterns

### Duration Scale

| Duration | Value | Use Case |
|----------|-------|----------|
| Instant | 0ms | Immediate feedback |
| Fastest | 50ms | Micro-interactions (hover) |
| Fast | 100ms | Quick feedback (clicks) |
| Normal | 150ms | Standard transitions |
| Slow | 250ms | Elaborate animations |
| Slowest | 400ms | Entrance animations |

### Easing Functions

```
Ease Out:   cubic-bezier(0.4, 0, 0.2, 1)  → Use for entering elements
Ease In:    cubic-bezier(0.4, 0, 1, 1)    → Use for exiting elements
Ease In-Out: cubic-bezier(0.4, 0, 0.2, 1) → Use for transitions
```

### Animation Patterns

#### Button Hover
```
Transform: scale(1.02)
Transition: 100ms ease-out
Shadow: Increase by 1 level
```

#### Modal Entrance
```
Initial:    opacity: 0, transform: scale(0.95)
Final:      opacity: 1, transform: scale(1)
Duration:   200ms
Easing:     ease-out
```

#### Page Transition
```
Exit:       opacity: 0, transform: translateY(20px)
Enter:      opacity: 1, transform: translateY(0)
Duration:   300ms
Easing:     ease-out
```

#### Loading Skeleton
```
Animation:  Shimmer from left to right
Duration:   1000ms
Repeat:     Infinite
Opacity:    0.5 → 0.8 → 0.5
```

#### List Item Stagger
```
Each Item:  Delay = index * 50ms
Transform:  slideInLeft + fadeIn
Duration:   300ms
```

#### Success State
```
Icon Scale: 0 → 1.2 → 1
Duration:   400ms
Easing:     cubic-bezier(0.34, 1.56, 0.64, 1) [bounce effect]
```

### Motion Preferences

Respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Accessibility

### WCAG 2.1 AA Compliance

#### Color Contrast

**Normal Text (≥14px)**
- Minimum ratio: 4.5:1
- Example: #111827 on #ffffff = 17.3:1 ✓

**Large Text (≥18px bold or 24px regular)**
- Minimum ratio: 3:1
- Example: #2563eb on #ffffff = 4.48:1 ✓

**UI Components & Borders**
- Minimum ratio: 3:1
- Example: #e5e7eb border on #ffffff = 3.6:1 ✓

#### Focus Management

```
Focus Ring:
- Width: 2px
- Offset: 2px
- Color: #2563eb
- Always visible, never hidden
- High contrast (meets AAA for UI components)
```

#### Keyboard Navigation

- Tab order: Logical, left-to-right, top-to-bottom
- Skip links: Available for main content
- Arrow keys: Functional in lists, menus, date pickers
- Enter/Space: Activates buttons and checkboxes
- Escape: Closes modals and menus

#### Screen Reader Support

- Semantic HTML: Use proper heading hierarchy
- ARIA Labels: For icon-only buttons and status indicators
- ARIA Live: For dynamic content updates
- Form Labels: Associated with input fields
- Alt Text: For all meaningful images

### Inclusive Color Use

```
Do:
- Use color + icon + text for status
- Provide alternative text for color-coded information
- Test with colorblind simulation modes

Don't:
- Use color alone to convey information
- Use color combinations with low contrast
- Assume all users see colors the same way
```

### Touch Accessibility

- Minimum touch target: 44px × 44px
- Spacing: At least 8px between touch targets
- Hover states: Also provide focus states
- Mobile-friendly: Larger form inputs and buttons

---

## Retina Display Support

### DPI Optimization

```
1x (96 DPI):   Standard resolution
2x (192 DPI):  Retina MacBooks, iPhones, Android flagships
3x (288 DPI):  iPhone 14+, high-end Android tablets
```

### SVG Icons

**Implementation:**
- Use SVG for all icons (scale infinitely)
- Apply `aria-hidden="true"` for decorative icons
- Use `title` or `aria-label` for interactive icons

**Example:**
```tsx
<button aria-label="Close">
  <svg aria-hidden viewBox="0 0 24 24">
    {/* SVG content */}
  </svg>
</button>
```

### Raster Images (if needed)

**Srcset Pattern:**
```html
<img 
  src="image.png" 
  srcset="image.png 1x, image@2x.png 2x, image@3x.png 3x"
  alt="Description"
/>
```

### Text Rendering (High DPI)

```css
/* Fine-tune text for 2x displays */
@media (min-device-pixel-ratio: 2) {
  body {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-weight: 500; /* slightly heavier */
    letter-spacing: 0.25px; /* more breathing room */
  }
}

/* Further optimize for 3x displays */
@media (min-device-pixel-ratio: 3) {
  body {
    font-weight: 600; /* even heavier */
    letter-spacing: 0.5px; /* generous spacing */
  }
}
```

### Animation Performance (High DPI)

```css
/* Use hardware acceleration */
.animated-element {
  transform: translateZ(0);
  backface-visibility: hidden;
  -webkit-perspective: 1000;
}

/* Optimize for 60fps on high DPI */
@media (min-device-pixel-ratio: 2) {
  .animated-element {
    will-change: transform;
  }
}
```

### Border Rendering

```css
/* Crisp 1px borders on all displays */
.border {
  border: 1px solid #e5e7eb;
  /* Avoid blurry borders on high DPI */
  backface-visibility: hidden;
}
```

### Responsive Imagery

**Large Hero Images:**
```html
<picture>
  <source media="(min-width: 1024px)" 
          srcset="hero-desktop.png, hero-desktop@2x.png 2x">
  <source media="(min-width: 640px)" 
          srcset="hero-tablet.png, hero-tablet@2x.png 2x">
  <img src="hero-mobile.png" 
       srcset="hero-mobile@2x.png 2x" 
       alt="Hero">
</picture>
```

### Testing on Different Displays

**Development Tools:**
- DevTools device emulation (2x/3x scaling)
- Real devices (iPhone, Android, Retina Mac)
- Lighthouse DevTools audit
- Pixel-ratio media queries testing

**Quality Assurance Checklist:**
- [ ] Text crisp on 1x, 2x, 3x displays
- [ ] No blurry borders or images
- [ ] Animations smooth at 60fps+
- [ ] Icons scale without pixelation
- [ ] Touch targets proper size on mobile
- [ ] Spacing consistent across DPI

---

## Design System Integration

### CSS Variables

```css
:root {
  /* Colors */
  --color-primary: #2563eb;
  --color-primary-dark: #1e40af;
  
  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-base: 12px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  
  /* Typography */
  --font-family: 'Inter', system-ui, sans-serif;
  --font-size-base: 14px;
  --font-size-lg: 16px;
  --font-size-h1: 32px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-base: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  
  /* Transitions */
  --duration-fast: 100ms;
  --duration-normal: 150ms;
  --duration-slow: 250ms;
  --easing-out: cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Usage in Components

```tsx
<button style={{
  padding: 'var(--spacing-md)',
  fontSize: 'var(--font-size-base)',
  backgroundColor: 'var(--color-primary)',
  borderRadius: '4px',
  transition: `all var(--duration-normal) var(--easing-out)`
}}>
  Click Me
</button>
```

---

## Design Review Checklist

Before shipping components or pages:

- [ ] Follows design system spacing (4px grid)
- [ ] Uses defined color palette
- [ ] Proper typography hierarchy
- [ ] Accessible focus states
- [ ] Smooth transitions (respect prefers-reduced-motion)
- [ ] Tested on 1x, 2x, 3x DPI displays
- [ ] Mobile responsive
- [ ] Keyboard navigable
- [ ] Screen reader compatible
- [ ] Lighthouse score ≥ 90

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-02  
**Next Review:** After Phase 1 completion
