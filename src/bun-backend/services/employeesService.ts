import db from "../db"; // Import the initialized DB connection
import { Employee, EmployeeGroup } from "../db/schema"; // Import the Employee interface and Enum
import { SQLQueryBindings } from "bun:sqlite"; // Import type for bindings

// Function to map database row to Employee interface, handling potential type mismatches
function mapRowToEmployee(row: any): Employee {
  // Basic type checking and mapping
  const employee: Employee = {
    id: typeof row.id === 'number' ? row.id : -1, // Provide a default or throw error
    employee_id: typeof row.employee_id === 'string' ? row.employee_id : '',
    first_name: typeof row.first_name === 'string' ? row.first_name : '',
    last_name: typeof row.last_name === 'string' ? row.last_name : '',
    employee_group: Object.values(EmployeeGroup).includes(row.employee_group) ? row.employee_group : EmployeeGroup.TZ, // Default/fallback
    contracted_hours: typeof row.contracted_hours === 'number' ? row.contracted_hours : 0,
    // SQLite stores boolean as 0/1
    is_keyholder: row.is_keyholder === 1,
    is_active: row.is_active === 1,
    birthday: typeof row.birthday === 'string' ? row.birthday : null,
    email: typeof row.email === 'string' ? row.email : null,
    phone: typeof row.phone === 'string' ? row.phone : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : '',
  };

  // Add more robust validation/error handling as needed

  return employee;
}

// Define filter types based on API documentation (status isn't explicitly in schema, using is_active)
interface EmployeeFilters {
    status?: 'active' | 'inactive' | 'all';
    group?: EmployeeGroup | 'all';
}

// Updated function to handle filters
export async function getAllEmployees(filters: EmployeeFilters = {}): Promise<Employee[]> {
  try {
    let baseSql = "SELECT * FROM employees";
    const conditions: string[] = [];
    const params: SQLQueryBindings[] = []; // Use SQLQueryBindings type

    // Apply status filter (maps to is_active boolean/integer)
    if (filters.status && filters.status !== 'all') {
      conditions.push("is_active = ?");
      params.push(filters.status === 'active' ? 1 : 0); // Map to integer 1 or 0
    }

    // Apply group filter
    if (filters.group && filters.group !== 'all') {
        conditions.push("employee_group = ?");
        params.push(filters.group);
    }

    // Build the final query
    if (conditions.length > 0) {
      baseSql += " WHERE " + conditions.join(" AND ");
    }
    baseSql += " ORDER BY last_name, first_name;";

    console.log(`Fetching employees with query: ${baseSql} and params: ${JSON.stringify(params)}`);

    // Prepare and execute the SQL query
    const query = db.query(baseSql);
    const rows = query.all(...params) as any[]; // Pass params correctly

    console.log(`Found ${rows.length} employees matching filters.`);

    // Map database rows to Employee objects
    const employees = rows.map(mapRowToEmployee);

    return employees;
  } catch (error) {
    console.error("Error fetching employees:", error);
    // Re-throw or handle error appropriately for the API layer
    throw new Error("Failed to retrieve employees from database.");
  }
}

// Add getEmployeeById function
export async function getEmployeeById(id: number): Promise<Employee | null> {
    try {
        const query = db.query("SELECT * FROM employees WHERE id = ?;");
        const row = query.get(id) as any; // Use get for single result

        if (row) {
            return mapRowToEmployee(row);
        } else {
            return null; // Not found
        }
    } catch (error) {
        console.error(`Error fetching employee with id ${id}:`, error);
        throw new Error("Failed to retrieve employee from database.");
    }
}

// Interface for creating a new employee (omit generated fields)
export interface CreateEmployeeInput {
    employee_id: string;
    first_name: string;
    last_name: string;
    employee_group: EmployeeGroup;
    contracted_hours: number;
    is_keyholder?: boolean; // Optional, defaults to false in DB
    is_active?: boolean;    // Optional, defaults to true in DB
    birthday?: string | null;
    email?: string | null;
    phone?: string | null;
}

export async function createEmployee(data: CreateEmployeeInput): Promise<Employee> {
    // Validate required fields explicitly (though route validation should also cover this)
    if (!data.employee_id || !data.first_name || !data.last_name || !data.employee_group || data.contracted_hours === undefined) {
        throw new Error("Missing required fields for creating employee.");
    }

    const sql = `
        INSERT INTO employees (
            employee_id, first_name, last_name, employee_group, contracted_hours,
            is_keyholder, is_active, birthday, email, phone
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    // Set defaults for optional boolean fields if not provided
    const isKeyholder = data.is_keyholder === true ? 1 : 0;
    const isActive = data.is_active !== false ? 1 : 0; // Default to active (1) if undefined or true

    const params: SQLQueryBindings[] = [
        data.employee_id,
        data.first_name,
        data.last_name,
        data.employee_group,
        data.contracted_hours,
        isKeyholder,
        isActive,
        data.birthday ?? null,
        data.email ?? null,
        data.phone ?? null
    ];

    try {
        // Execute the insert query in a transaction
        db.transaction(() => {
            const insertQuery = db.query(sql);
            insertQuery.run(...params);
        })(); // Immediately invoke the transaction

        // Get the id of the newly inserted row using a separate query
        const idQuery = db.query("SELECT last_insert_rowid() as id;");
        const result = idQuery.get() as { id: number | bigint }; // Get the result
        const lastId = result?.id;

        if (lastId === undefined || lastId === null) {
            throw new Error("Failed to get last insert ID after creating employee.");
        }

        console.log(`Employee created with ID: ${lastId}`);

        // Fetch and return the newly created employee
        const newEmployee = await getEmployeeById(Number(lastId));
        if (!newEmployee) {
             // This should ideally not happen if insert succeeded
             throw new Error("Failed to retrieve newly created employee.");
        }
        return newEmployee;

    } catch (error: any) {
        console.error("Error creating employee:", error);

        // Handle specific SQLite errors (like UNIQUE constraint violation)
        if (error.message?.includes('UNIQUE constraint failed: employees.employee_id')) {
            throw new Error(`Employee ID '${data.employee_id}' already exists.`);
        }
        if (error.message?.includes('UNIQUE constraint failed: employees.email')) {
            throw new Error(`Email '${data.email}' is already in use.`);
        }

        // Re-throw generic error
        throw new Error("Failed to create employee in database.");
    }
}

// Interface for updating an employee (all fields optional)
export interface UpdateEmployeeInput {
    employee_id?: string;
    first_name?: string;
    last_name?: string;
    employee_group?: EmployeeGroup;
    contracted_hours?: number;
    is_keyholder?: boolean;
    is_active?: boolean;
    birthday?: string | null;
    email?: string | null;
    phone?: string | null;
}

export async function updateEmployee(id: number, data: UpdateEmployeeInput): Promise<Employee | null> {
    // Check if there is any data to update
    if (Object.keys(data).length === 0) {
        // If no data, just fetch and return the current employee
        console.log(`No update data provided for employee ${id}. Fetching current data.`);
        return getEmployeeById(id);
    }

    const fieldsToUpdate: string[] = [];
    const params: SQLQueryBindings[] = [];

    // Dynamically build the SET part of the query
    for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) { // Only include fields that are actually provided
            let columnName = key;
            let paramValue = value;

            // Handle boolean mapping to integer for DB
            if (key === 'is_keyholder' || key === 'is_active') {
                paramValue = value === true ? 1 : 0;
            }
            
            // Handle nullable fields specifically if needed (though SQLite handles ? with null)
            // SQLite comparison with NULL needs IS, not =. But SET works fine.

            fieldsToUpdate.push(`${columnName} = ?`);
            params.push(paramValue);
        }
    }

    // Always update the updated_at timestamp
    fieldsToUpdate.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");

    // Add the employee id to the parameters list for the WHERE clause
    params.push(id);

    const sql = `
        UPDATE employees
        SET ${fieldsToUpdate.join(', ')}
        WHERE id = ?;
    `;

    try {
        console.log(`Updating employee ${id} with query: ${sql.replace(/\s\s+/g, ' ')} and params: ${JSON.stringify(params)}`);
        const query = db.query(sql);
        const result = query.run(...params);

        // Check if any row was actually updated (SQLite doesn't directly return this easily via run)
        // We rely on fetching the employee again to confirm the update or if it existed.

        console.log(`Update executed for employee ${id}. Fetching updated record.`);
        // Fetch and return the updated employee
        const updatedEmployee = await getEmployeeById(id);
        if (!updatedEmployee) {
             // This implies the employee with the given ID didn't exist
             throw new Error(`Employee with ID ${id} not found for update.`);
        }
        return updatedEmployee;

    } catch (error: any) {
        console.error(`Error updating employee ${id}:`, error);

        // Handle specific SQLite errors (like UNIQUE constraint violation)
        if (error.message?.includes('UNIQUE constraint failed: employees.employee_id')) {
            throw new Error(`Employee ID '${data.employee_id}' already exists.`);
        }
        if (error.message?.includes('UNIQUE constraint failed: employees.email')) {
            throw new Error(`Email '${data.email}' is already in use.`);
        }

        // Re-throw generic error
        throw new Error("Failed to update employee in database.");
    }
}

export async function deleteEmployee(id: number): Promise<boolean> {
    // First, check if employee exists (optional, but good practice)
    const existing = await getEmployeeById(id);
    if (!existing) {
        console.log(`Employee with ID ${id} not found for deletion.`);
        return false; // Indicate employee not found
    }

    const sql = "DELETE FROM employees WHERE id = ?;";

    try {
        console.log(`Deleting employee ${id}...`);
        const query = db.query(sql);
        query.run(id);

        // Verify deletion (optional, could re-query or assume success if no error)
        // For simplicity, we assume success if run() doesn't throw.
        console.log(`Employee ${id} deleted successfully.`);
        return true; // Indicate successful deletion

    } catch (error: any) {
        console.error(`Error deleting employee ${id}:`, error);
        // Handle potential foreign key constraint errors if ON DELETE CASCADE/SET NULL wasn't used correctly
        // For now, re-throw a generic error
        throw new Error("Failed to delete employee from database.");
    }
}

// End of employee service functions 