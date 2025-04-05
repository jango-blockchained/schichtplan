import db from "../db"; // Import the initialized DB connection
import { Employee, EmployeeGroup } from "../db/schema"; // Import the Employee interface and Enum

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


export async function getAllEmployees(): Promise<Employee[]> {
  try {
    console.log("Fetching all employees from the database...");
    // Prepare the SQL query
    const query = db.query("SELECT * FROM employees ORDER BY last_name, first_name;");
    // Execute and get all results
    const rows = query.all() as any[]; // Use 'as any[]' for now, refine later if possible

    console.log(`Found ${rows.length} employees.`);

    // Map database rows to Employee objects
    const employees = rows.map(mapRowToEmployee);

    return employees;
  } catch (error) {
    console.error("Error fetching employees:", error);
    // Re-throw or handle error appropriately for the API layer
    throw new Error("Failed to retrieve employees from database.");
  }
}

// Add other functions later (getEmployeeById, createEmployee, updateEmployee, deleteEmployee) 