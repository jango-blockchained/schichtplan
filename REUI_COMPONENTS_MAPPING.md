# ReUI Components Implementation Mapping

**Status:** Component Reference  
**Version:** 1.0  
**Date:** 2025-11-02

---

## Component Availability & Integration Matrix

### ✅ Core Form Components (High Priority - Phase 2.1)

#### Input Component

- **ReUI Status:** ✅ Available (6 variants)
- **Current Usage:** Basic text inputs across forms
- **Upgrade Features:**
  - Password visibility toggle
  - Prefix/suffix support (icons, currency)
  - Clear button functionality
  - Character count
  - Validation inline feedback
- **Migration Path:** Replace all instances in EmployeeForm, ScheduleForm, etc.
- **Priority:** High
- **Estimated Complexity:** Low

#### Select Component

- **ReUI Status:** ✅ Available (12 variants)
- **Current Usage:** Shift type selection, employee filtering
- **Upgrade Features:**
  - Multi-select capability
  - Search/filter within select
  - Virtual scrolling for 100+ items
  - Custom option rendering
  - Group options support
- **Migration Path:** Replace in shift templates, coverage settings
- **Priority:** High
- **Estimated Complexity:** Medium

#### Combobox Component

- **ReUI Status:** ✅ Available (16 variants - most options!)
- **Current Usage:** New integration opportunity
- **Features:**
  - Async data loading
  - Fuzzy search
  - Keyboard navigation
  - Custom item rendering
  - Accessible with ARIA
- **Use Cases:** Employee selection, shift assignment, coverage slots
- **Priority:** High
- **Estimated Complexity:** Medium

#### Checkbox Component

- **ReUI Status:** ✅ Available (6 variants)
- **Current Usage:** Availability selection, day selection
- **Upgrade Features:**
  - Indeterminate state for group selection
  - Better focus states
  - Label integration
  - Accessibility improvements
- **Priority:** Medium
- **Estimated Complexity:** Low

#### Radio Group Component

- **ReUI Status:** ✅ Available (4 variants)
- **Current Usage:** Filter selection, shift type selection
- **Upgrade Features:**
  - Button-style radio buttons
  - Horizontal/vertical layout
  - Icon support
  - Group descriptions
- **Priority:** Medium
- **Estimated Complexity:** Low

#### Slider Component

- **ReUI Status:** ✅ Available
- **Current Usage:** Not currently used
- **Potential Uses:**
  - Break duration selection
  - Schedule range selection
  - Employee workload balance
  - Shift preference strength
- **Features:**
  - Single/dual thumb
  - Range validation
  - Step increment
  - Tooltips
- **Priority:** Medium
- **Estimated Complexity:** Low

#### Switch Component

- **ReUI Status:** ✅ Available
- **Current Usage:** Feature toggles, shift availability
- **Upgrade Features:**
  - Better labels integration
  - Loading state
  - Error state
  - Accessibility
- **Priority:** Low
- **Estimated Complexity:** Low

#### Textarea Component

- **ReUI Status:** ✅ Available
- **Current Usage:** Notes fields, descriptions
- **Upgrade Features:**
  - Auto-expanding height
  - Character counter
  - Max length enforcement
  - Rich text option (future)
- **Priority:** Low
- **Estimated Complexity:** Low

---

### ✅ Data Display Components (High Priority - Phase 2.2)

#### Data Grid Component

- **ReUI Status:** ✅ Available (21 variants - most powerful!)
- **Current Usage:** Schedule view, employee list
- **Features:**
  - Sorting (single/multi-column)
  - Filtering per column
  - Pagination
  - Row selection
  - Inline editing
  - Custom cell rendering
  - Sticky headers
  - Virtual scrolling (for 1000+ rows)
- **Use Cases:**
  - Schedule table (perfect fit!)
  - Employee roster
  - Shift templates list
  - Vacation calendar (as data)
- **Priority:** Critical
- **Estimated Complexity:** High (due to current complexity of schedule table)

#### Table Component

- **ReUI Status:** ✅ Available
- **Current Usage:** Current ScheduleTable component
- **Upgrade Features:**
  - Striped rows
  - Hover effects
  - Expandable rows
  - Sticky header/footer
  - Sortable columns
- **Priority:** High
- **Estimated Complexity:** Medium

#### Pagination Component

- **ReUI Status:** ✅ Available (3 variants)
- **Current Usage:** New addition for large lists
- **Features:**
  - Page number selection
  - Previous/Next buttons
  - Page size selector
  - Go to page input
- **Priority:** High
- **Estimated Complexity:** Low

#### Breadcrumb Component

- **ReUI Status:** ✅ Available (5 variants)
- **Current Usage:** Navigation in headers
- **Upgrade Features:**
  - Dropdown for skipped levels
  - Current page highlighting
  - Custom separator
  - Mobile-optimized
- **Priority:** Medium
- **Estimated Complexity:** Low

---

### ✅ Feedback Components (High Priority - Phase 2.3)

#### Alert Component

- **ReUI Status:** ✅ Available (10 variants)
- **Current Usage:** Error/success/info messages
- **Upgrade Features:**
  - Contextual variants (success, warning, error, info)
  - Icon support
  - Close button
  - Action buttons
  - Custom styling
- **Priority:** High
- **Estimated Complexity:** Low

#### Alert Dialog Component

- **ReUI Status:** ✅ Available (2 variants)
- **Current Usage:** Deletion confirmations, important actions
- **Features:**
  - Custom title and description
  - Cancel and confirm buttons
  - Danger highlighting
  - Keyboard support
- **Priority:** High
- **Estimated Complexity:** Low

#### Toast/Sonner Component

- **ReUI Status:** ✅ Available (Sonner integration)
- **Current Usage:** Success/error notifications
- **Features:**
  - Auto-dismiss
  - Custom actions
  - Position control (corner variants)
  - Success/error/info/warning types
  - Rich content support
- **Priority:** High
- **Estimated Complexity:** Low

#### Skeleton Component

- **ReUI Status:** ✅ Available
- **Current Usage:** Loading states (partially implemented)
- **Upgrade Features:**
  - Shimmer animation
  - Custom shapes
  - Compound skeletons (table rows, cards)
  - Circular/rectangular variants
  - Animation control
- **Priority:** High
- **Estimated Complexity:** Low

#### Tooltip Component

- **ReUI Status:** ✅ Available
- **Current Usage:** Help text, keyboard hints
- **Upgrade Features:**
  - Rich content support
  - Position variants
  - Delay settings
  - Dark/light theme
  - Trigger options (hover, focus)
- **Priority:** Medium
- **Estimated Complexity:** Low

---

### ✅ Layout Components (High Priority - Phase 3.1)

#### Dialog Component

- **ReUI Status:** ✅ Available (4 variants)
- **Current Usage:** Modals for employee/shift editing
- **Upgrade Features:**
  - Size variants (small, medium, large)
  - Scrollable content
  - Footer actions fixed
  - Close on escape/backdrop
  - Focus management
- **Priority:** High
- **Estimated Complexity:** Medium

#### Sheet Component

- **ReUI Status:** ✅ Available (3 variants - slide-in panels)
- **Current Usage:** New opportunity for side panels
- **Features:**
  - Slide direction (left, right, bottom)
  - Overlay control
  - Focus trap
  - Gesture support (mobile)
- **Potential Uses:**
  - Schedule version panel
  - Shift details panel
  - Employee details sidebar
  - Filters panel
- **Priority:** Medium
- **Estimated Complexity:** Medium

#### Popover Component

- **ReUI Status:** ✅ Available
- **Current Usage:** Dropdown menus, quick actions
- **Upgrade Features:**
  - Rich content support
  - Position control
  - Focus management
  - Trigger flexibility
- **Priority:** Medium
- **Estimated Complexity:** Low

#### Dropdown Menu Component

- **ReUI Status:** ✅ Available (3 variants)
- **Current Usage:** Header menus, context menus
- **Upgrade Features:**
  - Submenus/nested items
  - Icons
  - Separators
  - Disabled items
  - Keyboard navigation
- **Priority:** Medium
- **Estimated Complexity:** Low

#### Scroll Area Component

- **ReUI Status:** ✅ Available
- **Current Usage:** Custom scrollbar styling
- **Features:**
  - Custom scrollbar appearance
  - Smooth scrolling
  - Touch support
  - Size constraints
- **Priority:** Low
- **Estimated Complexity:** Low

---

### ✅ Navigation Components (High Priority - Phase 3.2)

#### Tabs Component

- **ReUI Status:** ✅ Available
- **Current Usage:** Settings pages, content sections
- **Upgrade Features:**
  - Lazy loading per tab
  - Icon support
  - Orientation (horizontal/vertical)
  - Animation
  - Keyboard navigation
- **Priority:** High
- **Estimated Complexity:** Medium

#### Accordion Component

- **ReUI Status:** ✅ Available (5 variants)
- **Current Usage:** Settings sections, details
- **Upgrade Features:**
  - Single/multi-open
  - Icon animations
  - Smooth transitions
  - Custom styling
  - Keyboard nav (arrow keys)
- **Priority:** Medium
- **Estimated Complexity:** Medium

#### Accordion Menu Component

- **ReUI Status:** ✅ Available (6 variants - advanced!)
- **Current Usage:** New opportunity for hierarchical navigation
- **Features:**
  - Nested menu support
  - Expand/collapse animations
  - Icons and badges
  - Active state tracking
  - Keyboard navigation
- **Use Cases:**
  - Settings hierarchical navigation
  - Feature menus
  - Resource navigation
- **Priority:** Medium
- **Estimated Complexity:** Medium

---

### ✅ High-Value Input Components (Phase 3.3)

#### Date Picker Component

- **ReUI Status:** ✅ Available (3 variants)
- **Current Usage:** Schedule date selection, vacation planning
- **Features:**
  - Single date selection
  - Date range selection
  - Preset ranges (This Week, This Month, Last 30 Days)
  - Calendar view
  - Keyboard navigation
  - Locale support
- **Priority:** High
- **Estimated Complexity:** Medium

#### Calendar Component

- **ReUI Status:** ✅ Available (2 variants)
- **Current Usage:** Jahresurlaubskalender (vacation calendar)
- **Upgrade Features:**
  - Event indicators
  - Multi-day events
  - Custom styling per day
  - Month/year navigation
  - Week view option
  - Print optimization
- **Priority:** High
- **Estimated Complexity:** High

#### Kbd Component

- **ReUI Status:** ✅ Available (3 variants)
- **Current Usage:** Keyboard shortcut display
- **Features:**
  - Platform-specific key names (Cmd vs Ctrl)
  - Combination support
  - Visual styling
  - Nested keys
- **Priority:** Low
- **Estimated Complexity:** Low

---

### ✅ Visual Components (Phase 4)

#### Badge Component

- **ReUI Status:** ✅ Available (13 variants)
- **Current Usage:** Status indicators, labels
- **Upgrade Features:**
  - Color variants (default, secondary, success, warning, destructive)
  - Icon support
  - Closeable option
  - Custom sizes
  - Outline variants
- **Priority:** Medium
- **Estimated Complexity:** Low

#### Avatar Component

- **ReUI Status:** ✅ Available (8 variants)
- **Current Usage:** User profiles, employee lists
- **Upgrade Features:**
  - Image fallback
  - Size variants
  - Status indicator
  - Group avatars
  - Custom badge overlay
- **Priority:** Medium
- **Estimated Complexity:** Low

#### Separator Component

- **ReUI Status:** ✅ Available
- **Current Usage:** Visual dividers
- **Features:**
  - Horizontal/vertical
  - Custom styling
  - Text-centered option
  - Custom decorations
- **Priority:** Low
- **Estimated Complexity:** Low

#### Card Component

- **ReUI Status:** ✅ Available (2 variants)
- **Current Usage:** Content containers
- **Upgrade Features:**
  - Hover effects
  - Header/footer sections
  - Content padding
  - Custom styling
- **Priority:** High
- **Estimated Complexity:** Low

#### Button Component

- **ReUI Status:** ✅ Available (17 variants - comprehensive!)
- **Current Usage:** Primary component throughout
- **Upgrade Features:**
  - Size variants (sm, base, lg)
  - Color variants (default, secondary, ghost, destructive)
  - Icon support
  - Loading state
  - Disabled state
  - Full width option
- **Priority:** Critical
- **Estimated Complexity:** Low

---

## Implementation Priority Matrix

### Phase 1: Critical Path (Weeks 1-2)

1. **Button** (17 variants) - Used everywhere
2. **Input** (6 variants) - Core form element
3. **Card** (2 variants) - Layout foundation
4. **Alert** (10 variants) - Feedback system

### Phase 2: Form System (Weeks 3-4)

5. **Select** (12 variants) - Dropdowns
6. **Combobox** (16 variants) - Advanced selection
7. **Checkbox** (6 variants) - Toggling
8. **Radio Group** (4 variants) - Exclusive selection
9. **Data Grid** (21 variants) - Data tables

### Phase 3: Interaction (Weeks 5-6)

10. **Dialog** (4 variants) - Modals
11. **Tabs** (generic) - Tab navigation
12. **Date Picker** (3 variants) - Date selection
13. **Tooltip** - Helper text
14. **Skeleton** - Loading states

### Phase 4: Polish (Weeks 7-10)

15. **Toast/Sonner** - Notifications
16. **Dropdown Menu** (3 variants) - Context menus
17. **Badge** (13 variants) - Status labels
18. **Avatar** (8 variants) - User display
19. **Calendar** (2 variants) - Calendar views

### Phase 5: Advanced (Weeks 11-12)

20. **Sheet** (3 variants) - Side panels
21. **Accordion Menu** (6 variants) - Navigation trees
22. **Slider** - Range inputs
23. **Breadcrumb** (5 variants) - Navigation
24. **Pagination** (3 variants) - Page navigation

---

## ReUI Component Features Comparison

### Coverage vs Current Implementation

| Feature           | Current      | ReUI                | Benefit                        |
| ----------------- | ------------ | ------------------- | ------------------------------ |
| **Form Inputs**   | Basic        | Enhanced (multi)    | Password toggle, prefix/suffix |
| **Select**        | Single       | Multi-select        | Better filtering               |
| **Search**        | Manual       | Integrated Combobox | Autocomplete, async            |
| **Data Display**  | Manual table | Data Grid (21!)     | Sorting, filtering, pagination |
| **Modals**        | Custom       | Dialog variants     | Better animations              |
| **Toast**         | Custom       | Sonner              | Native feel, animations        |
| **Dates**         | Basic        | DatePicker (3!)     | Range selection, presets       |
| **Animations**    | Limited      | Motion integrated   | Smooth transitions             |
| **Accessibility** | Partial      | Full WCAG 2.1 AA    | Keyboard nav, screen readers   |

---

## Component Usage Examples

### Button Migration Example

**Before (Shadcn):**

```tsx
import { Button } from "@/components/ui/button";

<Button variant="default" size="md">
  Click Me
</Button>;
```

**After (ReUI):**

```tsx
import { Button } from "@/components/reui/Button";

<Button
  variant="default"
  size="base"
  icon={<ChevronRight />}
  onClick={handleClick}
>
  Click Me
</Button>;
```

### Form Input Migration Example

**Before:**

```tsx
<Input type="text" placeholder="Enter name" />
```

**After (ReUI):**

```tsx
<Input
  type="text"
  placeholder="Enter name"
  prefix={<User size={16} />}
  clearable
  onClear={() => setName("")}
  hint="Max 50 characters"
/>
```

### Data Grid Migration Example

**Before (Manual Table):**

```tsx
<table>
  {data.map((row) => (
    <tr key={row.id}>
      <td>{row.name}</td>
      <td>{row.shift}</td>
    </tr>
  ))}
</table>
```

**After (ReUI Data Grid):**

```tsx
<DataGrid
  columns={[
    { id: "name", header: "Name", sortable: true },
    { id: "shift", header: "Shift", filterable: true },
  ]}
  data={data}
  sortable
  filterable
  paginated
  pageSize={50}
/>
```

---

## Dependency Additions

### Required Packages

```bash
bun add @base-ui-components/react
bun add framer-motion
bun add sonner
bun add @radix-ui/react-dialog  # Already have, verify version
bun add date-fns                # Already have, verify version
```

### Version Specifications

```json
{
  "dependencies": {
    "@base-ui-components/react": "^1.0.0",
    "framer-motion": "^12.0.0",
    "sonner": "^2.0.0",
    "date-fns": "^4.1.0"
  }
}
```

### Peer Dependencies

- React 18.3.1 ✅ (already have)
- React DOM 18.3.1 ✅ (already have)
- Tailwind CSS 3.4.1 ✅ (already have)

---

## Testing Strategy per Component

### Unit Tests

- Component renders correctly
- Props are applied
- Events fire appropriately
- Accessibility attributes present

### Integration Tests

- Form submission with new inputs
- Data grid sorting/filtering
- Modal open/close workflow
- Dialog focus management

### Accessibility Tests

- Keyboard navigation
- Screen reader output
- Focus management
- Color contrast

### Visual Tests

- Pixel perfection on different DPI
- Animation smoothness
- Mobile responsiveness
- Theme consistency

---

## Migration Checklist Template

For each component:

```markdown
### [Component Name]

**Status:** Planning | In Progress | Testing | Complete

- [ ] Install ReUI component
- [ ] Create wrapper component (if needed)
- [ ] Update TypeScript types
- [ ] Add unit tests
- [ ] Add integration tests
- [ ] Update component documentation
- [ ] Update design guide
- [ ] Test accessibility
- [ ] Test on mobile
- [ ] Test on retina display
- [ ] Code review
- [ ] Merge to main
- [ ] Update CHANGELOG
```

---

**Next Steps:**

1. Review ReUI documentation at reui.io
2. Create detailed component wrappers
3. Begin Phase 1 implementation
4. Conduct accessibility audit
5. Measure performance impact

**Document Version:** 1.0  
**Last Updated:** 2025-11-02
