import { FilterConfig, PaginationConfig, SortConfig } from "./types";

export function sortData<T>(
  data: T[], 
  sortConfig: SortConfig<T> | null
): T[] {
  if (!sortConfig) return data;

  return [...data].sort((a, b) => {
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];

    // Handle null/undefined values
    if (aValue === null || aValue === undefined) {
      if (bValue === null || bValue === undefined) return 0;
      return 1;
    }
    if (bValue === null || bValue === undefined) return -1;

    const direction = sortConfig.direction === "asc" ? 1 : -1;

    // Handle different types
    if (typeof aValue === "boolean" && typeof bValue === "boolean") {
      return (aValue === bValue ? 0 : aValue ? -1 : 1) * direction;
    }

    if (typeof aValue === "number" && typeof bValue === "number") {
      return (aValue - bValue) * direction;
    }

    // Default to string comparison
    return String(aValue).localeCompare(String(bValue)) * direction;
  });
}

export function filterData<T>(
  data: T[], 
  filterConfig: FilterConfig,
  searchKeys?: (keyof T)[]
): T[] {
  return data.filter((item) => {
    // Handle search filter
    if (filterConfig.search && searchKeys) {
      const searchTerm = String(filterConfig.search).toLowerCase();
      const matchesSearch = searchKeys.some((key) => {
        const value = item[key];
        return value && String(value).toLowerCase().includes(searchTerm);
      });
      if (!matchesSearch) return false;
    }

    // Handle other filters
    return Object.entries(filterConfig).every(([key, filterValue]) => {
      if (key === "search" || filterValue === null || filterValue === undefined || filterValue === "") {
        return true;
      }

      const itemValue = item[key as keyof T];
      
      if (typeof filterValue === "boolean") {
        return itemValue === filterValue;
      }
      
      return itemValue === filterValue;
    });
  });
}

export function paginateData<T>(
  data: T[], 
  pagination: PaginationConfig
): { paginatedData: T[]; totalPages: number } {
  const totalPages = Math.ceil(data.length / pagination.itemsPerPage);
  const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
  const endIndex = startIndex + pagination.itemsPerPage;
  
  return {
    paginatedData: data.slice(startIndex, endIndex),
    totalPages
  };
}

export function getDefaultSort<T>(columns: { key: keyof T; sortable?: boolean }[]): SortConfig<T> | null {
  const firstSortableColumn = columns.find(col => col.sortable !== false);
  if (!firstSortableColumn) return null;
  
  return {
    key: firstSortableColumn.key,
    direction: "asc"
  };
}
