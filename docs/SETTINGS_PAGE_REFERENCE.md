# Settings Page Quick Reference

## Overview

The Unified Settings Page provides a centralized interface for managing all application configuration across 9 different sections.

---

## Navigation

### Sidebar Sections

1. **General Store Setup** - Basic store information and operating hours
2. **Scheduling Engine** - Core scheduling rules and constraints
3. **Employee & Shift Definitions** - Employee types, shift types, and absence types
4. **Availability Configuration** - Availability status types and colors
5. **Week Navigation** - Week-based navigation preferences
6. **Appearance & Display** - Theme, colors, and calendar display
7. **Integrations & AI** - AI-powered features configuration
8. **Data Management** - Database operations and demo data
9. **Holiday Management** - Special days and holidays

---

## Key Features

### Auto-Save

- All changes are automatically saved after 2 seconds of inactivity
- Visual indicator shows "Saving..." during save operations
- No manual "Save" button required

### Real-Time Updates

- WebSocket integration for multi-user support
- Notifications when settings change from another session
- Automatic query invalidation on updates

### Validation

- All numeric inputs have min/max constraints
- Help text explains each field's purpose
- Type-specific inputs (tel, email, number, time)

---

## Section Details

### 1. General Store Setup

#### Store Information

- **Store Name** - Display name for your store
- **Store Address** - Physical address
- **Store Phone** - Contact phone (format: +49 123 456789)
- **Store Email** - Contact email address

#### Opening Days

- Visual toggle switches for each day of the week
- Mon-Sun selection
- **Opening Time** - Store opens (HH:MM format)
- **Closing Time** - Store closes (HH:MM format)

#### Keyholder Settings

- **Keyholder Before Opening** - Minutes before opening (0-120, step: 5)
- **Keyholder After Closing** - Minutes after closing (0-120, step: 5)

---

### 2. Scheduling Engine

#### Core Parameters

- **Resource Type** - Shifts or Coverage based scheduling
- **Default Shift Duration** - Hours (1-24, step: 0.5)
- **Min Break Duration** - Minutes (0-120, step: 5)
- **Min Rest Between Shifts** - Hours (8-24, legal requirement: 11)

#### Constraints

- **Max Daily Hours** - Per employee (1-24, step: 0.5)
- **Max Weekly Hours** - Per employee (1-80)
- **Total Weekly Working Hours** - All employees combined (1-1000)
- **Scheduling Period** - Weeks to generate (1-12)

#### Algorithm

- **Scheduling Algorithm** - Standard or Optimized
- **Auto-schedule by preferences** - Toggle
- **Enable Schedule Diagnostics** - Toggle with info tooltip

#### Generation Requirements

- Detailed checklist of scheduling rules to enforce
- Managed via ScheduleGenerationSettings component

---

### 3. Employee & Shift Definitions

#### Employee Types

- Configure employee categories
- Set working hour limits per type
- Color coding for visual identification

#### Absence Types

- Define absence categories (vacation, sick, etc.)
- Assign colors for schedule display

#### Shift Types

- Create shift categories (morning, evening, night)
- Color coding and auto-assign rules

---

### 4. Availability Configuration

- **System-Defined Types:**

  - UNAVAILABLE - Cannot work
  - FIXED - Must work
  - AVAILABLE - Can work
  - PREFERRED - Prefers to work

- **Editable Properties:**
  - Color (hex picker)
  - Other properties managed by system

---

### 5. Week Navigation

#### Weekend Start

- **Monday (ISO Standard)** - Week starts Monday
- **Sunday** - Week starts Sunday

#### Month Boundary Mode

- **Keep Intact** - Weeks spanning months treated as single units
- **Split by Month** - Weeks divided at month boundaries

---

### 6. Appearance & Display

#### Theme & Colors

- **Theme** - Light, Dark, or System
- **Accent Color** - Hex color picker
- **Primary Color** - Hex color picker

#### Calendar Display

- **Start Day of Week** - Sunday or Monday
- **Default Calendar View** - Month, Week, or Day

---

### 7. Integrations & AI

#### AI Schedule Generation

- **Enable AI** - Toggle to activate AI features
- **Gemini API Key** - Password-protected input
- Integration with Google's Gemini AI models

---

### 8. Data Management

#### Demo Data Generation

- **Select Module** - Choose which data to generate
  - Settings
  - Employees
  - Shifts
  - Coverage
  - Availability
  - Absences
  - All Modules
- **Number of Employees** - Count for generation (min: 1)
- **Generate Data** - Standard demo data
- **Generate Optimized** - AI-optimized demo data

#### Database Management

- **Backup Database** - Download JSON backup
- **Restore Database** - Upload JSON backup
- **Wipe Tables** - Selective table deletion with confirmation
  - Multi-select with checkboxes
  - Destructive action warning

---

### 9. Holiday Management

- Separate component for managing special days
- Public holidays configuration
- Store-specific special days

---

## Best Practices

### Data Entry

1. Use Tab key to navigate between fields
2. Watch for help text below fields
3. Wait for "Saving..." indicator before navigating away
4. Check validation messages for invalid inputs

### Multi-User Collaboration

1. Pay attention to "Settings Updated" notifications
2. Page will auto-refresh changed settings
3. Last save wins in case of conflicts
4. Consider coordinating major changes with team

### Safety

1. Always backup before major changes
2. Test demo data in non-production environments
3. Selective wipe allows recovery of important tables
4. API keys are password-masked but stored in plaintext

---

## Keyboard Shortcuts

- **Tab** - Move to next field
- **Shift+Tab** - Move to previous field
- **Enter** - Submit (in text fields triggers auto-save)
- **Space** - Toggle switches/checkboxes
- **Escape** - Close dialogs

---

## Troubleshooting

### Settings Not Saving

1. Check for validation errors (red border on fields)
2. Verify network connectivity
3. Check browser console for errors
4. Ensure server is running

### Changes Not Appearing

1. Wait for "Saving..." indicator to complete
2. Check for error toasts
3. Refresh page to force reload
4. Check if another user overwrote changes

### WebSocket Disconnected

1. Check WebSocket indicator in header
2. Try refreshing the page
3. Verify server WebSocket endpoint
4. Check browser console for connection errors

---

## Technical Notes

### API Endpoints

- GET `/api/settings` - Fetch settings
- PUT `/api/settings` - Update settings
- WebSocket `/socket.io` - Real-time events

### Query Keys

- `['settings']` - Main settings query
- `['shifts']` - Shift templates
- Related queries invalidated on updates

### Debounce Timing

- 2000ms (2 seconds) before auto-save triggers
- Can be cancelled if user navigates away
- Immediate save on certain actions (display, week nav, AI)

---

## Related Documentation

- [Core Concepts](./core_concepts.md) - Domain model understanding
- [MCP Integration Guide](./MCP_INTEGRATION_GUIDE.md) - AI integration
- [Design System](../src/frontend/DESIGN_SYSTEM.md) - UI components
- [Settings Improvements](./SETTINGS_PAGE_IMPROVEMENTS.md) - Recent changes

---

**Last Updated:** 9 October 2025  
**Version:** 1.0
