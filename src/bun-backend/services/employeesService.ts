// import globalDb from "../db"; // REMOVED - Ensure tests cannot accidentally use this
import { Database } from "bun:sqlite"; // Import Database type
import { Employee, EmployeeGroup } from "../db/schema"; // Import the Employee interface and Enum
import { SQLQueryBindings } from "bun:sqlite"; // Import type for bindings
import { NotFoundError } from "elysia";

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
    can_be_keyholder: row.can_be_keyholder === 1, // Added mapping
    is_active: row.is_active === 1,
    birthday: typeof row.birthday === 'string' ? row.birthday : null,
    email: typeof row.email === 'string' ? row.email : null,
    phone: typeof row.phone === 'string' ? row.phone : null,
    address: typeof row.address === 'string' ? row.address : null, // Added mapping
    hire_date: typeof row.hire_date === 'string' ? row.hire_date : null, // Added mapping
    notes: typeof row.notes === 'string' ? row.notes : null, // Added mapping
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : '',
  };

  // Add more robust validation/error handling as needed

  return employee;
}

// Define filter types based on API documentation (status isn't explicitly in schema, using is_active)
export interface EmployeeFilters {
    status?: 'active' | 'inactive' | 'all';
    group?: EmployeeGroup | 'all';
}

// Updated function to handle filters
export async function getAllEmployees(
    filters: EmployeeFilters = {},
    db: Database
): Promise<Employee[]> {
    // REMOVED: Suspicious delay
    // await new Promise(resolve => setTimeout(resolve, 10)); 
    
    try {
        let baseSql = "SELECT * FROM employees";
        const conditions: string[] = [];
        const params: SQLQueryBindings[] = []; 

        // Apply status filter (maps to is_active boolean/integer)
        if (filters.status && filters.status !== 'all') {
            conditions.push("is_active = ?");
            params.push(filters.status === 'active' ? 1 : 0); 
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

        console.log(`[getAllEmployees] Using DB file: ${db.filename}`);
        console.log(`Fetching employees with query: ${baseSql} and params: ${JSON.stringify(params)}`);

        // Prepare and execute the SQL query
        const query = db.query(baseSql);
        const rows = query.all(...params) as any[]; 

        console.log(`Found ${rows.length} employees matching filters.`);

        // Map database rows to Employee objects
        const employees = rows.map(mapRowToEmployee);

        return employees;
    } catch (error) {
        console.error("Error fetching employees:", error);
        throw new Error("Failed to retrieve employees from database.");
    }
}

// Add getEmployeeById function
export async function getEmployeeById(
    id: number,
    db: Database
): Promise<Employee | null> {
    try {
        // Ensure the db object is valid before querying
        if (!db) {
            console.error("getEmployeeById received an invalid database instance!");
            throw new Error("Invalid database instance provided.");
        }
        console.log(`[getEmployeeById] Using DB file for id ${id}: ${db.filename}`);
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
    is_keyholder?: boolean; // Changed from can_be_keyholder to match the UI form
    is_active?: boolean;    // Optional, defaults to true in DB
    birthday?: string | null;
    email?: string | null;
    phone?: string | null;
    // Added missing fields based on usage in the function
    notes?: string | null;
    hire_date?: string;
    address?: string | null;
}

export async function createEmployee(
    data: CreateEmployeeInput,
    db: Database
): Promise<Employee> {
    // Validate required fields explicitly (though route validation should also cover this)
    if (!data.employee_id || !data.first_name || !data.last_name || !data.employee_group || data.contracted_hours === undefined) {
        throw new Error("Missing required fields for creating employee.");
    }

    const sql = `
        INSERT INTO employees (
            employee_id, first_name, last_name, employee_group, contracted_hours,
            is_keyholder, can_be_keyholder, is_active, birthday, email, phone, hire_date, address, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    // Set defaults for optional boolean fields if not provided
    const isKeyholder = data.is_keyholder === true ? 1 : 0; // Use is_keyholder (from form) directly
    const canBeKeyholder = data.is_keyholder === true ? 1 : 0; // Duplicate setting for schema compatibility
    const isActive = data.is_active !== false ? 1 : 0; // Default to active (1) if undefined or true

    const params: SQLQueryBindings[] = [
        data.employee_id,
        data.first_name,
        data.last_name,
        data.employee_group,
        data.contracted_hours,
        isKeyholder,
        canBeKeyholder, // Add this parameter for the new column
        isActive,
        data.birthday ?? null,
        data.email ?? null,
        data.phone ?? null,
        data.hire_date ?? null,
        data.address ?? null,
        data.notes ?? null
    ];

    try {
        console.log(`[createEmployee] Using DB file: ${db.filename}`);
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

        console.log(`[createEmployee] Fetching newly created employee with ID: ${lastId} using DB file: ${db.filename}`);
        // Fetch and return the newly created employee
        const newEmployee = await getEmployeeById(Number(lastId), db);
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

export async function updateEmployee(
    id: number,
    data: UpdateEmployeeInput,
    db: Database
): Promise<Employee> {
    // Check if employee exists *before* attempting update
    const existingEmployee = await getEmployeeById(id, db);
    if (!existingEmployee) {
        throw new NotFoundError(`Employee with ID ${id} not found for update.`);
    }

    const updates: Record<string, any> = {};

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

            updates[columnName] = paramValue;
        }
    }

    if (Object.keys(updates).length === 0) {
        return existingEmployee; // Return existing if no valid updates
    }

    updates.updated_at = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

    const sql = `UPDATE employees SET ${Object.keys(updates).map(key => `${key} = ?`).join(', ')} WHERE id = ?;`;

    try {
        console.log(`[updateEmployee] Using DB file for id ${id}: ${db.filename}`);
        const stmt = db.prepare(sql);
        const info = await Promise.resolve(stmt.run(...Object.values(updates), id));

        console.log(`[updateEmployee] Re-fetching employee ${id} using DB file: ${db.filename}`);
        // Re-fetch the updated employee to return the latest state
        const updatedEmployee = await getEmployeeById(id, db);
         if (!updatedEmployee) { 
             // Should not happen if initial check passed and update didn't error
             throw new Error("Failed to fetch employee after update.");
         }
         return updatedEmployee;

    } catch (error) {
        console.error(`Error updating employee ${id}:`, error);
        // Don't re-throw NotFoundError here, already checked.
        // Throw generic error for SQL issues.
        throw new Error(`Failed to update employee in database: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function deleteEmployee(
    id: number,
    db: Database
): Promise<{ success: boolean }> { // Keep return type consistent for now
    // Ensure employee exists before trying to delete
    const existingEmployee = await getEmployeeById(id, db);
    if (!existingEmployee) {
        throw new NotFoundError(`Employee with ID ${id} not found for deletion.`);
    }

    const sql = "DELETE FROM employees WHERE id = ?;";
    try {
        console.log(`[deleteEmployee] Using DB file for id ${id}: ${db.filename}`);
        const stmt = db.prepare(sql);
        const info = await Promise.resolve(stmt.run(id));
        
        if (info.changes === 0) {
             // Should not happen if initial check passed
             console.warn(`Delete operation for employee ${id} affected 0 rows.`);
              throw new Error(`Delete failed unexpectedly for employee ${id}.`);
        }
        console.log(`Employee ${id} deleted successfully.`);
        return { success: true };
    } catch (error) {
        console.error(`Error deleting employee ${id}:`, error);
         // Don't re-throw NotFoundError
        throw new Error(`Failed to delete employee: ${error instanceof Error ? error.message : String(error)}`);
    }
} 