// TypeScript types for Frappe DataTable
export interface FrappeColumn {
  name: string;
  id?: string;
  content?: string;
  width?: number;
  editable?: boolean;
  resizable?: boolean;
  sortable?: boolean;
  focusable?: boolean;
  dropdown?: boolean;
  format?: (value: any, row: any, column: FrappeColumn, data: any) => string | HTMLElement;
  align?: 'left' | 'center' | 'right';
}

export interface FrappeDataTableOptions {
  columns: FrappeColumn[];
  data: any[][];
  serialNoColumn?: boolean;
  checkboxColumn?: boolean;
  clusterize?: boolean;
  layout?: 'fixed' | 'fluid' | 'ratio';
  noDataMessage?: string;
  dynamicRowHeight?: boolean;
  inlineFilters?: boolean;
  treeView?: boolean;
  checkedRowStatus?: boolean;
  events?: {
    onRemoveColumn?: (column: FrappeColumn) => void;
    onSwitchColumn?: (oldIndex: number, newIndex: number) => void;
    onSortColumn?: (colIndex: number, sortOrder: 'asc' | 'desc' | 'none') => void;
    onCheckRow?: (row: any) => void;
  };
}

export interface FrappeDataTableInstance {
  refresh: (data?: any[][], columns?: FrappeColumn[]) => void;
  destroy: () => void;
  wrapper: HTMLElement;
  style: any;
  datamanager: any;
  rowmanager: any;
  columnmanager: any;
}
