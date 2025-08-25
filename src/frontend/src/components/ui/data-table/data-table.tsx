import {
    Button,
    Checkbox,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Filter, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { EnumBadge } from "./badge-renderer";
import { DataTableProps, FilterConfig, SortConfig } from "./types";
import { filterData, getDefaultSort, paginateData, sortData } from "./utils";

export function DataTable<T extends { id: number | string }>({
    data,
    columns,
    actions = [],
    loading = false,
    error = null,
    searchable = true,
    searchPlaceholder = "Search...",
    searchKeys,
    sortable = true,
    initialSort,
    filterable = true,
    filters = [],
    selectable = false,
    onSelectionChange,
    bulkActions = [],
    pagination = true,
    itemsPerPageOptions = [10, 25, 50, 100],
    defaultItemsPerPage = 10,
    className,
    emptyMessage = "No data available",
    onRowClick,
}: DataTableProps<T>) {
    // State management
    const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(
        initialSort || getDefaultSort(columns)
    );
    const [filterConfig, setFilterConfig] = useState<FilterConfig>({});
    const [selectedItems, setSelectedItems] = useState<Set<T["id"]>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(defaultItemsPerPage);

    // Determine searchable keys
    const effectiveSearchKeys = useMemo(() => {
        if (searchKeys) return searchKeys;
        return columns.filter(col => col.searchable !== false).map(col => col.key);
    }, [searchKeys, columns]);

    // Process data
    const processedData = useMemo(() => {
        let result = [...data];

        // Apply filters
        result = filterData(result, filterConfig, effectiveSearchKeys);

        // Apply sorting
        result = sortData(result, sortConfig);

        return result;
    }, [data, filterConfig, sortConfig, effectiveSearchKeys]);

    // Apply pagination
    const { paginatedData, totalPages } = useMemo(() => {
        if (!pagination) return { paginatedData: processedData, totalPages: 1 };

        return paginateData(processedData, {
            currentPage,
            itemsPerPage,
            totalItems: processedData.length,
        });
    }, [processedData, currentPage, itemsPerPage, pagination]);

    // Selection handlers
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const newSelected = new Set(paginatedData.map(item => item.id));
            setSelectedItems(newSelected);
            onSelectionChange?.(paginatedData);
        } else {
            setSelectedItems(new Set());
            onSelectionChange?.([]);
        }
    };

    const handleSelectItem = (itemId: T["id"], checked: boolean) => {
        const newSelected = new Set(selectedItems);
        if (checked) {
            newSelected.add(itemId);
        } else {
            newSelected.delete(itemId);
        }
        setSelectedItems(newSelected);

        const selectedData = data.filter(item => newSelected.has(item.id));
        onSelectionChange?.(selectedData);
    };

    // Sort handler
    const handleSort = (key: keyof T) => {
        const column = columns.find(col => col.key === key);
        if (!column || column.sortable === false) return;

        setSortConfig(current => ({
            key,
            direction: current?.key === key && current.direction === "asc" ? "desc" : "asc",
        }));
    };

    // Filter handlers
    const handleSearchChange = (value: string) => {
        setFilterConfig(prev => ({ ...prev, search: value }));
        setCurrentPage(1);
    };

    const handleFilterChange = (key: string, value: string | boolean | null) => {
        setFilterConfig(prev => ({
            ...prev,
            [key]: value === "" || value === "all" ? null : value,
        }));
        setCurrentPage(1);
    };

    // Render cell content
    const renderCellContent = (column: typeof columns[0], item: T) => {
        const value = item[column.key];

        if (column.render) {
            return column.render(value, item);
        }

        switch (column.type) {
            case "boolean":
                return value ? "Yes" : "No";
            case "date":
                return value ? new Date(value as string).toLocaleDateString() : "-";
            case "enum":
                return column.enumOptions ? (
                    <EnumBadge value={value as string | number | boolean} options={column.enumOptions} />
                ) : String(value);
            case "badges":
                return (
                    <div className="flex flex-wrap gap-1">
                        {Array.isArray(value) ? (
                            value.map((v, idx) => (
                                <EnumBadge
                                    key={idx}
                                    value={v}
                                    options={column.enumOptions || []}
                                />
                            ))
                        ) : (
                            value && <EnumBadge value={value as string | number | boolean} options={column.enumOptions || []} />
                        )}
                    </div>
                );
            default:
                return value === null || value === undefined ? "-" : String(value);
        }
    };

    const allSelected = paginatedData.length > 0 && selectedItems.size === paginatedData.length;
    const someSelected = selectedItems.size > 0 && selectedItems.size < paginatedData.length;

    if (error) {
        return (
            <div className="rounded-md bg-destructive/15 p-4 text-destructive">
                Error: {error}
            </div>
        );
    }

    return (
        <div className={cn("space-y-4", className)}>
            {/* Search and Filters */}
            {(searchable || filterable) && (
                <div className="flex gap-4 items-center">
                    {searchable && (
                        <div className="flex-1 relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder={searchPlaceholder}
                                value={(filterConfig.search as string) || ""}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                    )}

                    {filterable && filters.length > 0 && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline">
                                    <Filter className="mr-2 h-4 w-4" />
                                    Filter
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[200px]">
                                {filters.map((filter) => (
                                    <div key={filter.key} className="p-2">
                                        <Label>{filter.label}</Label>
                                        {filter.type === "select" && filter.options && (
                                            <Select
                                                value={String(filterConfig[filter.key] || "all")}
                                                onValueChange={(value) => handleFilterChange(filter.key, value)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder={filter.placeholder} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All</SelectItem>
                                                    {filter.options.map((option) => (
                                                        <SelectItem key={String(option.value)} value={String(option.value)}>
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                        {filter.type === "boolean" && (
                                            <Select
                                                value={String(filterConfig[filter.key] || "all")}
                                                onValueChange={(value) =>
                                                    handleFilterChange(filter.key, value === "all" ? null : value === "true")
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder={filter.placeholder} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All</SelectItem>
                                                    <SelectItem value="true">Yes</SelectItem>
                                                    <SelectItem value="false">No</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            )}

            {/* Bulk Actions */}
            {selectable && selectedItems.size > 0 && bulkActions.length > 0 && (
                <div className="flex gap-2 items-center">
                    <span className="text-sm text-muted-foreground">
                        {selectedItems.size} selected
                    </span>
                    {bulkActions.map((action, index) => (
                        <Button
                            key={index}
                            variant={action.variant || "outline"}
                            size="sm"
                            onClick={() => {
                                const selectedData = data.filter(item => selectedItems.has(item.id));
                                action.onClick(selectedData);
                            }}
                        >
                            {action.icon}
                            {action.label}
                        </Button>
                    ))}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setSelectedItems(new Set());
                            onSelectionChange?.([]);
                        }}
                    >
                        Clear selection
                    </Button>
                </div>
            )}

            {/* Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {selectable && (
                                <TableHead className="w-[50px]">
                                    <Checkbox
                                        checked={allSelected}
                                        onCheckedChange={handleSelectAll}
                                        className={someSelected ? "data-[state=checked]:bg-primary" : ""}
                                    />
                                </TableHead>
                            )}
                            {columns.map((column) => (
                                <TableHead
                                    key={String(column.key)}
                                    className={cn(
                                        column.width,
                                        sortable && column.sortable !== false && "cursor-pointer hover:bg-muted/50"
                                    )}
                                    onClick={() => sortable && handleSort(column.key)}
                                >
                                    <div className="flex items-center gap-2">
                                        {column.header}
                                        {sortable && column.sortable !== false && sortConfig?.key === column.key && (
                                            sortConfig.direction === "asc" ?
                                                <ChevronUp className="h-4 w-4" /> :
                                                <ChevronDown className="h-4 w-4" />
                                        )}
                                    </div>
                                </TableHead>
                            ))}
                            {actions.length > 0 && <TableHead>Actions</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)}
                                    className="text-center py-8"
                                >
                                    <div className="flex justify-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)}
                                    className="text-center py-8 text-muted-foreground"
                                >
                                    {emptyMessage}
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((item) => (
                                <TableRow
                                    key={String(item.id)}
                                    className={cn(
                                        selectedItems.has(item.id) && "bg-muted",
                                        onRowClick && "cursor-pointer hover:bg-muted/50"
                                    )}
                                    onClick={() => onRowClick?.(item)}
                                >
                                    {selectable && (
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedItems.has(item.id)}
                                                onCheckedChange={(checked) =>
                                                    handleSelectItem(item.id, checked as boolean)
                                                }
                                            />
                                        </TableCell>
                                    )}
                                    {columns.map((column) => (
                                        <TableCell key={String(column.key)}>
                                            {renderCellContent(column, item)}
                                        </TableCell>
                                    ))}
                                    {actions.length > 0 && (
                                        <TableCell>
                                            <div className="flex space-x-2">
                                                {actions.map((action, index) => (
                                                    <Button
                                                        key={index}
                                                        variant={action.variant || "ghost"}
                                                        size="icon"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            action.onClick(item);
                                                        }}
                                                        disabled={action.disabled?.(item)}
                                                    >
                                                        {action.icon}
                                                    </Button>
                                                ))}
                                            </div>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {pagination && totalPages > 1 && (
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                            {processedData.length} total items
                        </span>
                        <Select
                            value={String(itemsPerPage)}
                            onValueChange={(value) => {
                                setItemsPerPage(Number(value));
                                setCurrentPage(1);
                            }}
                        >
                            <SelectTrigger className="w-20">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {itemsPerPageOptions.map((option) => (
                                    <SelectItem key={option} value={String(option)}>
                                        {option}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="text-sm text-muted-foreground">per page</span>
                    </div>

                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            Previous
                        </Button>
                        <div className="flex items-center gap-2">
                            <span className="text-sm">
                                Page {currentPage} of {totalPages}
                            </span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
