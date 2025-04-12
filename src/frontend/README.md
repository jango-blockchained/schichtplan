# ShiftWise Frontend

## Overview

The frontend for the ShiftWise scheduling application, built with React and Material-UI, provides an intuitive interface for generating and customizing shift schedules. The application allows for comprehensive management of employee groups, schedule layouts, and PDF export settings.

## Project Structure

### Components

- `LayoutCustomizer`: Main component for PDF layout customization
  - Preset management (save, load, import, export)
  - Layout configuration
  - Real-time preview
- `DateRangeSelector`: Allows selection of start and end dates
- `TableStyleEditor`: Provides controls for table appearance
  - Border customization
  - Cell padding
  - Color schemes
  - Header and body styling
- `FontEditor`: Enables font and text styling customization
  - Font family selection
  - Size adjustment
  - Color picker
  - Text alignment
- `MarginEditor`: Allows adjustment of page margins
  - Top, right, bottom, left margins
  - Millimeter-based input
- `EmployeeSettingsEditor`: Manages employee groups and settings
  - Dynamic group creation and deletion
  - Customizable work hour ranges
  - Full-time/part-time designation
  - Group-specific settings
- `Preview`: Displays a live preview of the current layout configuration

## Key Features

### Layout Customization
- Dynamic PDF layout customization
- Real-time preview of layout changes
- Preset management system
- Responsive design
- Accessibility-focused UI

### Employee Group Management
- Dynamic employee group configuration
- Predefined employment models:
  - VZ (Vollzeit) - Full-time employees
  - TZ (Teilzeit) - Part-time employees
  - GFB (Geringfügig Beschäftigt) - Mini-job employees
  - TL (Team Leader) - Management positions
- Customizable settings per group:
  - Unique identifier
  - Group name and description
  - Minimum and maximum working hours
  - Full-time status
- Validation rules:
  - Unique group IDs
  - Valid hour ranges (0-168 hours)
  - Minimum hours ≤ Maximum hours
  - At least one group must exist

### Preset System
- Built-in presets (Classic, Modern, Compact)
- Custom preset creation and management
- Local storage for persistent settings
- Import/Export functionality

## Getting Started

### Prerequisites

- Bun >= 1.2

### Installation

1. Clone the repository
2. Navigate to the frontend directory
   ```bash
   cd src/frontend
   ```
3. Install dependencies:
   ```bash
   bun install
   ```
4. Navigate to the backend directory
   ```bash
   cd ../backend
   ```
5. Install backend dependencies
   ```bash
   bun install
   ```

### Running the Application

Start the application from root directory
```bash
./start.sh
```

## Configuration

The application uses a comprehensive layout configuration object:

```typescript
interface LayoutConfig {
  column_widths: number[];
  table_style: {
    border_color: string;
    border_width: number;
    cell_padding: number;
    header_background: string;
    header_text_color: string;
    body_background: string;
    body_text_color: string;
    alternating_row_background: string;
  };
  title_style: {
    font: string;
    size: number;
    color: string;
    alignment: string;
  };
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  employee_groups: EmployeeGroup[];
}

interface EmployeeGroup {
  id: string;
  name: string;
  description: string;
  minHours: number;
  maxHours: number;
  isFullTime: boolean;
}
```

## Testing

Run tests with:

```bash
bun test
```

## Deployment

```bash
bun run build
```

## Technologies

- React
- TypeScript
- Material-UI
- Local Storage for persistence
- Fetch API for backend communication

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
