# Frappe DataTable Integration

This directory contains the integration of [Frappe DataTable](https://github.com/frappe/datatable) into the Schichtplan frontend.

## Overview

Frappe DataTable is a modern, feature-rich JavaScript datatable library that provides:
- Fast rendering of large datasets
- Built-in sorting and filtering
- Keyboard navigation
- Column resizing and reordering
- Tree view support
- Efficient virtual scrolling

## Components

### FrappeDataTable.tsx
React wrapper component for Frappe DataTable with:
- Proper lifecycle management (mount/unmount)
- TypeScript support
- React refs for imperative API access
- Automatic data refresh on props changes

### DataTableAdapter.tsx
Backward-compatible adapter that:
- Maintains the same API as the old DataTable component
- Converts React-based column definitions to Frappe format
- Handles search, filtering, and pagination
- Supports actions and bulk operations
- Provides seamless migration path

### types.ts
TypeScript type definitions for Frappe DataTable API

### data-table-types.ts
Preserved type definitions from the old DataTable for backward compatibility

### frappe-table.css
Custom CSS to integrate Frappe DataTable with Shadcn UI theme:
- Matches Tailwind color scheme
- Responsive design
- Consistent spacing and borders
- Proper hover and selection states

## Usage

### Basic Usage (Direct)

```tsx
import { FrappeDataTable } from '@/components/ui/frappe-table';

<FrappeDataTable
  columns={[
    { name: 'Name', id: 'name', sortable: true },
    { name: 'Email', id: 'email', sortable: true },
    { name: 'Role', id: 'role' },
  ]}
  data={[
    ['John Doe', 'john@example.com', 'Admin'],
    ['Jane Smith', 'jane@example.com', 'User'],
  ]}
  serialNoColumn={true}
  checkboxColumn={false}
  layout="fluid"
/>
```

### Backward Compatible Usage (via Adapter)

```tsx
import { DataTable } from '@/components/ui/frappe-table';
import type { ColumnDefinition } from '@/components/ui/frappe-table/data-table-types';

const columns: ColumnDefinition<Employee>[] = [
  {
    key: 'first_name',
    header: 'Name',
    sortable: true,
    render: (_, emp) => `${emp.first_name} ${emp.last_name}`,
  },
  {
    key: 'email',
    header: 'Email',
    sortable: true,
  },
];

<DataTable
  data={employees}
  columns={columns}
  searchable={true}
  sortable={true}
  pagination={true}
  actions={[
    {
      icon: <Edit />,
      label: 'Edit',
      onClick: (emp) => handleEdit(emp),
    },
  ]}
/>
```

## Migration Guide

### For Simple Tables

1. Replace import:
```tsx
// Old
import { DataTable } from '@/components/ui/data-table';

// New
import { DataTable } from '@/components/ui/frappe-table';
```

2. Update type imports if needed:
```tsx
import type { ColumnDefinition } from '@/components/ui/frappe-table/data-table-types';
```

### For Complex Tables

Tables with inline editing, complex React components in cells, or highly customized behavior may be better served by keeping the native HTML table implementation.

## Current Status

### Migrated Components
- ✅ EmployeeTable (via adapter)
- ✅ ShiftTable (via adapter)

### Kept as Native HTML Tables
- AbsencesPage - Complex inline editing
- VacationPlanningPage - Advanced grouping and bulk operations
- VersionsPage - Custom VersionTable with specialized features

### Excluded
- SchedulePage - Per project requirements

## Performance

Frappe DataTable provides excellent performance:
- Virtual scrolling for large datasets
- Efficient DOM updates
- Minimal re-renders
- Small bundle size (74.7 KB minified)

## Limitations

- **React Components in Cells**: Frappe DataTable doesn't natively support React components in cells. The adapter provides workarounds but complex components may not work well.
- **Inline Editing**: Complex inline editing scenarios are better handled with native HTML tables.
- **Custom Styling**: While we've styled it to match the theme, some customization may be limited.

## Future Enhancements

Potential improvements:
- Tree view support for hierarchical data
- Inline filters for advanced filtering
- Export functionality (CSV, Excel)
- Row grouping
- Custom cell editors

## Dependencies

- frappe-datatable@1.19.0

The following are automatically installed as dependencies of frappe-datatable:
- sortablejs@^1.7.0
- hyperlist@^1.0.0-beta
- lodash@^4.17.5

## Resources

- [Frappe DataTable GitHub](https://github.com/frappe/datatable)
- [Frappe DataTable Demo](https://frappe.io/datatable)
- [API Documentation](https://frappe.io/datatable/docs)
