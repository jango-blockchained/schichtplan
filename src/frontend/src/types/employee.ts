// Employee role types
export type EmployeeRole = 'EMPLOYEE' | 'MANAGER' | 'ADMIN';

// Employee type definition
export interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role: EmployeeRole;
  department_id?: number;
  position_id?: number;
  is_active: boolean;
  weekly_hours?: number;
  max_consecutive_days?: number;
  min_rest_hours?: number;
}

// Department type definition
export interface Department {
  id: number;
  name: string;
  description?: string;
}

// Position type definition
export interface Position {
  id: number;
  name: string;
  description?: string;
  department_id?: number;
} 