import { Badge } from "@/components/ui/badge";
import {
  ColumnDefinition,
  DataTable,
  TableAction,
} from "@/components/ui/data-table";
import { Shift } from "@/types";
import { Copy, Pencil, Trash2 } from "lucide-react";

interface ShiftTableProps {
  shifts: Shift[];
  shiftTypes?: { id: string; name: string; color?: string }[];
  loading?: boolean;
  error?: string | null;
  onEdit: (shift: Shift) => void;
  onDelete: (shift: Shift) => void;
  onDuplicate?: (shift: Shift) => void;
  onSelectionChange?: (shifts: Shift[]) => void;
  className?: string;
}

export const ShiftTable = ({
  shifts,
  shiftTypes = [],
  loading = false,
  error = null,
  onEdit,
  onDelete,
  onDuplicate,
  onSelectionChange,
  className,
}: ShiftTableProps) => {
  const formatTime = (time: string) => {
    return time; // Assuming time is already in HH:MM format
  };

  const columns: ColumnDefinition<Shift>[] = [
    {
      key: "start_time",
      header: "Time",
      sortable: true,
      render: (_, shift) =>
        `${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}`,
    },
    {
      key: "duration_hours",
      header: "Duration",
      type: "number",
      sortable: true,
      width: "w-[100px]",
      render: (value) => `${value}h`,
    },
    {
      key: "shift_type_id",
      header: "Type",
      type: "enum",
      enumOptions: shiftTypes.map((type) => ({
        value: type.id,
        label: type.name,
        variant: "secondary",
      })),
    },
    {
      key: "active_days",
      header: "Active Days",
      render: (_, shift) => (
        <div className="flex flex-wrap gap-1">
          {shift.active_days.map((day) => {
            const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
            return (
              <Badge key={day} variant="outline" className="text-xs">
                {dayNames[day]}
              </Badge>
            );
          })}
        </div>
      ),
    },
    {
      key: "requires_break",
      header: "Break",
      type: "boolean",
      render: (value) => (
        <Badge variant={value ? "secondary" : "outline"}>
          {value ? "Required" : "Not Required"}
        </Badge>
      ),
    },
  ];

  const actions: TableAction<Shift>[] = [
    {
      icon: <Pencil className="h-4 w-4" />,
      label: "Edit",
      onClick: onEdit,
    },
    ...(onDuplicate
      ? [
          {
            icon: <Copy className="h-4 w-4" />,
            label: "Duplicate",
            onClick: onDuplicate,
          },
        ]
      : []),
    {
      icon: <Trash2 className="h-4 w-4" />,
      label: "Delete",
      onClick: onDelete,
      variant: "destructive" as const,
    },
  ];

  return (
    <DataTable
      data={shifts}
      columns={columns}
      actions={actions}
      loading={loading}
      error={error}
      searchable={false} // Shifts might not need text search
      sortable={true}
      initialSort={{ key: "start_time", direction: "asc" }}
      filterable={false} // Can be enabled if needed
      selectable={!!onSelectionChange}
      onSelectionChange={onSelectionChange}
      pagination={true}
      itemsPerPageOptions={[10, 25, 50]}
      defaultItemsPerPage={10}
      className={className}
      emptyMessage="No shifts configured"
    />
  );
};
