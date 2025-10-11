# Reusable Table Component Architecture

This document describes the new reusable table component architecture for datasets like employees, shifts, and other entities.

## Features

- ✅ **Sortable columns** - Click column headers to sort
- ✅ **Inline editing** - Edit cells directly in the table
- ✅ **Automatic badges for enums** - Predefined styling for status, boolean, and enum values
- ✅ **Pagination** - Configurable page sizes and navigation
- ✅ **Rows per page** - User can choose how many items to display
- ✅ **Search input** - Global search across specified fields
- ✅ **Filtering** - Dropdown filters for specific columns
- ✅ **Bulk selection** - Select multiple items for bulk operations
- ✅ **Responsive design** - Works on all screen sizes
- ✅ **TypeScript support** - Fully typed with excellent IntelliSense

## Core Components

### 1. DataTable

The main table component that handles all the basic functionality.

```tsx
import {
  DataTable,
  ColumnDefinition,
  TableAction,
} from "@/components/ui/data-table";

const columns: ColumnDefinition<Employee>[] = [
  {
    key: "first_name",
    header: "Name",
    sortable: true,
    searchable: true,
    render: (_, employee) => `${employee.first_name} ${employee.last_name}`,
  },
  {
    key: "employee_group",
    header: "Group",
    type: "enum",
    enumOptions: groups.map((g) => ({ value: g.id, label: g.name })),
  },
];

const actions: TableAction<Employee>[] = [
  {
    icon: <Pencil className="h-4 w-4" />,
    label: "Edit",
    onClick: handleEdit,
  },
];

<DataTable
  data={employees}
  columns={columns}
  actions={actions}
  searchable={true}
  filterable={true}
  selectable={true}
  pagination={true}
/>;
```

### 2. EditableDataTable

Extended version with inline editing capabilities.

```tsx
import { EditableDataTable } from "@/components/ui/data-table";
import { useInlineEdit } from "@/hooks/useInlineEdit";

const inlineEdit = useInlineEdit({
  onUpdate: async (id, changes) => {
    await updateEmployee(id, changes);
  },
});

const columns: EditableColumnDefinition<Employee>[] = [
  {
    key: "first_name",
    header: "First Name",
    editable: true,
    editComponent: "input",
  },
  {
    key: "is_active",
    header: "Active",
    editable: true,
    editComponent: "switch",
  },
];

<EditableDataTable
  data={employees}
  columns={columns}
  inlineEdit={inlineEdit}
  onStartEdit={(employee) => inlineEdit.startEdit(employee.id, employee)}
/>;
```

### 3. Specialized Tables

Ready-to-use tables for specific entities:

#### EmployeeTable

```tsx
import { EmployeeTable } from "@/components/tables";

<EmployeeTable
  employees={employees}
  employeeGroups={employeeGroups}
  loading={isLoading}
  error={error}
  onEdit={handleEdit}
  onManageAvailability={handleAvailability}
  onManageAbsence={handleAbsence}
  onDelete={handleDelete}
  bulkActions={{
    onExport: handleBulkExport,
    onBulkDelete: handleBulkDelete,
  }}
/>;
```

#### ShiftTable

```tsx
import { ShiftTable } from "@/components/tables";

<ShiftTable
  shifts={shifts}
  shiftTypes={shiftTypes}
  loading={isLoading}
  onEdit={handleEdit}
  onDelete={handleDelete}
  onDuplicate={handleDuplicate}
/>;
```

## Column Types

The table supports various column types with automatic rendering:

```tsx
const columns: ColumnDefinition<MyEntity>[] = [
  // Text column (default)
  { key: "name", header: "Name", type: "text" },

  // Number column
  { key: "hours", header: "Hours", type: "number" },

  // Boolean column (renders "Yes"/"No")
  { key: "is_active", header: "Active", type: "boolean" },

  // Date column (automatic formatting)
  { key: "birthday", header: "Birthday", type: "date" },

  // Enum with badges
  {
    key: "status",
    header: "Status",
    type: "enum",
    enumOptions: [
      { value: "active", label: "Active", variant: "default" },
      { value: "inactive", label: "Inactive", variant: "destructive" },
    ],
  },

  // Multiple badges
  {
    key: "tags",
    header: "Tags",
    type: "badges",
    enumOptions: tagOptions,
  },

  // Custom render function
  {
    key: "contact",
    header: "Contact",
    render: (_, item) => (
      <div>
        <div>{item.email}</div>
        <div>{item.phone}</div>
      </div>
    ),
  },
];
```

## Filtering

Add filters with the `filters` prop:

```tsx
const filters: FilterDefinition[] = [
  {
    key: "employee_group",
    label: "Group",
    type: "select",
    options: employeeGroups.map((g) => ({ value: g.id, label: g.name })),
  },
  {
    key: "is_keyholder",
    label: "Keyholder",
    type: "boolean",
  },
];

<DataTable
  data={employees}
  columns={columns}
  filterable={true}
  filters={filters}
/>;
```

## Search

Configure search behavior:

```tsx
<DataTable
  data={employees}
  columns={columns}
  searchable={true}
  searchPlaceholder="Search employees..."
  searchKeys={["first_name", "last_name", "email", "phone"]}
/>
```

## Bulk Actions

Add bulk operations for selected rows:

```tsx
const bulkActions: TableAction<Employee[]>[] = [
  {
    icon: <Download className="mr-2 h-4 w-4" />,
    label: "Export",
    onClick: handleBulkExport,
    variant: "outline",
  },
  {
    icon: <Trash2 className="mr-2 h-4 w-4" />,
    label: "Delete",
    onClick: handleBulkDelete,
    variant: "destructive",
  },
];

<DataTable
  data={employees}
  columns={columns}
  selectable={true}
  bulkActions={bulkActions}
  onSelectionChange={setSelectedEmployees}
/>;
```

## Styling and Customization

### Badge Configurations

Predefined badge styles are available:

```tsx
import { BADGE_CONFIGS } from "@/components/ui/data-table";

// Use predefined configurations
const column = {
  key: "is_active",
  header: "Status",
  type: "enum",
  enumOptions: Object.entries(BADGE_CONFIGS.status).map(([key, config]) => ({
    value: key === "active",
    label: config.label,
    variant: config.variant,
  })),
};
```

### Custom Styling

```tsx
<DataTable
  className="custom-table-styles"
  data={data}
  columns={columns}
  // ... other props
/>
```

## Migration Guide

### From Existing EmployeesPage

1. **Replace the manual table with EmployeeTable:**

```tsx
// Before
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      // ... many lines of manual table code
    </TableRow>
  </TableHeader>
  // ... more manual code
</Table>

// After
<EmployeeTable
  employees={employees}
  employeeGroups={employeeGroups}
  onEdit={handleEdit}
  onDelete={handleDelete}
  // ... other handlers
/>
```

2. **Remove manual sorting/filtering/pagination logic** - it's all built-in!

3. **Simplify state management** - no more manual state for sorting, filters, pagination.

### Creating New Tables

1. **For simple cases, use DataTable directly:**

```tsx
<DataTable data={myData} columns={myColumns} />
```

2. **For complex cases, create a specialized component:**

```tsx
// components/tables/MyEntityTable.tsx
export const MyEntityTable = ({ entities, onEdit, onDelete, ...props }) => {
  const columns = [
    // Define columns specific to your entity
  ];

  return (
    <DataTable
      data={entities}
      columns={columns}
      actions={
        [
          /* entity-specific actions */
        ]
      }
      {...props}
    />
  );
};
```

## Examples

Complete examples are available in:

- `/src/examples/EmployeesPageExample.tsx` - Full employee management page
- `/src/examples/ShiftsPageExample.tsx` - Shift management page

These show real-world usage with all features enabled.

## Performance Notes

- **Virtualization**: For very large datasets (1000+ rows), consider implementing virtual scrolling
- **Memoization**: Column definitions and actions are automatically memoized
- **Debouncing**: Search input is debounced to prevent excessive filtering
- **Lazy Loading**: Pagination helps with performance by only rendering visible rows

## Best Practices

1. **Keep column definitions stable** - define them outside the component or use useMemo
2. **Use TypeScript** - the components are fully typed for excellent developer experience
3. **Compose specialized tables** - create entity-specific table components for reuse
4. **Leverage built-in types** - use the predefined column types when possible
5. **Handle loading states** - always provide loading and error states

## Future Enhancements

- [ ] Virtual scrolling for large datasets
- [ ] Column resizing and reordering
- [ ] Export to multiple formats (PDF, Excel)
- [ ] Advanced filtering with date ranges
- [ ] Saved filter presets
- [ ] Column visibility toggle
- [ ] Row grouping and aggregation
