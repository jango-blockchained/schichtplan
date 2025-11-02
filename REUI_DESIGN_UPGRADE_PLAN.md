# ReUI Design System Upgrade Plan

**Branch:** `feature/reui-design-upgrade`  
**Date:** 2025-11-02  
**Status:** Planning Phase

---

## 📋 Project Overview

This document outlines a comprehensive design system upgrade for Schichtplan from a basic Shadcn UI + Tailwind setup to a **pixel-perfect, retina-ready, enterprise-grade design** powered by **ReUI.io**. The upgrade will modernize the UI/UX with advanced components, animations, and a professional aesthetic suitable for workforce management applications.

### 🎯 Goals

- ✅ Achieve pixel-perfect design with retina support (2x/3x displays)
- ✅ Enhance visual hierarchy and accessibility
- ✅ Implement advanced components from ReUI (Data Grid, Combobox, Date Picker, etc.)
- ✅ Add sophisticated animations and transitions
- ✅ Maintain type safety and developer experience
- ✅ Improve performance and perceived performance with skeleton loaders
- ✅ Create cohesive design language across all pages

---

## 🎨 New Design Concept

### Design Philosophy

**"Enterprise Sophistication Meets Accessibility"**

Our new design embraces:

- **Professional Minimalism:** Clean interfaces with thoughtful negative space
- **Data-Driven Design:** Emphasize information hierarchy with advanced data visualization
- **Motion Intelligence:** Purposeful animations that guide user attention
- **Accessibility First:** WCAG 2.1 AA compliance with enhanced keyboard navigation
- **Scalability:** Components that work seamlessly across employee counts from 10 to 1000+

### Visual Identity Evolution

#### Color System (Enhanced)

```
Primary Palette (Professional Blues):
  - Primary Dark:     #1e40af (from #3b82f6)
  - Primary:          #2563eb
  - Primary Light:    #60a5fa
  - Primary Lighter:  #93c5fd

Semantic Colors:
  - Success:          #059669 (enhanced green)
  - Warning:          #d97706 (amber)
  - Destructive:      #dc2626 (red)
  - Info:             #0891b2 (cyan)

Neutral Scale (Professional grays):
  - Background:       #ffffff
  - Surface:          #f9fafb
  - Muted:            #f3f4f6
  - Border:           #e5e7eb
  - Text Primary:     #111827
  - Text Secondary:   #6b7280
```

#### Typography System

```
Font Stack: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI'

Heading Scale:
  - H1: 32px / 1.2 / 600 (Page titles)
  - H2: 24px / 1.3 / 600 (Section headers)
  - H3: 20px / 1.35 / 500 (Subsection headers)
  - H4: 16px / 1.4 / 500 (Card titles)

Body Scale:
  - Base: 14px / 1.5 / 400 (Primary text)
  - Small: 12px / 1.5 / 400 (Secondary text)
  - Xs: 11px / 1.4 / 400 (Captions)

Letter Spacing:
  - Headings: -0.5px (tighter for elegance)
  - Body: 0px (natural)
```

#### Spacing System (4px Grid)

```
Micro:    2px  (stroke width, thin borders)
Xs:       4px  (tight spacing)
Sm:       8px  (component padding)
Base:    12px  (card padding, small gaps)
Md:      16px  (default spacing)
Lg:      24px  (section spacing)
Xl:      32px  (page margins)
2xl:     48px  (major sections)
3xl:     64px  (page layout)
```

#### Radius System (Consistent Curves)

```
None:   0px   (sharp corners where needed)
Sm:     2px   (subtle curves on tags, badges)
Base:   4px   (buttons, inputs, cards)
Md:     6px   (larger cards, modals)
Lg:     8px   (prominent sections)
Xl:    12px   (hero sections, large cards)
Full: 9999px  (pills, avatars)
```

### Component Design Patterns

#### Buttons

- **Default:** 36px height, 12-16px horizontal padding
- **States:** Normal → Hover (5% darker) → Active (10% darker) → Disabled (40% opacity)
- **Variants:** Default, Secondary, Ghost, Destructive, Outline
- **Sizes:** Sm (28px), Base (36px), Lg (44px)

#### Form Inputs

- **Height:** 36px (matches buttons for alignment)
- **Border:** 1px solid, 4px radius
- **Focus State:** Blue ring (2px, 2px offset), blue border
- **Placeholder:** 12px, 60% opacity
- **Validation States:** Green ring (success), Red ring (error)

#### Cards

- **Shadow:** 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)
- **Hover Shadow:** 0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)
- **Padding:** 20px (content cards), 16px (compact cards)
- **Border:** 1px solid #e5e7eb

#### Tables

- **Row Height:** 44px (comfortable touch targets)
- **Header Height:** 40px
- **Striped Rows:** Alternate #f9fafb / #ffffff
- **Hover State:** #f3f4f6 background
- **Cell Padding:** 12px horizontal, 8px vertical

#### Modals & Dialogs

- **Backdrop:** rgba(0,0,0,0.5) (50% opacity)
- **Content Width:** 92vw max 500px (default), 92vw max 800px (wide)
- **Corner Radius:** 8px
- **Shadow:** Elevated with 2-layer shadow system
- **Animation:** Fade in (150ms), Scale in (200ms)

### Animation Specifications

#### Transitions

```
Duration Scale:
  - Instant:    0ms   (immediate feedback)
  - Fastest:   50ms   (micro-interactions)
  - Fast:     100ms   (quick feedback)
  - Normal:   150ms   (standard transitions)
  - Slow:     250ms   (elaborate animations)
  - Slowest:  400ms   (entrance animations)

Easing Functions:
  - ease-out:   cubic-bezier(0.4, 0, 0.2, 1)  (entering elements)
  - ease-in:    cubic-bezier(0.4, 0, 1, 1)    (exiting elements)
  - ease-in-out: cubic-bezier(0.4, 0, 0.2, 1) (modal transitions)
```

#### Animation Library

Using **Motion** (Framer Motion) for sophisticated animations:

- **Page Transitions:** Fade + subtle Y-axis translate
- **Modal Entrance:** Fade + scale from 95%
- **Button Hover:** Scale 1.02 + shadow lift
- **Loading States:** Shimmer skeleton with 1000ms duration
- **Data Grid:** Rows slide in with staggered 50ms delays
- **Notifications:** Toast slide in from bottom-right

### Layout Architecture

#### Page Structure

```
┌─────────────────────────────────────────┐
│  Header (with logo, nav, user menu)     │ 56px
├─────────────────────────────────────────┤
│  Breadcrumb                             │ 32px
├─────────────────────────────────────────┤
│  Page Title + Description               │ Variable
│  Header Actions                         │
├─────────────────────────────────────────┤
│                                         │
│  Content Grid (1/2/3 cols responsive)   │ Flexible
│  ├─ Content Cards                       │
│  ├─ Data Tables                         │
│  └─ Modals & Sidesheets                │
│                                         │
└─────────────────────────────────────────┘
```

#### Responsive Breakpoints

```
Mobile:    320px - 639px (1 column)
Tablet:    640px - 1023px (2 columns)
Desktop:   1024px - 1919px (3 columns)
Wide:      1920px+ (4+ columns, centered max-width)
```

#### Grid System

- **12-column grid** with responsive gaps (12px mobile, 16px tablet, 20px desktop)
- **Component Cards:** 1 column on mobile, 2-3 on desktop
- **Data Tables:** Full width with horizontal scroll on mobile
- **Modals:** Centered, max-width constraints

### Accessibility Enhancements

#### WCAG 2.1 AA Compliance

- **Color Contrast:** All text meets 4.5:1 ratio (normal), 3:1 ratio (large)
- **Focus Management:** Clear focus rings (2px, 2px offset)
- **Keyboard Navigation:** Tab order optimization, arrow keys for lists
- **Semantic HTML:** Proper heading hierarchy, ARIA labels
- **Motion Respect:** `prefers-reduced-motion` honored
- **Touch Targets:** Minimum 44x44px for interactive elements

#### Inclusive Design Features

- **Font Scaling:** Respects browser zoom (up to 200%)
- **Color Blind Mode:** Option for deuteranopia simulation
- **High Contrast Mode:** Alternative palette support
- **Screen Reader:** Proper ARIA roles and descriptions
- **Language Support:** RTL-ready layout system

### Retina Display Support

#### DPI Optimization

```
1x (96 DPI):  Standard resolution
2x (192 DPI): Retina displays (iPhone, modern laptops)
3x (288 DPI): High-end displays (iPhone 14+, premium tablets)

Implementation:
- SVG icons (scale infinitely)
- Proper image srcset with @2x/@3x variants
- Crisp text rendering with -webkit-font-smoothing: antialiased
- Hardware acceleration for animations: transform: translateZ(0)
```

#### High-DPI Specific Rules

```css
@media (min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
  /* Fine-tune for 2x displays */
  font-weight: 500; /* slightly heavier */
  letter-spacing: 0.25px; /* more breathing room */
}

@media (min-device-pixel-ratio: 3), (min-resolution: 288dpi) {
  /* Fine-tune for 3x displays */
  font-weight: 600; /* even heavier */
  letter-spacing: 0.5px; /* generous spacing */
}
```

---

## 📊 ReUI Component Mapping

### Core Components to Integrate

#### Form Components

- ✅ **Input** (6 variants) → Enhanced password visibility toggle, prefix/suffix support
- ✅ **Select** (12 variants) → Multi-select, search-enabled, virtualized for 1000+ items
- ✅ **Combobox** (16 variants) → Autocomplete, async loading, keyboard navigation
- ✅ **Checkbox** (6 variants) → Indeterminate state for group selection
- ✅ **Radio Group** (4 variants) → Button-style radios for filters
- ✅ **Slider** → Range sliders, dual-thumb support
- ✅ **Switch** → Toggle switches with labels
- ✅ **Textarea** → Auto-expanding, character count

#### Data Display Components

- ✅ **Data Grid** (21 variants) → Sorting, filtering, pagination, inline editing
- ✅ **Table** → Enhanced with striped rows, sticky header, expandable rows
- ✅ **Pagination** (3 variants) → Page selection, previous/next buttons
- ✅ **Breadcrumb** (5 variants) → Navigation hierarchy with dropdowns

#### Feedback Components

- ✅ **Alert** (10 variants) → Contextual alerts (info, success, warning, error)
- ✅ **Alert Dialog** (2 variants) → Confirmation modals with callbacks
- ✅ **Sonner** (Toast system) → Dismissable notifications with actions
- ✅ **Skeleton** → Shimmer effect for loading states
- ✅ **Tooltip** → Rich tooltips with delay settings

#### Layout Components

- ✅ **Dialog** (4 variants) → Modal dialogs with backdrop
- ✅ **Sheet** (3 variants) → Slide-in panels (left, right, bottom)
- ✅ **Popover** → Rich popover menus
- ✅ **Dropdown Menu** (3 variants) → Context menus, sub-menus
- ✅ **Scroll Area** → Custom scrollbar styling

#### Navigation Components

- ✅ **Tabs** → Tab navigation with lazy loading
- ✅ **Accordion** → Expandable sections (custom built for better design)
- ✅ **Accordion Menu** (6 variants) → Nested navigation menus

#### Data Input Components

- ✅ **Date Picker** (3 variants) → Single date, range, preset ranges
- ✅ **Calendar** (2 variants) → Full calendar with event indicators
- ✅ **Kbd** (3 variants) → Keyboard shortcut display

#### Visual Components

- ✅ **Badge** (13 variants) → Status badges with icons
- ✅ **Avatar** (8 variants) → User avatars with fallbacks
- ✅ **Separator** → Visual dividers
- ✅ **Card** (2 variants) → Content containers
- ✅ **Button** (17 variants) → Comprehensive button system

---

## 🛠️ Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)

#### 1.1 Setup & Dependencies

- [ ] Install ReUI dependencies
  - [ ] `npm install @base-ui-components/react`
  - [ ] `npm install framer-motion`
  - [ ] `npm install sonner` (for toasts)
  - [ ] Update Tailwind config for ReUI support
- [ ] Create Bun lock file with new dependencies
- [ ] Document version constraints in `bunfig.toml`

#### 1.2 Design System Foundation

- [ ] Create `src/frontend/src/styles/design-system.css`
  - [ ] CSS variables for colors
  - [ ] CSS variables for spacing
  - [ ] CSS variables for typography
  - [ ] CSS variables for shadows
- [ ] Update `tailwind.config.ts` with theme extensions
- [ ] Create retina-specific media queries in `src/frontend/src/styles/retina.css`
- [ ] Add motion preference respect: `prefers-reduced-motion`
- [ ] Create accessibility utilities in `src/frontend/src/utils/a11y.ts`

#### 1.3 Component Library Setup

- [ ] Create `src/frontend/src/components/reui/` directory structure
- [ ] Set up component export index: `src/frontend/src/components/reui/index.ts`
- [ ] Document ReUI component usage patterns

### Phase 2: Core Component Migration (Weeks 3-4)

#### 2.1 Form Components

- [ ] Replace Input component with ReUI variant
- [ ] Replace Select with ReUI enhanced version
- [ ] Integrate Combobox for employee/shift selection
- [ ] Update Checkbox styling and functionality
- [ ] Upgrade Radio Groups with button variants
- [ ] Add Slider components for range inputs
- [ ] Enhance Switch components with labels

#### 2.2 Data Display Components

- [ ] Integrate Data Grid for schedules
- [ ] Upgrade Table components with ReUI styling
- [ ] Implement advanced pagination
- [ ] Enhance breadcrumb navigation

#### 2.3 Feedback & Status Components

- [ ] Upgrade Alert system
- [ ] Update Alert Dialog for confirmations
- [ ] Integrate Sonner for notifications
- [ ] Create enhanced Skeleton loaders
- [ ] Add Tooltip enhancements

### Phase 3: Layout & Navigation (Weeks 5-6)

#### 3.1 Layout Components

- [ ] Upgrade Dialog system
- [ ] Implement Sheet (side panel) components
- [ ] Enhance Popover functionality
- [ ] Create advanced Dropdown Menus
- [ ] Integrate Scroll Area with custom styling

#### 3.2 Navigation Systems

- [ ] Upgrade Tabs component with lazy loading
- [ ] Create enhanced Accordion components
- [ ] Build Accordion Menu for settings
- [ ] Improve page navigation flow

#### 3.3 High-Value Components

- [ ] Integrate advanced Date Picker
- [ ] Add full Calendar component with events
- [ ] Create Keyboard shortcut display (Kbd)

### Phase 4: Page-by-Page Upgrade (Weeks 7-10)

#### 4.1 Dashboard Page

- [ ] Upgrade data cards with new styling
- [ ] Add animated statistics
- [ ] Improve visual hierarchy
- [ ] Add loading skeleton states
- [ ] Enhance charts and visualizations

#### 4.2 Schedule Management

- [ ] Upgrade Data Grid for schedule view
- [ ] Enhance shift editing modals
- [ ] Improve drag-and-drop styling
- [ ] Add advanced filtering with Combobox
- [ ] Enhance version control UI

#### 4.3 Employee Management

- [ ] Upgrade employee list/data grid
- [ ] Enhance employee detail modals
- [ ] Improve availability editor
- [ ] Add avatar enhancements
- [ ] Refactor form layouts

#### 4.4 Shift Templates & Settings

- [ ] Upgrade shift template editor
- [ ] Improve settings tabs layout
- [ ] Enhance coverage editor
- [ ] Add visual shift type indicators

#### 4.5 Advanced Features

- [ ] Upgrade calendar views (Jahresurlaubskalender)
- [ ] Enhance PDF export styling
- [ ] Improve vacation planning UI
- [ ] Add holiday management enhancements

### Phase 5: Animations & Polish (Weeks 11-12)

#### 5.1 Page Transitions

- [ ] Implement fade + slide transitions
- [ ] Add loading animations
- [ ] Create exit animations
- [ ] Test motion preference settings

#### 5.2 Interactive Elements

- [ ] Add button hover animations (scale + lift)
- [ ] Enhance modal entrance animations
- [ ] Add data grid row animations
- [ ] Create form input focus animations
- [ ] Add success/error state animations

#### 5.3 Perceived Performance

- [ ] Implement skeleton loaders on all data loads
- [ ] Add loading states for buttons
- [ ] Create progress indicators
- [ ] Add shimmer effects for tables

### Phase 6: Quality & Optimization (Week 13)

#### 6.1 Performance Optimization

- [ ] Audit bundle size impact
- [ ] Implement code splitting for modals
- [ ] Lazy load component libraries
- [ ] Optimize image handling for retina displays

#### 6.2 Accessibility Audit

- [ ] Run WCAG 2.1 AA compliance check
- [ ] Test keyboard navigation
- [ ] Verify screen reader support
- [ ] Test high contrast mode
- [ ] Verify color blind modes

#### 6.3 Cross-Browser Testing

- [ ] Test on Chrome/Chromium
- [ ] Test on Firefox
- [ ] Test on Safari (including retina)
- [ ] Test on mobile (iOS/Android)

#### 6.4 Documentation

- [ ] Update `DESIGN_SYSTEM.md` with new components
- [ ] Document animation patterns
- [ ] Create component showcase page
- [ ] Document accessibility features
- [ ] Add migration guide from old components

### Phase 7: Testing & QA (Week 14)

#### 7.1 Component Testing

- [ ] Unit tests for new components
- [ ] Integration tests for component usage
- [ ] Visual regression tests

#### 7.2 Functional Testing

- [ ] E2E tests for critical paths
- [ ] Schedule generation flow
- [ ] Employee management flow
- [ ] Settings modification flow

#### 7.3 Performance Testing

- [ ] Lighthouse audit
- [ ] Core Web Vitals measurement
- [ ] Bundle size analysis
- [ ] Time to interactive metrics

### Phase 8: Deployment & Rollout (Week 15)

#### 8.1 Pre-Production

- [ ] Deploy to staging environment
- [ ] QA sign-off
- [ ] Performance baseline established

#### 8.2 Production Deployment

- [ ] Tag release as `v2.0.0-reui-design`
- [ ] Create release notes
- [ ] Monitor for issues
- [ ] Collect user feedback

#### 8.3 Post-Launch Support

- [ ] Address feedback
- [ ] Patch any design inconsistencies
- [ ] Optimize based on analytics
- [ ] Plan next iteration features

---

## 📁 Directory Structure Changes

```
src/frontend/src/
├── styles/
│   ├── globals.css          (existing, enhanced)
│   ├── design-system.css    (NEW: CSS variables)
│   ├── retina.css           (NEW: DPI-specific styles)
│   ├── animations.css       (NEW: Motion animations)
│   └── accessibility.css    (NEW: a11y utilities)
│
├── components/
│   ├── ui/                  (existing Shadcn components - keep)
│   ├── reui/                (NEW: ReUI integrated components)
│   │   ├── index.ts
│   │   ├── form/
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Combobox.tsx
│   │   │   ├── DatePicker.tsx
│   │   │   └── ...
│   │   ├── data/
│   │   │   ├── DataGrid.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Pagination.tsx
│   │   │   └── ...
│   │   ├── layout/
│   │   │   ├── Dialog.tsx
│   │   │   ├── Sheet.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── ...
│   │   ├── feedback/
│   │   │   ├── Alert.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   └── ...
│   │   └── navigation/
│   │       ├── Tabs.tsx
│   │       ├── Accordion.tsx
│   │       └── ...
│   │
│   └── layouts/             (existing layout components - enhance)
│       ├── PageLayout.tsx
│       ├── ContentCard.tsx
│       └── ...
│
├── hooks/
│   └── useRetina.ts         (NEW: retina display detection)
│
├── constants/
│   └── design.ts            (NEW: design token constants)
│
└── utils/
    └── a11y.ts              (NEW: accessibility utilities)
```

---

## 🎯 Key Metrics & Success Criteria

### Design Metrics

- ✅ **Pixel Perfection:** All components align to 4px grid
- ✅ **Retina Ready:** All assets @2x/@3x with proper srcset
- ✅ **Accessibility:** WCAG 2.1 AA compliance score ≥ 95%
- ✅ **Consistency:** 100% of components follow design system

### Performance Metrics

- ✅ **Bundle Size:** < 200KB gzip increase
- ✅ **Lighthouse Score:** ≥ 90 (Performance, Accessibility, Best Practices)
- ✅ **Core Web Vitals:** All green (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- ✅ **Component Load Time:** All animations complete in < 300ms

### User Experience Metrics

- ✅ **Time to First Interaction:** < 1.5s
- ✅ **Perceived Performance:** Skeleton loaders on all data loads
- ✅ **Keyboard Navigation:** 100% of features keyboard accessible
- ✅ **Screen Reader Support:** All elements properly announced

---

## 🔄 Component Migration Strategy

### Backward Compatibility

```typescript
// Keep old components available during transition
export { Button as ButtonOld } from "@/components/ui/button";
export { Button } from "@/components/reui/Button";

// Update pages gradually
// Page 1: Use new Button
// Page 2: Use new Button
// ... etc
// Final: Remove old imports
```

### Deprecation Path

1. **Week 1-2:** New components available alongside old
2. **Week 3-10:** Pages gradually migrate to new components
3. **Week 11-14:** Remove old component imports
4. **Week 15:** Ship new design system

### Versioning

- Current: `v1.x` (Shadcn/Tailwind)
- Target: `v2.0` (ReUI Upgrade)
- Maintain `v1.x` branch for critical fixes only

---

## 📚 Documentation Updates Required

### New Files to Create

- [ ] `REUI_COMPONENT_GUIDE.md` - How to use each ReUI component
- [ ] `REUI_MIGRATION_GUIDE.md` - Step-by-step migration instructions
- [ ] `DESIGN_TOKENS.md` - Complete design token reference
- [ ] `ANIMATIONS.md` - Animation patterns and usage
- [ ] `ACCESSIBILITY_GUIDE.md` - A11y best practices for components

### Files to Update

- [ ] `DESIGN_SYSTEM.md` - Add ReUI component examples
- [ ] `src/frontend/README.md` - Component library overview
- [ ] `docs/design_concept.md` - New design philosophy
- [ ] `.github/copilot-instructions.md` - Update design guidelines

---

## 🚀 Quick Start Commands

### Installation

```bash
cd src/frontend

# Install new dependencies
bun add @base-ui-components/react framer-motion sonner

# Update Tailwind config
# (manual step - see Phase 1.2)

# Verify installation
bun run typecheck
bun run lint
```

### Development

```bash
# Start dev server with design system
bun dev

# Watch for changes
bun run test:watch

# Check component compliance
bun run lint:fix
```

### Testing

```bash
# Run all tests
bun test

# Check accessibility
# (manual lighthouse audit or automated tooling)

# Visual regression testing
# (will be set up in Phase 6)
```

---

## 📝 Notes & Considerations

### Dependencies

- ReUI works seamlessly with Shadcn UI - they can coexist
- Framer Motion handles all animations
- Sonner replaces custom toast system
- Base UI provides additional primitive components

### Browser Support

- Modern browsers (Chrome 90+, Firefox 88+, Safari 14+)
- Mobile browsers (iOS Safari 14+, Chrome Android 90+)
- Graceful degradation for older browsers (no animations)

### Performance Considerations

- Lazy load ReUI components where possible
- Use Code splitting for modal/sheet components
- Optimize images for retina displays
- Tree-shake unused ReUI components

### Testing Strategy

- Unit tests for component logic
- Integration tests for component interactions
- Visual regression tests for design changes
- Lighthouse audits for performance

---

## ✅ Checklist for Stakeholders

### Before Starting

- [ ] Review design concept and approve
- [ ] Confirm resource allocation
- [ ] Validate timeline and milestones
- [ ] Set up communication channels

### During Development

- [ ] Weekly progress reviews
- [ ] QA feedback collection
- [ ] Performance monitoring
- [ ] User testing (optional)

### At Completion

- [ ] Final QA sign-off
- [ ] Performance validation
- [ ] Accessibility audit results
- [ ] User feedback incorporation
- [ ] Documentation review

---

**Next Steps:** Begin Phase 1 implementation. Assign team members to component integration tasks.
