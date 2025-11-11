import {
    Button,
    Checkbox,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    MoreHorizontal,
    Search
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { DataTableProps, SortConfig } from './types';

export function DataTable<T extends { id: number | string }>({
    data,
    columns,
    actions = [],
    loading = false,
    error = null,
    searchable = true,
    searchPlaceholder = 'Search...',
    searchKeys,
    sortable = true,
    initialSort,
    filterable = false,
    filters = [],
    selectable = false,
    onSelectionChange,
    bulkActions = [],
    pagination = true,
    itemsPerPageOptions = [10, 25, 50, 100],
    defaultItemsPerPage = 10,
    className,
    emptyMessage = 'No data available',
    onRowClick,
}: DataTableProps<T>) {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(defaultItemsPerPage);
    const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(initialSort || null);
    const [selectedItems, setSelectedItems] = useState<Set<T['id']>>(new Set());
    const [filterConfig, setFilterConfig] = useState<Record<string, string | boolean | null>>({});

    // Filter and search data
    const filteredData = useMemo(() => {
        let result = [...data];

        // Apply search filter
        if (searchTerm && searchable) {
            const searchLower = searchTerm.toLowerCase();
            const keysToSearch = searchKeys || columns.map((c) => c.key);

            result = result.filter((item) =>
                keysToSearch.some((key) => {
                    const value = item[key];
                    return value != null && String(value).toLowerCase().includes(searchLower);
                })
            );
        }

        // Apply filters
        Object.entries(filterConfig).forEach(([key, filterValue]) => {
            if (filterValue !== null && filterValue !== undefined && filterValue !== '') {
                result = result.filter((item) => {
                    const itemValue = item[key as keyof T];
                    if (typeof filterValue === 'boolean') {
                        return Boolean(itemValue) === filterValue;
                    }
                    return itemValue === filterValue;
                });
            }
        });

        return result;
    }, [data, searchTerm, searchable, searchKeys, columns, filterConfig]);

    // Sort data
    const sortedData = useMemo(() => {
        if (!sortConfig || !sortable) return filteredData;

        return [...filteredData].sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];

            if (aValue == null && bValue == null) return 0;
            if (aValue == null) return 1;
            if (bValue == null) return -1;

            let comparison = 0;
            if (aValue > bValue) {
                comparison = 1;
            } else if (aValue < bValue) {
                comparison = -1;
            }

            return sortConfig.direction === 'desc' ? comparison * -1 : comparison;
        });
    }, [filteredData, sortConfig, sortable]);

    // Paginate data
    const paginatedData = useMemo(() => {
        if (!pagination) return sortedData;
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        return sortedData.slice(start, end);
    }, [sortedData, currentPage, itemsPerPage, pagination]);

    const totalPages = Math.ceil(sortedData.length / itemsPerPage);

    // Handle sorting
    const handleSort = useCallback((key: keyof T) => {
        if (!sortable) return;

        setSortConfig(current => {
            if (!current || current.key !== key) {
                return { key, direction: 'asc' };
            }
            if (current.direction === 'asc') {
                return { key, direction: 'desc' };
            }
            return null; // Remove sorting
        });
    }, [sortable]);

    // Handle selection
    const handleSelectItem = useCallback((itemId: T['id'], isSelected: boolean) => {
        setSelectedItems(prev => {
            const newSelected = new Set(prev);
            if (isSelected) {
                newSelected.add(itemId);
            } else {
                newSelected.delete(itemId);
            }

            const selectedItemObjects = data.filter(item => newSelected.has(item.id));
            onSelectionChange?.(selectedItemObjects);

            return newSelected;
        });
    }, [data, onSelectionChange]);

    const handleSelectAll = useCallback((isSelected: boolean) => {
        if (isSelected) {
            const allIds = new Set(sortedData.map(item => item.id));
            setSelectedItems(allIds);
            onSelectionChange?.(sortedData);
        } else {
            setSelectedItems(new Set());
            onSelectionChange?.([]);
        }
    }, [sortedData, onSelectionChange]);

    const isAllSelected = selectedItems.size > 0 && sortedData.every(item => selectedItems.has(item.id));
    const isIndeterminate = selectedItems.size > 0 && !isAllSelected;

    // Handle filter changes
    const handleFilterChange = useCallback((key: string, value: string | boolean | null) => {
        setFilterConfig(prev => ({ ...prev, [key]: value }));
        setCurrentPage(1);
    }, []);

    // Render sort icon
    const renderSortIcon = (columnKey: keyof T) => {
        if (!sortConfig || sortConfig.key !== columnKey) {
            return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
        }
        return sortConfig.direction === 'asc'
            ? <ArrowUp className="ml-2 h-4 w-4" />
            : <ArrowDown className="ml-2 h-4 w-4" />;
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-md bg-destructive/15 p-4 text-destructive">
                {error}
            </div>
        );
    }

    return (
        <div className={cn('space-y-4', className)}>
            {/* Search and filters */}
            {(searchable || filterable) && (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    {searchable && (
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder={searchPlaceholder}
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="pl-9"
                            />
                        </div>
                    )}

                    {filterable && filters.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                            {filters.map((filter) => (
                                <div key={filter.key} className="min-w-[150px]">
                                    {filter.type === 'select' && filter.options && (
                                        <Select
                                            value={filterConfig[filter.key] || "__all__"}
                                            onValueChange={(value) => handleFilterChange(filter.key, value === "__all__" ? null : value)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={filter.label} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__all__">All {filter.label}</SelectItem>
                                                {filter.options.map((option) => (
                                                    <SelectItem key={String(option.value)} value={String(option.value)}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    {filter.type === 'boolean' && (
                                        <Select
                                            value={filterConfig[filter.key] === true ? "true" : filterConfig[filter.key] === false ? "false" : "__all__"}
                                            onValueChange={(value) =>
                                                handleFilterChange(filter.key, value === "__all__" ? null : value === "true")
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={filter.label} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__all__">All</SelectItem>
                                                <SelectItem value="true">Yes</SelectItem>
                                                <SelectItem value="false">No</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Bulk actions */}
            {selectable && selectedItems.size > 0 && bulkActions.length > 0 && (
                <div className="flex items-center gap-2 p-4 bg-muted rounded-md">
                    <span className="text-sm text-muted-foreground">
                        {selectedItems.size} selected
                    </span>
                    {bulkActions.map((action, idx) => (
                        <Button
                            key={idx}
                            variant={action.variant || 'outline'}
                            size="sm"
                            onClick={() => {
                                const selected = data.filter((item) => selectedItems.has(item.id));
                                action.onClick(selected);
                            }}
                        >
                            {action.icon}
                            <span className="ml-2">{action.label}</span>
                        </Button>
                    ))}
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
                                        checked={isAllSelected}
                                        indeterminate={isIndeterminate}
                                        onCheckedChange={handleSelectAll}
                                        aria-label="Select all"
                                    />
                                </TableHead>
                            )}
                            {columns.map((column) => (
                                <TableHead
                                    key={String(column.key)}
                                    className={cn(
                                        column.width,
                                        column.sortable !== false && sortable ? "cursor-pointer select-none" : ""
                                    )}
                                    onClick={() => column.sortable !== false && handleSort(column.key)}
                                >
                                    <div className="flex items-center">
                                        {column.header}
                                        {column.sortable !== false && sortable && renderSortIcon(column.key)}
                                    </div>
                                </TableHead>
                            ))}
                            {actions.length > 0 && (
                                <TableHead className="w-[80px]">Actions</TableHead>
                            )}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    {emptyMessage}
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((item) => (
                                <TableRow
                                    key={item.id}
                                    className={cn(
                                        "cursor-pointer",
                                        selectedItems.has(item.id) && "bg-muted/50",
                                        onRowClick && "hover:bg-muted/50"
                                    )}
                                    onClick={() => onRowClick?.(item)}
                                >
                                    {selectable && (
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedItems.has(item.id)}
                                                onCheckedChange={(checked) =>
                                                    handleSelectItem(item.id, Boolean(checked))
                                                }
                                                aria-label={`Select row`}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </TableCell>
                                    )}
                                    {columns.map((column) => (
                                        <TableCell key={String(column.key)}>
                                            {column.render
                                                ? column.render(item[column.key], item)
                                                : item[column.key] != null
                                                    ? String(item[column.key])
                                                    : ''
                                            }
                                        </TableCell>
                                    ))}
                                    {actions.length > 0 && (
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Open menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    {actions.map((action, actionIdx) => (
                                                        <DropdownMenuItem
                                                            key={actionIdx}
                                                            onClick={() => action.onClick(item)}
                                                            disabled={action.disabled?.(item)}
                                                            className={action.variant === 'destructive' ? 'text-destructive' : ''}
                                                        >
                                                            {action.icon}
                                                            <span className="ml-2">{action.label}</span>
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {pagination && sortedData.length > 0 && (
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium">Items per page</p>
                        <Select
                            value={String(itemsPerPage)}
                            onValueChange={(value) => {
                                setItemsPerPage(Number(value));
                                setCurrentPage(1);
                            }}
                        >
                            <SelectTrigger className="w-[70px]">
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
                    </div>

                    <div className="flex items-center space-x-2">
                        <p className="text-sm text-muted-foreground">
                            Showing {((currentPage - 1) * itemsPerPage) + 1} to{' '}
                            {Math.min(currentPage * itemsPerPage, sortedData.length)} of{' '}
                            {sortedData.length} results
                        </p>

                        <div className="flex items-center space-x-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage <= 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>

                            <span className="text-sm font-medium px-2">
                                Page {currentPage} of {totalPages}
                            </span>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage >= totalPages}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}