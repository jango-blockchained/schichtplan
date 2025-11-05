import React, { useMemo, useState, useCallback } from 'react';
import { FrappeDataTable } from './FrappeDataTable';
import { FrappeColumn } from './types';
import {
  Button,
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
import { ChevronLeft, ChevronRight, MoreHorizontal, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

// Import types from the copied data-table types
import type { DataTableProps } from './data-table-types';

/**
 * DataTableAdapter: A compatibility layer that provides the same interface as the old DataTable
 * but uses Frappe DataTable underneath
 */
export function DataTableAdapter<T extends { id: number | string }>({
  data,
  columns,
  actions = [],
  loading = false,
  error = null,
  searchable = true,
  searchPlaceholder = 'Search...',
  searchKeys,
  sortable = true,
  filterable = false,
  filters = [],
  selectable = false,
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
  const [selectedRows] = useState<Set<T['id']>>(new Set());

  // Convert columns to Frappe format
  const frappeColumns: FrappeColumn[] = useMemo(() => {
    const cols: FrappeColumn[] = [];

    // Add checkbox column if selectable
    if (selectable) {
      cols.push({
        name: 'Select',
        id: '_checkbox',
        width: 50,
        editable: false,
        sortable: false,
      });
    }

    // Convert each column
    columns.forEach((col) => {
      const key = String(col.key);
      cols.push({
        name: col.header,
        id: key,
        width: col.width ? parseInt(col.width) : undefined,
        editable: false,
        sortable: col.sortable !== false && sortable,
        align: col.type === 'number' ? 'right' : 'left',
        format: (value, row) => {
          if (col.render) {
            // Convert React node to string representation
            const rendered = col.render(value as T[keyof T], row as T);
            if (typeof rendered === 'string') return rendered;
            if (typeof rendered === 'number') return String(rendered);
            // For complex React elements, return a simplified string
            return value != null ? String(value) : '';
          }
          return value != null ? String(value) : '';
        },
      });
    });

    // Add actions column if there are actions
    if (actions.length > 0) {
      cols.push({
        name: 'Actions',
        id: '_actions',
        width: 80,
        editable: false,
        sortable: false,
        align: 'center',
      });
    }

    return cols;
  }, [columns, actions, selectable, sortable]);

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

    return result;
  }, [data, searchTerm, searchable, searchKeys, columns]);

  // Convert data to Frappe format (array of arrays)
  // NOTE: Using Unicode characters for checkboxes and placeholders for actions
  // This is a limitation of Frappe DataTable which doesn't support React components.
  // For better checkbox/action UX, consider using native HTML tables.
  const frappeData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = pagination ? filteredData.slice(start, end) : filteredData;

    return pageData.map((item) => {
      const row: any[] = [];

      // Add checkbox placeholder (not interactive in Frappe table)
      if (selectable) {
        row.push(selectedRows.has(item.id) ? '☑' : '☐');
      }

      // Add data for each column
      columns.forEach((col) => {
        const value = item[col.key];
        if (col.render) {
          const rendered = col.render(value, item);
          row.push(typeof rendered === 'string' ? rendered : value != null ? String(value) : '');
        } else {
          row.push(value != null ? String(value) : '');
        }
      });

      // Add empty cell for actions column (actions rendered via overlay)
      if (actions.length > 0) {
        row.push(''); // Empty string instead of placeholder
      }

      return row;
    });
  }, [filteredData, currentPage, itemsPerPage, pagination, columns, actions, selectable, selectedRows]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  // Render custom actions overlay (since Frappe doesn't support React components directly)
  // NOTE: This is a workaround using absolute positioning. For production use, consider:
  // 1. Using Frappe's built-in column actions
  // 2. Implementing a more robust overlay system
  // 3. Or keep using native HTML tables for complex action requirements
  const renderActionsOverlay = useCallback(() => {
    if (actions.length === 0) return null;

    return (
      <div className="absolute inset-0 pointer-events-none">
        {filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((item, idx) => (
          <div
            key={item.id}
            className="pointer-events-auto"
            style={{
              position: 'absolute',
              right: '10px',
              // TODO: Calculate this dynamically based on actual row height
              top: `${(idx + 1) * 40 + 50}px`,
              zIndex: 10,
            }}
          >
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
                  >
                    {action.icon}
                    <span className="ml-2">{action.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
    );
  }, [actions, filteredData, currentPage, itemsPerPage]);

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
        <div className="flex items-center gap-4">
          {searchable && (
            <div className="relative flex-1">
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
          {/* Filters would go here if needed */}
        </div>
      )}

      {/* Bulk actions */}
      {selectable && selectedRows.size > 0 && bulkActions.length > 0 && (
        <div className="flex items-center gap-2 p-4 bg-muted rounded-md">
          <span className="text-sm text-muted-foreground">
            {selectedRows.size} selected
          </span>
          {bulkActions.map((action, idx) => (
            <Button
              key={idx}
              variant={action.variant || 'outline'}
              size="sm"
              onClick={() => {
                const selected = data.filter((item) => selectedRows.has(item.id));
                action.onClick(selected);
              }}
            >
              {action.icon}
              <span className="ml-2">{action.label}</span>
            </Button>
          ))}
        </div>
      )}

      {/* Frappe DataTable */}
      <div className="relative">
        {frappeData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border rounded-md">
            {emptyMessage}
          </div>
        ) : (
          <>
            <FrappeDataTable
              columns={frappeColumns}
              data={frappeData}
              checkboxColumn={false}
              serialNoColumn={true}
              layout="fluid"
              noDataMessage={emptyMessage}
              className="rounded-md"
            />
            {renderActionsOverlay()}
          </>
        )}
      </div>

      {/* Pagination */}
      {pagination && filteredData.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredData.length)} to{' '}
              {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={String(itemsPerPage)}
              onValueChange={(value) => {
                setItemsPerPage(Number(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {itemsPerPageOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm px-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
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

export default DataTableAdapter;
