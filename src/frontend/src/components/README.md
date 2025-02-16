# PDF Layout Customizer Components

## Overview

The PDF Layout Customizer is a set of React components that allow users to customize the appearance of generated PDF schedules. The components provide an intuitive interface for modifying various aspects of the PDF layout.

## Components

### LayoutCustomizer
The main component that orchestrates the entire layout customization process.

#### Features
- Date range selection
- Table style customization
- Font and title style configuration
- Margin adjustment
- Live preview
- PDF export functionality

### DateRangeSelector
Allows users to select the start and end dates for the schedule.

### TableStyleEditor
Provides controls for customizing table appearance:
- Border color and width
- Cell padding
- Header and body background colors
- Text colors
- Alternating row background

### FontEditor
Enables customization of title text:
- Font family selection
- Font size adjustment
- Font color
- Text alignment

### MarginEditor
Allows adjustment of page margins:
- Top margin
- Right margin
- Bottom margin
- Left margin

### Preview
Displays a simplified preview of the current layout configuration.

## Usage Example

```typescript
import LayoutCustomizer from './LayoutCustomizer';

function SchedulePDFPage() {
  return (
    <div>
      <h1>Schedule PDF Layout</h1>
      <LayoutCustomizer />
    </div>
  );
}
```

## Configuration Options

The layout can be configured with a comprehensive set of options:
- Column widths
- Table styles (borders, colors, padding)
- Title styles (font, size, color, alignment)
- Page margins

## Integration

These components are designed to work seamlessly with the backend PDF generation API, sending a detailed layout configuration to customize the exported PDF. 