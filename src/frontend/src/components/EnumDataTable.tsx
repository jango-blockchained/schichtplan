import { Button } from "@/components/ui/button";
import { FrappeDataTable } from "@/components/ui/frappe-table";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FrappeDataTableRef } from "@/components/ui/frappe-table/FrappeDataTable";

export interface EnumItem {
  id: string;
  name: string;
  [key: string]: any;
}

interface EnumDataTableProps<T extends EnumItem> {
  data: T[];
  columns: Array<{
    id: string;
    name: string;
    editable?: boolean;
    width?: number;
    format?: (value: any, item?: T) => string | React.ReactNode;
  }>;
  onAdd: () => void;
  onEdit: (item: T) => void;
  onDelete: (id: string) => void;
  title: string;
  isLoading?: boolean;
}

export function EnumDataTable<T extends EnumItem>({
  data,
  columns,
  onAdd,
  onEdit,
  onDelete,
  title,
  isLoading = false,
}: EnumDataTableProps<T>) {
  const tableRef = useRef<FrappeDataTableRef>(null);
  const [tableData, setTableData] = useState<any[][]>([]);

  // Convert data to Frappe DataTable format
  useEffect(() => {
    const formattedData = data.map((item) => {
      const row = columns.map((col) => {
        const value = item[col.id];
        if (col.format) {
          return col.format(value);
        }
        return value !== undefined && value !== null ? String(value) : "";
      });
      
      // Add actions as hidden column (we'll render them separately)
      row.push(item.id);
      
      return row;
    });
    
    setTableData(formattedData);
  }, [data, columns]);

  // Frappe columns with actions
  const frappeColumns = [
    ...columns.map((col) => ({
      name: col.name,
      id: col.id,
      editable: false,
      width: col.width,
    })),
    {
      name: "Actions",
      id: "actions",
      editable: false,
      width: 120,
      format: (value: string) => {
        // This is a hack - we'll render actions outside the table
        return "";
      },
    },
  ];

  // Custom row renderer with actions
  const renderTableWithActions = () => {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button onClick={onAdd} size="sm" disabled={isLoading}>
            <Plus className="h-4 w-4 mr-1" />
            Add {title}
          </Button>
        </div>

        {/* Use native table for better control over actions */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className="px-4 py-3 text-left text-sm font-medium"
                  >
                    {col.name}
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-sm font-medium w-[120px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((item, idx) => (
                <tr
                  key={item.id}
                  className="hover:bg-muted/50 transition-colors"
                >
                  {columns.map((col) => (
                    <td key={col.id} className="px-4 py-3 text-sm">
                      {col.format
                        ? col.format(item[col.id], item)
                        : item[col.id] !== undefined && item[col.id] !== null
                        ? String(item[col.id])
                        : ""}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-sm">
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(item)}
                        disabled={isLoading}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(item.id)}
                        disabled={isLoading}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No {title.toLowerCase()} found. Click "Add {title}" to create one.
          </div>
        )}
      </div>
    );
  };

  return renderTableWithActions();
}
