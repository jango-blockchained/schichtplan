// API response types
export interface ApiResponse<T> {
  data: T;
  status: "success" | "error";
  message?: string;
}

// Pagination types
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// API error types
export interface ApiError {
  status: "error";
  message: string;
  errors?: Record<string, string[]>;
  code?: string;
}

// Generic query parameters
export interface QueryParams {
  page?: number;
  size?: number;
  sort?: string;
  order?: "asc" | "desc";
  search?: string;
  filter?: Record<string, string | number | boolean>;
}
