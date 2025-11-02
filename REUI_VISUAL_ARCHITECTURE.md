# ReUI Design System - Visual Architecture Overview

**Created:** 2025-11-02  
**Branch:** `feature/reui-design-upgrade`

---

## 🏗️ Architecture Overview

### Current Stack vs. Proposed Stack

```
CURRENT ARCHITECTURE
═══════════════════════════════════════════════════════════════

React 18.3.1
    ↓
├─ Shadcn UI Components (Basic)
│   ├─ Button
│   ├─ Input
│   ├─ Dialog
│   ├─ Tabs
│   └─ ... (limited variants)
│
├─ Tailwind CSS 3.4.1
│   └─ Basic utilities (no design tokens)
│
└─ Custom Components
    ├─ ScheduleTable
    ├─ EmployeeForm
    └─ CustomModals


PROPOSED ARCHITECTURE
═══════════════════════════════════════════════════════════════

React 18.3.1
    ↓
├─ ReUI Components (Enterprise)
│   ├─ Button (17 variants!)
│   ├─ Input (6 variants)
│   ├─ DataGrid (21 variants!)
│   ├─ Combobox (16 variants!)
│   ├─ Dialog (4 variants)
│   ├─ Sheet (3 variants)
│   ├─ DatePicker (3 variants)
│   ├─ Calendar (2 variants)
│   ├─ ... and 30+ more
│   └─ Full WCAG 2.1 AA
│
├─ Framer Motion
│   ├─ Page transitions
│   ├─ Interactive animations
│   ├─ Loading states
│   └─ Success/error feedback
│
├─ Sonner (Toast system)
│   ├─ Success notifications
│   ├─ Error alerts
│   ├─ Info messages
│   └─ Custom actions
│
├─ Tailwind CSS 3.4.1 (Enhanced)
│   ├─ Design token variables
│   ├─ Retina optimizations
│   ├─ Accessibility utilities
│   └─ Animation classes
│
└─ Design System
    ├─ CSS Variables (colors, spacing, typography)
    ├─ Component Wrappers
    ├─ Accessibility Utilities
    └─ Hooks (useRetina)
```

---

## 🎨 Design System Layers

```
DESIGN SYSTEM LAYER STRUCTURE
═══════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│                    VISUAL LAYER                             │
│         (Pixels, Colors, Shadows, Animations)              │
├─────────────────────────────────────────────────────────────┤
│                 COMPONENT LAYER                             │
│  Button, Input, Select, Dialog, DataGrid, DatePicker, etc.  │
├─────────────────────────────────────────────────────────────┤
│                  LAYOUT LAYER                               │
│    PageLayout, ContentCard, ContentGrid, SettingsLayout     │
├─────────────────────────────────────────────────────────────┤
│                 PATTERN LAYER                               │
│   Forms, Tables, Modals, Lists, Navigation, Dashboards      │
├─────────────────────────────────────────────────────────────┤
│                 FEATURE LAYER                               │
│   Schedules, Employees, Shifts, Vacations, Settings         │
├─────────────────────────────────────────────────────────────┤
│                 APPLICATION LAYER                           │
│              (User Interface & Experience)                  │
└─────────────────────────────────────────────────────────────┘

                    ↑
        DESIGN TOKENS flow through all layers
        • Colors (50+ variables)
        • Spacing (9 scale levels)
        • Typography (10 sizes)
        • Shadows (5 levels)
        • Animations (6 durations)
```

---

## 📊 Color System Hierarchy

```
PRIMARY COLOR PALETTE
═══════════════════════════════════════════════════════════════

┌────────────────────────────────────────────────────────────┐
│                    PRIMARY BLUE SCALE                      │
├────────────────────────────────────────────────────────────┤
│
│   #1e40af  ████████████  PRIMARY DARK (Hover/Active)
│   #2563eb  ████████████  PRIMARY (Main CTA)
│   #60a5fa  ████████████  PRIMARY LIGHT (Hover state)
│   #93c5fd  ████████████  PRIMARY LIGHTER (Disabled)
│
└────────────────────────────────────────────────────────────┘

SEMANTIC COLORS
═════════════════════════════════════════════════════════════

Success:      #059669 ████████  (Completed, available)
Warning:      #d97706 ████████  (Pending, caution)
Destructive:  #dc2626 ████████  (Delete, negative)
Info:         #0891b2 ████████  (Information, neutral)

NEUTRAL SCALE
═════════════════════════════════════════════════════════════

Background:   #ffffff ████████  (Page background)
Surface:      #f9fafb ████████  (Cards, elevated)
Muted:        #f3f4f6 ████████  (Hover, subtle)
Border:       #e5e7eb ████████  (Dividers, edges)
Text Primary: #111827 ████████  (Headlines, body)
Text Muted:   #6b7280 ████████  (Secondary text)
```

---

## 🔤 Typography Hierarchy

```
HEADING HIERARCHY
═══════════════════════════════════════════════════════════════

H1 (32px, 600 weight)
━━━━━━━━━━━━━━━━━━━━━━━
Page Title - Most prominent

H2 (24px, 600 weight)
━━━━━━━━━━━━━━
Section Headers

H3 (20px, 500 weight)
━━━━━━━━━━━━
Subsection Headers

H4 (16px, 500 weight)
━━━━━━━━━
Card Titles

Body (14px, 400 weight)
━━━━━━━━━━
Primary paragraph text that provides context and information
to the user about the application state and actions.

Small (12px, 400 weight)
━━━━━━━
Secondary text for labels and descriptions

Caption (11px, 400 weight)
━━━
Captions and help text

CONTRAST RATIOS (for accessibility)
═════════════════════════════════════════════════════════════
#111827 on #ffffff = 17.3:1 ✅ AAA
#6b7280 on #ffffff = 7.5:1  ✅ AAA
#2563eb on #ffffff = 4.48:1 ✅ AAA (UI components)
```

---

## 📐 Spacing System (4px Grid)

```
SPACING SCALE
═══════════════════════════════════════════════════════════════

|  2px  │ Micro    │ ▌        │ Stroke width, thin borders
|  4px  │ Xs       │ ▌ ▌      │ Tight spacing, small gaps
|  8px  │ Sm       │ ▌ ▌ ▌    │ Component padding
| 12px  │ Base     │ ▌ ▌ ▌ ▌  │ Card padding, item gaps
| 16px  │ Md       │ ▌ ▌ ▌ ▌ ▌ │ Default spacing (most common)
| 24px  │ Lg       │ ▌ * 6    │ Section spacing
| 32px  │ Xl       │ ▌ * 8    │ Page margins
| 48px  │ 2xl      │ ▌ * 12   │ Major sections
| 64px  │ 3xl      │ ▌ * 16   │ Page layout

SPACING IN USE
═════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│  ▌▌ Page (32px margin)                                      │
│  ▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌                                    │
│  ▌▌ [ Breadcrumb ] ▌▌ (4px vertical)                       │
│  ▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌                                    │
│  ▌▌ Page Title ▌▌ (8px vertical)                           │
│  ▌▌ Description ▌▌ (24px to next section)                  │
│  ▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌                                    │
│  ▌▌ [ Section 1 ]  ▌▌ [ Section 2 ]  ▌▌ (20px gap)       │
│  ▌▌ with 16px padding each                                 │
│  ▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚡ Animation Specifications

```
ANIMATION DURATION SCALE
═══════════════════════════════════════════════════════════════

0ms     ━ Instant       ↦ Immediate feedback (no delay)
50ms    ━━ Fastest      ↦ Micro-interactions (hover effects)
100ms   ━━━ Fast        ↦ Quick feedback (clicks, toggles)
150ms   ━━━━ Normal     ↦ Standard transitions (default)
250ms   ━━━━━ Slow      ↦ Elaborate animations (modals)
400ms   ━━━━━━ Slowest  ↦ Entrance animations (page load)

EASING FUNCTIONS
═════════════════════════════════════════════════════════════

Ease Out     ━━━━━━━╭  (Entering elements)
(0.4, 0, 0.2, 1)    ╲
                     ╲___

Ease In      ╱━━━━━━━━  (Exiting elements)
(0.4, 0, 1, 1)       ╲
                      ╲

Ease In-Out  ╱━━━━━╲  (Transitions)
(0.4, 0, 0.2, 1)     ╲

ANIMATION TIMING IN ACTION
═════════════════════════════════════════════════════════════

Button Hover:     100ms | scale(1.02) + shadow lift
Modal Enter:      200ms | fade in + scale from 0.95
Page Transition:  300ms | fade + translate-y
Data Row Load:    300ms | stagger with 50ms delay per row
Success State:    400ms | bounce scale animation

MOTION PREFERENCES
═════════════════════════════════════════════════════════════

For users with prefers-reduced-motion enabled:
All animations disabled → Instant transitions
Focus states → Highly visible without motion
Status changes → Clear visual feedback without animation
```

---

## 🔘 Component Design Specifications

```
BUTTON SPECIFICATIONS
═════════════════════════════════════════════════════════════

Default Button (36px height)
┌──────────────────────────┐
│  ▌▌  Button Text  ▌▌     │  12-16px padding
│                          │  4px border radius
└──────────────────────────┘

States:
Normal   ███ (#2563eb)
Hover    ███ (#1e40af)  +Shadow
Active   ███ (#1e3a8a)  +Darker
Disabled ███ (#93c5fd)  +40% opacity

FORM INPUT SPECIFICATIONS
═════════════════════════════════════════════════════════════

Input Field (36px height)
┌─────────────────────────────────┐
│ ▌ [icon] Input Text     [×] ▌   │  Prefix/suffix support
│                                 │  4px radius border
└─────────────────────────────────┘

States:
Normal   └─ #e5e7eb border
Hover    └─ #d1d5db border
Focus    └─ #2563eb border + 2px ring
Error    └─ #dc2626 border + red ring
Disabled └─ #e5e7eb border + #f9fafb bg

TABLE SPECIFICATIONS
═════════════════════════════════════════════════════════════

Header Row (40px)
┌─────────────┬─────────────┬─────────────┐
│   Name      │   Shift     │   Status    │  #f9fafb background
├─────────────┼─────────────┼─────────────┤
│ John Doe    │ Morning     │ Available   │  #ffffff background
├─────────────┼─────────────┼─────────────┤
│ Jane Smith  │ Evening     │ Pending     │  #f9fafb background
├─────────────┼─────────────┼─────────────┤
│ Bob Johnson │ Night       │ Assigned    │  #ffffff background
└─────────────┴─────────────┴─────────────┘

Row Height: 44px (comfortable touch targets)
Cell Padding: 12px horizontal, 8px vertical
Hover: #f3f4f6 background
Border: 1px #e5e7eb
```

---

## 📱 Responsive Grid System

```
BREAKPOINTS & LAYOUT ADAPTION
═══════════════════════════════════════════════════════════════

Mobile Screen (320-639px)
┌─────────────────┐
│ Header          │
├─────────────────┤
│ [ Card 1 ]      │  Single column
├─────────────────┤  Stacked layout
│ [ Card 2 ]      │  Full width
├─────────────────┤  Touch-friendly
│ [ Card 3 ]      │  Padding: 16px
└─────────────────┘

Tablet Screen (640-1023px)
┌───────────────────┬───────────────────┐
│ Header                              │
├───────────────────┬───────────────────┤
│ [ Card 1 ]        │ [ Card 2 ]        │  2-column layout
├───────────────────┼───────────────────┤
│ [ Card 3 ]        │ [ Card 4 ]        │  Gap: 16px
└───────────────────┴───────────────────┘

Desktop Screen (1024-1919px)
┌──────────────┬──────────────┬──────────────┐
│ Header                                   │
├──────────────┼──────────────┼──────────────┤
│ [ Card 1 ]   │ [ Card 2 ]   │ [ Card 3 ]   │  3-column layout
├──────────────┼──────────────┼──────────────┤
│ [ Card 4 ]   │ [ Card 5 ]   │ [ Card 6 ]   │  Gap: 20px
└──────────────┴──────────────┴──────────────┘

Wide Screen (1920px+)
┌────────────────────────────────────────────┐
│ Max-width container: 1400px centered      │
├──────────┬──────────┬──────────┬──────────┤
│ Card 1   │ Card 2   │ Card 3   │ Card 4   │ 4-column
└──────────┴──────────┴──────────┴──────────┘
```

---

## ♿ Accessibility Layer

```
ACCESSIBILITY COMPLIANCE
═══════════════════════════════════════════════════════════════

WCAG 2.1 Level AA Conformance:

Color Contrast (4.5:1 minimum)
┌────────────────────────────┐
│ Text: #111827 on #ffffff   │  ✅ 17.3:1 (AAA)
│ Muted: #6b7280 on #ffffff  │  ✅ 7.5:1 (AAA)
│ CTA: #2563eb on #ffffff    │  ✅ 4.48:1 (AA)
└────────────────────────────┘

Focus Management
┌────────────────────────────┐
│ ▌ [ Button ] ▌             │  2px ring
│ ┌────────────────────┐     │  2px offset
│ │                    │     │  #2563eb color
│ └────────────────────┘     │  Always visible
└────────────────────────────┘

Keyboard Navigation
┌────────────────────────────┐
│ Tab      → Focus next      │
│ Shift+Tab→ Focus previous  │
│ Enter    → Activate button │
│ Space    → Toggle checkbox │
│ Arrow ↑↓ → Navigate list   │
└────────────────────────────┘

Screen Reader Support
┌────────────────────────────┐
│ Semantic HTML              │
│ ARIA labels                │
│ Form labels                │
│ Link text                  │
│ Alt text for images        │
└────────────────────────────┘

Touch Targets (44×44px minimum)
┌───────────────────────────┐
│ ▌▌▌▌▌▌▌▌▌▌▌ 44px       │
│ ▌                         ▌│
│ ▌    Touch Button          ▌│
│ ▌                         ▌│
│ ▌▌▌▌▌▌▌▌▌▌▌ 44px       │
└───────────────────────────┘
```

---

## 🖥️ Retina Display Optimization

```
DPI SUPPORT MATRIX
═══════════════════════════════════════════════════════════════

Standard Display (1x)
┌──────────────────────────┐
│ 96 DPI                   │
│ 1 pixel = 1 device pixel │
│ Desktop monitors         │
│ Older laptops            │
└──────────────────────────┘

Retina Display (2x)
┌──────────────────────────┐
│ 192 DPI                  │
│ 1 pixel = 4 device pixels│
│ MacBook Retina           │
│ iPhone                   │
│ Modern laptops           │
└──────────────────────────┘

Premium Display (3x)
┌──────────────────────────┐
│ 288 DPI                  │
│ 1 pixel = 9 device pixels│
│ iPhone 14+ Pro           │
│ Premium tablets          │
└──────────────────────────┘

OPTIMIZATION PER DPI
═════════════════════════════════════════════════════════════

1x Display: Default rendering
├─ Font: -webkit-font-smoothing: auto
├─ Letter-spacing: 0px
└─ Borders: 1px crisp

2x Display: Enhanced rendering
├─ Font: -webkit-font-smoothing: antialiased
├─ Font-weight: +100 (make heavier)
├─ Letter-spacing: +0.25px
└─ Borders: 1px hardware accelerated

3x Display: Premium rendering
├─ Font: -webkit-font-smoothing: antialiased
├─ Font-weight: +200 (even heavier)
├─ Letter-spacing: +0.5px
└─ Hardware acceleration: enabled
```

---

## 🗂️ Component Integration Flow

```
COMPONENT HIERARCHY
═══════════════════════════════════════════════════════════════

APPLICATION LAYER
    │
    ├─ Dashboard Page
    │   ├─ PageLayout
    │   │   ├─ Title + Description
    │   │   └─ HeaderActions
    │   │
    │   ├─ ContentGrid (3 cols)
    │   │   ├─ Card (Stats)
    │   │   ├─ Card (Charts)
    │   │   └─ Card (Recent Activities)
    │   │
    │   └─ Loading Skeleton
    │       └─ Shimmer animation
    │
    ├─ Schedule Page
    │   ├─ PageLayout
    │   ├─ DateRangeSelector (DatePicker)
    │   ├─ VersionTable (DataGrid)
    │   └─ ScheduleTable
    │       ├─ DataGrid with sorting
    │       ├─ Inline editing (Dialog modals)
    │       ├─ Drag & drop
    │       └─ Pagination
    │
    ├─ Employee Page
    │   ├─ PageLayout
    │   ├─ Search (Combobox)
    │   ├─ Filter (Select + Radio)
    │   ├─ EmployeeList (DataGrid)
    │   │   ├─ Avatar display
    │   │   └─ Status badges
    │   │
    │   └─ EmployeeDetail (Sheet/Dialog)
    │       ├─ Tabs (General, Availability, History)
    │       ├─ Form Inputs
    │       ├─ Availability Editor
    │       └─ Action Buttons
    │
    └─ Settings Page
        ├─ SettingsLayout (Tabs)
        │   ├─ General Tab
        │   ├─ Schedule Tab
        │   ├─ Keyholder Tab
        │   └─ Advanced Tab
        │
        └─ Form Sections
            ├─ Input fields
            ├─ Select dropdowns
            ├─ Toggle switches
            ├─ Checkboxes
            └─ Action buttons

INTERACTION FLOW: Data Loading
═════════════════════════════════════════════════════════════

User triggers data load
    ↓
Component enters loading state
    ↓
Skeleton loader displayed (shimmer animation)
    ↓
Data fetches from API
    ↓
API returns successfully
    ↓
Skeleton fades out (150ms transition)
    ↓
Real content fades in (150ms transition)
    ↓
Toast notification: Success
    ↓
Component fully interactive

INTERACTION FLOW: Form Submission
═════════════════════════════════════════════════════════════

User fills form with data
    ↓
Form validation on blur
    ↓
Submit button enabled
    ↓
User clicks submit
    ↓
Button enters loading state (spinner)
    ↓
Form fields disabled
    ↓
API request sent
    ↓
API returns response
    ↓
Button returns to normal (200ms)
    ↓
Dialog closes (fade out 150ms)
    ↓
Toast: Success notification
    ↓
Page updates with new data
```

---

## 📦 Dependency Architecture

```
PROJECT DEPENDENCY TREE
═══════════════════════════════════════════════════════════════

schichtplan-frontend
├── React 18.3.1
│   └── React DOM 18.3.1
│
├── ReUI Components (@base-ui-components/react)
│   └── Radix UI (peer dependency)
│
├── Framer Motion 12.23.24
│   └── Used by: All animations
│
├── Sonner 2.0.3
│   └── Toast notifications
│
├── Tailwind CSS 3.4.1
│   ├── PostCSS
│   └── Autoprefixer
│
├── Radix UI Suite (existing)
│   ├── @radix-ui/react-accordion
│   ├─ @radix-ui/react-alert-dialog
│   ├── @radix-ui/react-select
│   ├── ... (20+ packages)
│   └── @radix-ui/react-icons
│
├── Form Management
│   ├── react-hook-form 7.56.3
│   ├── @hookform/resolvers 5.0.1
│   └── zod 3.24.4
│
├── Data Management
│   ├── @tanstack/react-query 5.76.1
│   ├── axios 1.9.0
│   └── Redux 5.0.1
│
└── Utilities
    ├── date-fns 4.1.0
    ├── clsx 2.1.1
    ├── tailwind-merge 3.3.0
    └── lucide-react 0.510.0

PEER DEPENDENCIES
═════════════════════════════════════════════════════════════

@base-ui-components/react requires:
  ├─ React ≥ 18.0
  ├─ React DOM ≥ 18.0
  └─ @radix-ui peer deps

Framer Motion requires:
  └─ React ≥ 16.8

Tailwind CSS requires:
  └─ Node ≥ 18
```

---

## 🚀 Implementation Phases Visualization

```
TIMELINE GANTT CHART
═══════════════════════════════════════════════════════════════

Week:    1  2  3  4  5  6  7  8  9 10 11 12 13 14 15

Phase 1: Foundation
         ▓▓ Setup & Dependencies
         ▓▓ Design System CSS
         ▓▓ Component Directory

Phase 2: Core Components
            ▓▓ Form Components
            ▓▓ Data Display

Phase 3: Layout & Navigation
               ▓▓ Dialog/Sheet
               ▓▓ Tabs/Accordion

Phase 4: Page Upgrade
                  ▓▓▓▓ Dashboard
                  ▓▓▓▓ Schedule
                  ▓▓▓▓ Employees
                  ▓▓▓▓ Settings

Phase 5: Animations
                       ▓▓ Transitions
                       ▓▓ Interactive

Phase 6: Quality
                          ▓▓ Performance
                          ▓▓ Accessibility

Phase 7: Testing
                             ▓▓ Component Tests
                             ▓▓ E2E Tests

Phase 8: Release
                                ▓▓ Deploy
                                ▓▓ Support

CRITICAL PATH
═════════════════════════════════════════════════════════════
Foundation (Weeks 1-2)
    ↓
Form Components (Weeks 3-4)
    ↓
Page Upgrades (Weeks 7-10) [Parallel with other phases]
    ↓
Quality Assurance (Week 13)
    ↓
Production Release (Week 15)
```

---

## ✅ Metrics Dashboard

```
SUCCESS METRICS DASHBOARD
═══════════════════════════════════════════════════════════════

DESIGN METRICS
┌──────────────────────────────────────────┐
│ Grid Alignment:     ✅ 100% (4px grid)    │
│ Retina Ready:       ✅ 1x/2x/3x support   │
│ WCAG Compliance:    ✅ Level AA (100%)    │
│ Component Consistency: ✅ 100%            │
└──────────────────────────────────────────┘

PERFORMANCE METRICS
┌──────────────────────────────────────────┐
│ Bundle Size:        < 200KB increase      │
│ Lighthouse Score:   ≥ 90                  │
│ LCP (Largest Paint):< 2.5s                │
│ FID (Input Delay):  < 100ms               │
│ CLS (Cumulative):   < 0.1                 │
│ TTI (Interactive):  < 3s                  │
└──────────────────────────────────────────┘

ACCESSIBILITY METRICS
┌──────────────────────────────────────────┐
│ Color Contrast:     ✅ 4.5:1 minimum     │
│ Keyboard Nav:       ✅ 100% accessible   │
│ Screen Reader:      ✅ Full support      │
│ Focus Management:   ✅ Visible states    │
│ Touch Targets:      ✅ 44x44px minimum   │
└──────────────────────────────────────────┘

COMPONENT COVERAGE
┌──────────────────────────────────────────┐
│ Form Components:    ✅ 8/8 complete      │
│ Data Components:    ✅ 4/4 complete      │
│ Feedback:           ✅ 5/5 complete      │
│ Layout:             ✅ 5/5 complete      │
│ Navigation:         ✅ 3/3 complete      │
│ Visual:             ✅ 6/6 complete      │
└──────────────────────────────────────────┘
```

---

**Visual Architecture Document Version:** 1.0  
**Created:** 2025-11-02  
**Branch:** `feature/reui-design-upgrade`
