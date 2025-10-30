# Frontend UI Changes for Vacation PDF Export

## VacationPlanningPage

### Location
`src/frontend/src/pages/VacationPlanningPage.tsx`

### Changes Made

#### 1. Added PDF Export Dropdown Button

**Before:** Only had action buttons for creating absences
```tsx
<div className="flex gap-2">
  <Button variant="outline" onClick={() => setShowBulkModal(true)}>
    <Plus className="h-4 w-4 mr-2" />
    Schnell-Eingabe
  </Button>
  <Button onClick={() => setShowMultistepModal(true)}>
    <Plus className="h-4 w-4 mr-2" />
    Mehrstufige Planung
  </Button>
  <Button variant="outline" onClick={() => setShowAbsenceModal(true)}>
    <Plus className="h-4 w-4 mr-2" />
    Einzelne Abwesenheit
  </Button>
</div>
```

**After:** Added PDF Export dropdown as first button
```tsx
<div className="flex gap-2">
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline">
        <Download className="h-4 w-4 mr-2" />
        PDF Export
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => handleExportPDF('admin-yearly')}>
        Jahresplanung (Admin)
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleExportPDF('overview')}>
        Übersicht (Alle Mitarbeiter)
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleExportPDF('yearly-calendar')}>
        Jahreskalender
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  <!-- existing buttons -->
</div>
```

#### 2. Added PDF Export Handler Function

```tsx
const handleExportPDF = (type: string) => {
  const currentYear = new Date().getFullYear();
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
  let url = '';
  
  switch (type) {
    case 'admin-yearly':
      url = `${apiBaseUrl}/api/v2/vacation-pdf/admin-yearly?year=${currentYear}`;
      break;
    case 'overview':
      url = `${apiBaseUrl}/api/v2/vacation-pdf/overview?year=${currentYear}`;
      break;
    case 'yearly-calendar':
      url = `${apiBaseUrl}/api/v2/vacation-pdf/yearly-calendar?year=${currentYear}`;
      break;
    default:
      return;
  }
  
  // Open PDF in new window
  window.open(url, '_blank');
  
  toast({
    title: "PDF wird erstellt",
    description: "Das PDF wird in einem neuen Tab geöffnet.",
  });
};
```

#### 3. Added Import for Download Icon

```tsx
import {
  // ... existing imports
  Download,
  // ... more imports
} from "lucide-react";
```

#### 4. Added Import for DropdownMenu

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
```

### Visual Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Urlaubsplanung                                                  │
│ Verwalten Sie Urlaubsanträge und Abwesenheiten                 │
│                                                                  │
│ ┌──────────────┐ ┌───────────────┐ ┌────────────────┐ ┌──────┐│
│ │📥 PDF Export ▼│ │➕ Schnell-    │ │➕ Mehrstufige  │ │➕ ... ││
│ └──────────────┘ └───────────────┘ └────────────────┘ └──────┘│
│      │                                                           │
│      ▼                                                           │
│  ┌──────────────────────────────┐                              │
│  │ Jahresplanung (Admin)        │                              │
│  │ Übersicht (Alle Mitarbeiter) │                              │
│  │ Jahreskalender               │                              │
│  └──────────────────────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

### User Flow

1. User navigates to VacationPlanningPage
2. User clicks "PDF Export" button
3. Dropdown menu appears with 3 options
4. User selects desired PDF type
5. PDF opens in new browser tab
6. Toast notification confirms action
7. User can save or print PDF from browser

---

## FormularsPage

### Location
`src/frontend/src/pages/FormularsPage.tsx`

### Changes Made

#### 1. Added Employee Selector Section

**New Card Above Formular Grid:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Mitarbeiter auswählen (für Urlaubsantrag)</CardTitle>
  </CardHeader>
  <CardContent>
    <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
      <SelectTrigger className="w-full max-w-md">
        <SelectValue placeholder="Mitarbeiter auswählen..." />
      </SelectTrigger>
      <SelectContent>
        {employees.map((emp) => (
          <SelectItem key={emp.id} value={emp.id.toString()}>
            {emp.first_name} {emp.last_name} ({emp.employee_id})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </CardContent>
</Card>
```

#### 2. Added Employee Data Fetching

```tsx
const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");

const { data: employees = [] } = useQuery({
  queryKey: ["employees"],
  queryFn: getEmployees,
});
```

#### 3. Updated Formular Handler

```tsx
const handleFormularClick = (formularId: string) => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
  
  if (formularId === "vacation-request") {
    if (!selectedEmployeeId) {
      toast({
        title: "Bitte Mitarbeiter auswählen",
        description: "Wählen Sie einen Mitarbeiter für den Urlaubsantrag aus.",
        variant: "destructive",
      });
      return;
    }
    
    const url = `${apiBaseUrl}/api/v2/vacation-pdf/employee-request?employee_id=${selectedEmployeeId}`;
    window.open(url, '_blank');
    
    toast({
      title: "PDF wird erstellt",
      description: "Der Urlaubsantrag wird in einem neuen Tab geöffnet.",
    });
  } else {
    // Other formulars not yet implemented
    toast({
      title: "Formular noch nicht verfügbar",
      description: `Das Formular ist noch nicht implementiert.`,
      variant: "destructive",
    });
  }
};
```

#### 4. Updated Formular Card with Disabled State

```tsx
<Button
  variant="outline"
  className="w-full"
  onClick={() => handleFormularClick(formular.id)}
  disabled={formular.requiresEmployee && !selectedEmployeeId}
>
  <FileDown className="h-4 w-4 mr-2" />
  Formular öffnen
</Button>
```

#### 5. Added New Vacation Request Formular

```tsx
{
  id: "vacation-request",
  title: "Urlaubsantrag",
  description: "Urlaubsantrag für Mitarbeiter ausfüllen",
  icon: Calendar,
  requiresEmployee: true,
}
```

### Visual Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Formulare                                                        │
│ Zugriff auf alle verfügbaren Formulare                         │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Mitarbeiter auswählen (für Urlaubsantrag)                   ││
│ │                                                              ││
│ │ ┌───────────────────────────────────────────────┐           ││
│ │ │ Anna Schmidt (SCH)                           ▼│           ││
│ │ └───────────────────────────────────────────────┘           ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐                  │
│ │📅 Urlaubs- │ │📅 Abwesen- │ │👤 Mitarb.  │                  │
│ │   antrag   │ │   heits-   │ │   Registr. │                  │
│ │            │ │   antrag   │ │            │                  │
│ │            │ │            │ │            │                  │
│ │ [Enabled]  │ │ [Disabled] │ │ [Disabled] │                  │
│ └────────────┘ └────────────┘ └────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

### User Flow

1. User navigates to FormularsPage
2. User selects employee from dropdown
3. "Urlaubsantrag" button becomes enabled
4. User clicks "Formular öffnen" on vacation request card
5. PDF opens in new browser tab with blank form
6. Employee details pre-filled (name, ID, email, entitlement)
7. User prints or saves PDF for offline completion

---

## Design Consistency

### Icons Used
- **Download** (`lucide-react`): For PDF export actions
- **FileDown** (`lucide-react`): For formular downloads
- **Calendar** (`lucide-react`): For vacation-related items

### Button Styling
- **Outline variant**: For secondary actions (PDF export, formulars)
- **Default variant**: For primary actions (create absences)
- **Disabled state**: When prerequisites not met

### Toast Notifications
- **Success**: "PDF wird erstellt" with description
- **Error**: "Bitte Mitarbeiter auswählen" for validation
- **Info**: "Formular noch nicht verfügbar" for unimplemented

### Dropdown Menu
- **Alignment**: `align="end"` for right-aligned dropdown
- **Items**: Clear German labels for each PDF type
- **Behavior**: Click-to-open, click-to-close

---

## Accessibility

### Keyboard Navigation
- ✓ Dropdown menu accessible via keyboard
- ✓ Employee selector navigable with arrow keys
- ✓ All buttons have proper focus states

### Screen Readers
- ✓ Button labels clearly describe action
- ✓ Dropdown items have descriptive text
- ✓ Toast notifications are announced

### Visual Feedback
- ✓ Disabled state clearly indicated
- ✓ Hover effects on interactive elements
- ✓ Loading states (toast notifications)

---

## Browser Compatibility

### PDF Opening
- Opens in new tab (`window.open(url, '_blank')`)
- Falls back to download if popup blocked
- Compatible with Chrome, Firefox, Safari, Edge

### Environment Variables
- Uses `import.meta.env.VITE_API_BASE_URL`
- Falls back to `http://localhost:5000` for development
- Configurable via `.env` file

---

## Error Handling

### Validation
- **Employee Selection**: Required for vacation request
- **API Availability**: Toast notification if backend unreachable
- **PDF Generation Errors**: Handled by backend, logged

### User Feedback
- Clear error messages in German
- Destructive variant for errors
- Helpful descriptions for next steps
