# Formulare Page - Visual Design Guide

## Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Formulare                                                       │
│ Zugriff auf professionelle Formulare für Urlaubsmanagement... │
│                                                                  │
│ > Home / Formulare                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ╔════════════════════════════════════════════════════════════╗ │
│ ║ Urlaubsanträge                                             ║ │
│ ║ Antragsformulare für Urlaubsverwaltung                     ║ │
│ ╠════════════════════════════════════════════════════════════╣ │
│ │                                                              │ │
│ │ ┌─────────────────────────┐  ┌─────────────────────────┐  │ │
│ │ │ 📅 Einzelexport         │  │ 👥 Bulk Export          │  │ │
│ │ │                          │  │                          │  │ │
│ │ │ Urlaubsantrag für einen │  │ Urlaubsanträge für alle │  │ │
│ │ │ Mitarbeiter ausfüllen   │  │ Mitarbeiter exportieren │  │ │
│ │ │                          │  │                          │  │ │
│ │ │ [Exportieren]            │  │ [Alle exportieren]      │  │ │
│ │ └─────────────────────────┘  └─────────────────────────┘  │ │
│ │                                                              │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ╔════════════════════════════════════════════════════════════╗ │
│ ║ Urlaubsgenehmigung                                         ║ │
│ ║ Genehmigungsformulare und Übersichten                      ║ │
│ ╠════════════════════════════════════════════════════════════╣ │
│ │                                                              │ │
│ │ ┌─────────────────────────┐  ┌─────────────────────────┐  │ │
│ │ │ ✓ Einzelexport         │  │ 📄 Bulk Export  [Filter]│  │ │
│ │ │                          │  │                          │  │ │
│ │ │ Genehmigungsformular    │  │ Alle Genehmigungen mit  │  │ │
│ │ │ für einen Mitarbeiter   │  │ erweiterten Filteropt...│  │ │
│ │ │                          │  │                          │  │ │
│ │ │ [Exportieren]            │  │ [Mit Filter exportieren]│  │ │
│ │ └─────────────────────────┘  └─────────────────────────┘  │ │
│ │                                                              │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ╔════════════════════════════════════════════════════════════╗ │
│ ║ Jahresübersichten                                          ║ │
│ ║ Umfassende Jahresberichte                                  ║ │
│ ╠════════════════════════════════════════════════════════════╣ │
│ │                                                              │ │
│ │ ┌─────────────────────────┐                                │ │
│ │ │ 📄 Jahresurlaub         │                                │ │
│ │ │                          │                                │ │
│ │ │ Alle Urlaubseinträge für│                                │ │
│ │ │ ein Jahr mit...          │                                │ │
│ │ │                          │                                │ │
│ │ │ [Jahresbericht]          │                                │ │
│ │ └─────────────────────────┘                                │ │
│ │                                                              │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Dialog Flows

### 1. Single Employee Form Flow

```
User clicks "Exportieren" on Single Form
         ↓
Employee Selection Dialog opens
┌──────────────────────────────┐
│ 👥 Mitarbeiter auswählen     │
│                               │
│ Urlaubsantrag - Einzelexport │
│ Urlaubsantrag für einen...   │
│                               │
│ [Mitarbeiter-Dropdown ▼]     │
│                               │
│ [Abbrechen] [Exportieren]    │
└──────────────────────────────┘
         ↓
User selects employee
         ↓
User clicks "Exportieren"
         ↓
PDF generated and opens in new tab
✓ Toast: "PDF wird erstellt"
```

### 2. Filtered Form Flow

```
User clicks "Mit Filter exportieren" on Bulk Form
         ↓
Filter Dialog opens
┌──────────────────────────────┐
│ 📄 Filteroptionen            │
│                               │
│ Alle Genehmigungen mit...    │
│                               │
│ Statusfilter:                │
│ [Alle Status ▼]             │
│                               │
│ Zeitraum:                    │
│ [Aktuelles Jahr ▼]          │
│                               │
│ [Abbrechen] [Mit Filtern...] │
└──────────────────────────────┘
         ↓
User configures filters
         ↓
User clicks "Mit Filtern exportieren"
         ↓
PDF generated with applied filters
✓ Toast: "PDF wird erstellt"
```

## Card Design

### Standard Formular Card

```
┌─────────────────────────────────────────┐
│ 📅  Einzelexport                        │
│                                          │
│ Urlaubsantrag für einen Mitarbeiter    │
│ ausfüllen                               │
│                                          │
│           [Exportieren]                 │
└─────────────────────────────────────────┘
```

### Card with Badge

```
┌─────────────────────────────────────────┐
│ 📄  Bulk Export          [Filter]       │
│                                          │
│ Alle Genehmigungen mit erweiterten     │
│ Filteroptionen exportieren               │
│                                          │
│     [Mit Filter exportieren]            │
└─────────────────────────────────────────┘
```

## Color Scheme

### Professional Colors
- **Primary**: Brand color for headers and buttons
- **Muted**: Light backgrounds for sections
- **Border**: Subtle dividing lines
- **Text**: Dark text on light backgrounds
- **Destructive**: Red for errors/warnings
- **Success**: Green for confirmations

### Card States
- **Normal**: White background, subtle border
- **Hover**: Light shadow, subtle border-primary highlight
- **Active**: Primary color accent

## Typography Hierarchy

```
Formulare (h1 - 24pt)
Main page title

Zugriff auf professionelle Formulare... (p - 14pt)
Page description

Urlaubsanträge (h2 - 20pt)
Category header

Antragsformulare für Urlaubsverwaltung (p - 12pt)
Category description

Einzelexport (h3 - 14pt)
Card title (bold)

Urlaubsantrag für einen Mitarbeiter... (p - 12pt)
Card description
```

## Responsive Behavior

### Desktop (≥1024px)
```
2-column grid per category
┌──────────────────────┬──────────────────────┐
│   Card 1             │   Card 2             │
├──────────────────────┼──────────────────────┤
│   Card 3             │   Card 4             │
└──────────────────────┴──────────────────────┘
```

### Tablet (768px - 1024px)
```
2-column grid per category
┌──────────────────────┬──────────────────────┐
│   Card 1             │   Card 2             │
└──────────────────────┴──────────────────────┘
┌──────────────────────┐
│   Card 3             │
└──────────────────────┘
```

### Mobile (<768px)
```
1-column grid per category
┌──────────────────────┐
│   Card 1             │
├──────────────────────┤
│   Card 2             │
├──────────────────────┤
│   Card 3             │
└──────────────────────┘
```

## Form Types Legend

| Icon | Type | Behavior | Use Case |
|------|------|----------|----------|
| 📅 | Single | Employee selection required | Individual form |
| 👥 | Bulk | No selection, all employees | Mass distribution |
| 📄 | Yearly | No selection, annual data | Reporting |
| 🔍 | Filtered | Filter options available | Selective export |

## Breadcrumb Navigation

```
Home > Formulare

Clicking "Home" returns to dashboard
Clicking "Formulare" reloads current page
```

## Icons Used

- 📅 `Calendar` - Vacation/time-related forms
- 👥 `Users` - Multiple/bulk operations
- 📄 `FileText` - General forms/documents
- ✓ `CheckCircle2` - Approvals/confirmations
- 📊 `FileSpreadsheet` - Data/reporting
- 👤 `UserPlus` - Registration
- ⬇️ `FileDown` - Download/export action

## Empty States (Future)

If no employees or absences available:

```
┌─────────────────────────────────────────┐
│ Keine Daten verfügbar                   │
│                                          │
│ Es gibt keine Mitarbeiter oder          │
│ Urlaubseinträge für die gewählten       │
│ Kriterien.                              │
│                                          │
│ [← Zurück]                              │
└─────────────────────────────────────────┘
```

## Loading State (PDF Generation)

```
Toast Notification:
┌────────────────────────────────────┐
│ PDF wird erstellt                  │
│ Das Formular "..." wird in einem   │
│ neuen Tab geöffnet.               │
└────────────────────────────────────┘

Browser:
New tab opens → PDF loads → Download begins
```

## Error Handling

### Missing Employee Selection
```
Toast Notification (Error):
┌────────────────────────────────────┐
│ ✗ Fehler                           │
│ Bitte wählen Sie einen Mitarbeiter │
│ aus.                               │
└────────────────────────────────────┘
```

### Invalid Year
```
Toast Notification (Error):
┌────────────────────────────────────┐
│ ✗ Fehler                           │
│ Das Geschäftsjahr ist ungültig.   │
│ Bitte versuchen Sie es später.    │
└────────────────────────────────────┘
```

## Accessibility Features

✅ **Keyboard Navigation**
- Tab through all interactive elements
- Enter to activate buttons
- Arrow keys in dropdowns

✅ **Screen Reader Support**
- Semantic HTML structure
- ARIA labels on interactive elements
- Dialog announcements

✅ **Color Contrast**
- All text meets WCAG AA standards
- Not reliant on color alone for information

✅ **Focus Indicators**
- Clear focus rings on interactive elements
- High contrast indicators

## Performance Optimizations

- Lazy loading of employee list in dropdowns
- Efficient PDF generation with streaming
- Optimized grid layout
- CSS transitions for smooth interactions
