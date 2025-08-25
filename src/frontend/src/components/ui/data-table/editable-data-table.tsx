import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { InlineEditState } from "@/hooks/useInlineEdit";
import { Check, Edit, X } from "lucide-react";
import { DataTable } from "./data-table";
import { ColumnDefinition, DataTableProps } from "./types";

interface EditableColumnDefinition<T> extends ColumnDefinition<T> {
    editable?: boolean;
    editComponent?: "input" | "select" | "switch" | "number" | "date";
    editOptions?: { value: string | number | boolean; label: string }[];
    editProps?: Record<string, unknown>;
}

interface EditableDataTableProps<T extends { id: number | string }>
    extends Omit<DataTableProps<T>, "columns" | "actions"> {
    columns: EditableColumnDefinition<T>[];
    inlineEdit?: InlineEditState<T>;
    onStartEdit?: (item: T) => void;
    actions?: DataTableProps<T>["actions"];
}

export function EditableDataTable<T extends { id: number | string }>({
    columns,
    inlineEdit,
    onStartEdit,
    actions = [],
    ...props
}: EditableDataTableProps<T>) {
    const enhancedColumns: ColumnDefinition<T>[] = columns.map(column => ({
        ...column,
        render: column.render || ((value, item) => {
            if (!inlineEdit || !column.editable) {
                // Use default rendering if not editable
                if (column.type === "boolean") {
                    return value ? "Yes" : "No";
                }
                if (column.type === "date") {
                    return value ? new Date(value as string).toLocaleDateString() : "-";
                }
                return value === null || value === undefined ? "-" : String(value);
            }

            const isEditing = inlineEdit.isEditing(item.id);
            const editValue = inlineEdit.getEditValue(item.id, column.key);
            const displayValue = isEditing ? editValue : value;

            if (!isEditing) {
                return (
                    <div className="flex items-center gap-2">
                        <span>
                            {value === null || value === undefined ? "-" : String(value)}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onStartEdit?.(item)}
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                        >
                            <Edit className="h-3 w-3" />
                        </Button>
                    </div>
                );
            }

            // Render edit component based on type
            switch (column.editComponent || column.type) {
                case "select":
                    return (
                        <Select
                            value={String(displayValue || "")}
                            onValueChange={(value) => inlineEdit.updateField(item.id, column.key, value as T[keyof T])}
                        >
                            <SelectTrigger className="h-8 w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {column.editOptions?.map(option => (
                                    <SelectItem key={String(option.value)} value={String(option.value)}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    );

                case "switch":
                    return (
                        <Switch
                            checked={Boolean(displayValue)}
                            onCheckedChange={(checked) =>
                                inlineEdit.updateField(item.id, column.key, checked as T[keyof T])
                            }
                        />
                    );

                case "number":
                    return (
                        <Input
                            type="number"
                            value={String(displayValue || "")}
                            onChange={(e) =>
                                inlineEdit.updateField(item.id, column.key, Number(e.target.value) as T[keyof T])
                            }
                            className="h-8"
                            {...(column.editProps || {})}
                        />
                    );

                case "date":
                    return (
                        <Input
                            type="date"
                            value={displayValue ? String(displayValue).split('T')[0] : ""}
                            onChange={(e) =>
                                inlineEdit.updateField(item.id, column.key, e.target.value as T[keyof T])
                            }
                            className="h-8"
                            {...(column.editProps || {})}
                        />
                    );

                default:
                    return (
                        <Input
                            value={String(displayValue || "")}
                            onChange={(e) =>
                                inlineEdit.updateField(item.id, column.key, e.target.value as T[keyof T])
                            }
                            className="h-8"
                            {...(column.editProps || {})}
                        />
                    );
            }
        }),
    }));

    const enhancedActions = inlineEdit ? [
        ...actions,
        {
            icon: <Check className="h-4 w-4" />,
            label: "Save",
            onClick: (item: T) => inlineEdit.saveEdit(item.id),
            variant: "default" as const,
            disabled: (item: T) => !inlineEdit.isEditing(item.id),
        },
        {
            icon: <X className="h-4 w-4" />,
            label: "Cancel",
            onClick: (item: T) => inlineEdit.cancelEdit(item.id),
            variant: "ghost" as const,
            disabled: (item: T) => !inlineEdit.isEditing(item.id),
        },
    ] : actions;

    return (
        <div>
            {inlineEdit?.hasChanges && (
                <div className="mb-4 flex gap-2 items-center p-3 bg-muted rounded-md">
                    <span className="text-sm text-muted-foreground">
                        You have unsaved changes
                    </span>
                    <Button size="sm" onClick={inlineEdit.saveAll}>
                        Save All
                    </Button>
                    <Button size="sm" variant="outline" onClick={inlineEdit.cancelAll}>
                        Cancel All
                    </Button>
                </div>
            )}

            <DataTable
                {...props}
                columns={enhancedColumns}
                actions={enhancedActions}
            />
        </div>
    );
}
