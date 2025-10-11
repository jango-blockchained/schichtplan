# MEP Template - New Version Modal

## Overview
The MEP Template component now includes a modal for creating new versions of the schedule. This allows users to:
- Select a specific week number from a dropdown
- Specify a new version number for that week
- Create a new version with the selected parameters

## Features Added

### 1. New Version Modal
- **Week Number Dropdown**: Pre-populated with weeks 1-52 of the current year
- **Version Number Input**: Numeric input for the new version number (defaults to current + 1)
- **Form Validation**: Ensures required fields are completed
- **Responsive Design**: Centered modal with overlay

### 2. Enhanced Action Buttons
- **Print Button**: Original print functionality preserved
- **New Version Button**: Opens the modal for version creation
- **Modern Styling**: Updated button design with hover effects

### 3. Updated Props
The `MEPTemplate` component now accepts an additional optional prop:
```typescript
onCreateNewVersion?: (weekNumber: number, versionNumber: number) => void
```

## Usage Example

```tsx
import { MEPTemplate } from '@/components/Schedule/MEPTemplate';

const handleCreateNewVersion = (weekNumber: number, versionNumber: number) => {
  console.log(`Creating version ${versionNumber} for week ${weekNumber}`);
  // Implement your version creation logic here
};

<MEPTemplate
  data={mepData}
  onPrint={() => window.print()}
  onCreateNewVersion={handleCreateNewVersion}
/>
```

## CSS Classes Added

### Modal Styles
- `.modal-overlay`: Full-screen overlay with backdrop
- `.modal-content`: Main modal container
- `.modal-header`: Header section with title and close button
- `.modal-form`: Form container
- `.form-group`: Form field grouping
- `.form-select`, `.form-input`: Styled form controls
- `.modal-actions`: Button container
- `.btn-cancel`, `.btn-submit`: Action buttons

### Action Button Styles
- `.action-buttons-container`: Container for action buttons
- `.action-button`: Base button styles
- `.print-button`, `.version-button`: Specific button types

## Integration
The modal has been integrated into the SchedulePage component with proper error handling and user feedback through toast notifications.
