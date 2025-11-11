import { ReactNode } from "react";

export type SortDirection = "asc" | "desc";

export interface SortConfig<T> {
  key: keyof T;
  direction: SortDirection;
}

export interface FilterConfig {
  [key: string]: string | number | boolean | null;
}

export interface PaginationConfig {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
}

export interface ColumnDefinition<T> {
  key: keyof T;
  header: string;
  width?: string;
  sortable?: boolean;
  filterable?: boolean;
  searchable?: boolean;
  render?: (value: T[keyof T], item: T) => ReactNode;
  type?: "text" | "number" | "boolean" | "date" | "enum" | "badges" | "actions";
  enumOptions?: {
    value: string | number | boolean;
    label: string;
    variant?: string;
  }[];
}

export interface TableAction<T> {
  icon: ReactNode;
  label: string;
  onClick: (item: T) => void;
  variant?: "default" | "ghost" | "destructive" | "outline";
  disabled?: (item: T) => boolean;
}

export interface FilterDefinition {
  key: string;
  label: string;
  type: "select" | "boolean" | "search";
  options?: { value: string | boolean; label: string }[];
  placeholder?: string;
}

export interface DataTableProps<T extends { id: number | string }> {
  data: T[];
  columns: ColumnDefinition<T>[];
  actions?: TableAction<T>[];
  loading?: boolean;
  error?: string | null;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  sortable?: boolean;
  initialSort?: SortConfig<T>;
  filterable?: boolean;
  filters?: FilterDefinition[];
  selectable?: boolean;
  onSelectionChange?: (selectedItems: T[]) => void;
  bulkActions?: TableAction<T[]>[];
  pagination?: boolean;
  itemsPerPageOptions?: number[];
  defaultItemsPerPage?: number;
  className?: string;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
}