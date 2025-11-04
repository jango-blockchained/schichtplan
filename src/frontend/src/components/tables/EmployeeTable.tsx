import { Badge } from "@/components/ui/badge";
import {
  DataTable,
} from "@/components/ui/frappe-table";
import type {
  ColumnDefinition,
  FilterDefinition,
  TableAction,
} from "@/components/ui/data-table/types";
import { Employee } from "@/types";
import { Calendar, Clock, Pencil, Trash2 } from "lucide-react";

interface EmployeeTableProps {
  employees: Employee[];
  employeeGroups: { id: string; name: string }[];
  loading?: boolean;
  error?: string | null;
  onEdit: (employee: Employee) => void;
  onManageAvailability: (employee: Employee) => void;
  onManageAbsence: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onSelectionChange?: (employees: Employee[]) => void;
  bulkActions?: {
    onExport: (employees: Employee[]) => void;
    onBulkDelete: (employees: Employee[]) => void;
  };
  className?: string;
}

export const EmployeeTable = ({
  employees,
  employeeGroups,
  loading = false,
  error = null,
  onEdit,
  onManageAvailability,
  onManageAbsence,
  onDelete,
  onSelectionChange,
  bulkActions,
  className,
}: EmployeeTableProps) => {
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
      sortable: true,
      type: "enum",
      enumOptions: employeeGroups.map((group) => ({
        value: group.id,
        label: group.name,
        variant: "secondary",
      })),
    },
    {
      key: "contracted_hours",
      header: "Hours",
      type: "number",
      sortable: true,
      width: "w-[100px]",
    },
    {
      key: "vacation_per_year",
      header: "Vacation Days",
      type: "number",
      sortable: true,
      width: "w-[130px]",
    },
    {
      key: "birthday",
      header: "Birthday",
      type: "date",
      sortable: true,
    },
    {
      key: "email",
      header: "Contact",
      render: (_, employee) => (
        <div className="flex flex-col space-y-1">
          {employee.email && (
            <span className="text-sm text-muted-foreground">
              {employee.email}
            </span>
          )}
          {employee.phone && (
            <span className="text-sm text-muted-foreground">
              {employee.phone}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "is_keyholder",
      header: "Status",
      render: (_, employee) => (
        <div className="flex flex-col space-y-1">
          {employee.is_keyholder && (
            <Badge variant="secondary">Keyholder</Badge>
          )}
          {!employee.is_active && <Badge variant="destructive">Inactive</Badge>}
        </div>
      ),
    },
  ];

  const actions: TableAction<Employee>[] = [
    {
      icon: <Pencil className="h-4 w-4" />,
      label: "Edit",
      onClick: onEdit,
    },
    {
      icon: <Clock className="h-4 w-4" />,
      label: "Manage Availability",
      onClick: onManageAvailability,
    },
    {
      icon: <Calendar className="h-4 w-4" />,
      label: "Manage Absence",
      onClick: onManageAbsence,
    },
    {
      icon: <Trash2 className="h-4 w-4" />,
      label: "Delete",
      onClick: onDelete,
      variant: "destructive",
    },
  ];

  const filters: FilterDefinition[] = [
    {
      key: "employee_group",
      label: "Group",
      type: "select",
      options: employeeGroups.map((group) => ({
        value: group.id,
        label: group.name,
      })),
    },
    {
      key: "is_keyholder",
      label: "Keyholder",
      type: "boolean",
    },
    {
      key: "is_active",
      label: "Status",
      type: "boolean",
    },
  ];

  const tableBulkActions = bulkActions
    ? [
      {
        icon: <span className="mr-2">📤</span>,
        label: "Export",
        onClick: bulkActions.onExport,
        variant: "outline" as const,
      },
      {
        icon: <Trash2 className="mr-2 h-4 w-4" />,
        label: "Delete",
        onClick: bulkActions.onBulkDelete,
        variant: "destructive" as const,
      },
    ]
    : [];

  return (
    <DataTable
      data={employees}
      columns={columns}
      actions={actions}
      loading={loading}
      error={error}
      searchable={true}
      searchPlaceholder="Search employees..."
      searchKeys={["first_name", "last_name", "employee_id", "email", "phone"]}
      sortable={true}
      filterable={true}
      filters={filters}
      selectable={!!bulkActions}
      onSelectionChange={onSelectionChange}
      bulkActions={tableBulkActions}
      pagination={true}
      itemsPerPageOptions={[10, 25, 50]}
      defaultItemsPerPage={10}
      className={className}
      emptyMessage="No employees found"
    />
  );
};
