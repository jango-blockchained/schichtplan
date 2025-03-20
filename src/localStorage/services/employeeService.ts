import { Employee, EmployeeAvailability, EmployeeGroup } from '../models/types';
import { storages } from '../utils/storage';
import { generateId, addBaseFields, updateTimestamp, generateEmployeeId } from '../utils/helpers';

/**
 * Service for employee-related operations
 */
export const EmployeeService = {
    /**
     * Get all employees
     */
    getAll: (): Employee[] => {
        return storages.employees.getAll() as Employee[];
    },

    /**
     * Get employee by ID
     */
    getById: (id: number): Employee | null => {
        const employee = storages.employees.getById(id) as Employee | undefined;
        return employee || null;
    },

    /**
     * Create a new employee
     */
    create: (data: Omit<Employee, keyof Employee & 'id' | 'created_at' | 'updated_at' | 'employee_id'> & { employee_id?: string }): Employee => {
        // Generate employee ID if not provided
        const employeeId = data.employee_id || generateEmployeeId(data.first_name, data.last_name);

        // Create new employee with base fields
        const newEmployee = addBaseFields<Employee>({
            ...data,
            employee_id: employeeId
        });

        // Generate ID
        newEmployee.id = generateId<Employee>(storages.employees as any);

        // Save to storage
        return storages.employees.add(newEmployee) as Employee;
    },

    /**
     * Update an employee
     */
    update: (id: number, data: Partial<Employee>): Employee | null => {
        // Get existing employee
        const employee = storages.employees.getById(id) as Employee | undefined;
        if (!employee) {
            return null;
        }

        // Update with new data
        const updatedEmployee = {
            ...employee,
            ...data,
            updated_at: new Date().toISOString()
        };

        // Save to storage
        return storages.employees.update(id, updatedEmployee) as Employee;
    },

    /**
     * Delete an employee
     */
    delete: (id: number): boolean => {
        // Delete employee
        const deleted = storages.employees.delete(id);

        if (deleted) {
            // Delete related availabilities
            const availabilities = storages.availabilities.getAll() as EmployeeAvailability[];
            const filtered = availabilities.filter(a => a.employee_id !== id);
            storages.availabilities.saveAll(filtered);

            // Delete related schedules
            const schedules = storages.schedules.getAll();
            const filteredSchedules = schedules.filter((s: any) => s.employee_id !== id);
            storages.schedules.saveAll(filteredSchedules);

            // Delete related absences
            const absences = storages.absences.getAll();
            const filteredAbsences = absences.filter((a: any) => a.employee_id !== id);
            storages.absences.saveAll(filteredAbsences);
        }

        return deleted;
    },

    /**
     * Get all availabilities for an employee
     */
    getAvailabilities: (employeeId: number): EmployeeAvailability[] => {
        const allAvailabilities = storages.availabilities.getAll() as EmployeeAvailability[];
        return allAvailabilities.filter(a => a.employee_id === employeeId);
    },

    /**
     * Set availabilities for an employee
     */
    setAvailabilities: (employeeId: number, availabilities: Omit<EmployeeAvailability, 'id' | 'created_at' | 'updated_at' | 'employee_id'>[]): EmployeeAvailability[] => {
        // Delete existing availabilities
        const existing = storages.availabilities.getAll() as EmployeeAvailability[];
        const filtered = existing.filter(a => a.employee_id !== employeeId);

        // Create new availabilities
        const newAvailabilities: EmployeeAvailability[] = availabilities.map((a, index) => {
            const availability = addBaseFields<EmployeeAvailability>({
                ...a,
                employee_id: employeeId
            });

            // Generate ID (use max ID + index to ensure uniqueness)
            const maxId = existing.length > 0
                ? Math.max(...existing.map(item => item.id))
                : 0;
            availability.id = maxId + index + 1;

            return availability;
        });

        // Save all availabilities
        storages.availabilities.saveAll([...filtered, ...newAvailabilities]);

        return newAvailabilities;
    },

    /**
     * Validate employee data
     */
    validate: (data: Partial<Employee>): { valid: boolean; errors: string[] } => {
        const errors: string[] = [];

        // Check required fields
        if (!data.first_name) errors.push('First name is required');
        if (!data.last_name) errors.push('Last name is required');
        if (data.employee_group === undefined) errors.push('Employee group is required');
        if (data.contracted_hours === undefined) errors.push('Contracted hours is required');

        // Validate employee group
        if (data.employee_group !== undefined &&
            !Object.values(EmployeeGroup).includes(data.employee_group as EmployeeGroup)) {
            errors.push('Invalid employee group');
        }

        // Validate contracted hours
        if (data.contracted_hours !== undefined &&
            (data.contracted_hours < 0 || data.contracted_hours > 40)) {
            errors.push('Contracted hours must be between 0 and 40');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}; 