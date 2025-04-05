// src/bun-backend/routes/employees.ts
import { Elysia, t } from "elysia"; // Import t for validation
import { getAllEmployees, getEmployeeById, createEmployee, updateEmployee, deleteEmployee } from "../services/employeesService"; // Import service functions
import { EmployeeGroup } from "../db/schema"; // Import EmployeeGroup enum

// Define validation schema for query parameters
const getEmployeesQuerySchema = t.Object({
    status: t.Optional(t.Union([
        t.Literal('active'),
        t.Literal('inactive'),
        t.Literal('all')
    ])), // Allow specific strings or undefined
    group: t.Optional(t.Union([
        t.Enum(EmployeeGroup), // Use EmployeeGroup enum directly
        t.Literal('all')
    ]))
});

// Define validation schema for path parameters
const employeeIdParamSchema = t.Object({
    id: t.Numeric() // Ensure id is a number
});

// Define validation schema for POST body
const createEmployeeBodySchema = t.Object({
    employee_id: t.String({ minLength: 1, error: "Employee ID is required." }),
    first_name: t.String({ minLength: 1, error: "First name is required." }),
    last_name: t.String({ minLength: 1, error: "Last name is required." }),
    employee_group: t.Enum(EmployeeGroup, { error: "Invalid employee group." }),
    contracted_hours: t.Numeric({ minimum: 0, error: "Contracted hours must be a non-negative number." }),
    is_keyholder: t.Optional(t.Boolean()),
    is_active: t.Optional(t.Boolean()),
    birthday: t.Optional(t.Nullable(t.String({ format: 'date', error: "Birthday must be in YYYY-MM-DD format." }))),
    email: t.Optional(t.Nullable(t.String({ format: 'email', error: "Invalid email format." }))),
    phone: t.Optional(t.Nullable(t.String()))
});

// Define validation schema for PUT body (all optional)
const updateEmployeeBodySchema = t.Partial(t.Object({
    employee_id: t.String({ minLength: 1, error: "Employee ID cannot be empty if provided." }),
    first_name: t.String({ minLength: 1, error: "First name cannot be empty if provided." }),
    last_name: t.String({ minLength: 1, error: "Last name cannot be empty if provided." }),
    employee_group: t.Enum(EmployeeGroup, { error: "Invalid employee group." }),
    contracted_hours: t.Numeric({ minimum: 0, error: "Contracted hours must be non-negative." }),
    is_keyholder: t.Boolean(),
    is_active: t.Boolean(),
    birthday: t.Nullable(t.String({ format: 'date', error: "Birthday must be YYYY-MM-DD." })),
    email: t.Nullable(t.String({ format: 'email', error: "Invalid email format." })),
    phone: t.Nullable(t.String())
}), { // Partial makes all properties optional
    // Additional validation if needed, e.g., ensure at least one field is present?
});

// Define routes related to employees
const employeeRoutes = new Elysia({ prefix: "/api/employees" }) // Set base path
  // GET /api/employees with query param validation
  .get("/", async ({ query, set }) => { // Destructure query object
    try {
      // Validate query params (Elysia handles this automatically if schema is provided)
      const employees = await getAllEmployees(query); // Pass validated query params to service
      return employees; // Elysia automatically handles JSON serialization
    } catch (error) {
      console.error("Error in GET /api/employees:", error);
      set.status = 500; // Set response status code
      return { error: "Failed to retrieve employees" }; // Return error object
    }
  }, {
    query: getEmployeesQuerySchema // Apply validation schema
  })
  // GET /api/employees/:id with path param validation
  .get("/:id", async ({ params, set }) => {
    try {
      const employee = await getEmployeeById(params.id);
      if (employee) {
        return employee;
      } else {
        set.status = 404;
        return { error: `Employee with id ${params.id} not found` };
      }
    } catch (error) {
      console.error(`Error in GET /api/employees/${params.id}:`, error);
      set.status = 500;
      return { error: "Failed to retrieve employee" };
    }
  }, {
      params: employeeIdParamSchema // Apply validation schema
  })
  // POST /api/employees
  .post("/", async ({ body, set }) => {
    try {
      // Body is automatically validated by Elysia based on the schema
      const newEmployee = await createEmployee(body);
      set.status = 201; // Created
      return newEmployee;
    } catch (error: any) {
      console.error("Error in POST /api/employees:", error);
      // Check for specific errors from the service
      if (error.message?.includes('already exists') || error.message?.includes('is already in use')) {
           set.status = 409; // Conflict
           return { error: error.message };
      } else if (error.message?.includes('Missing required fields')) {
          set.status = 400; // Bad Request
          return { error: error.message };
      }
      // Generic server error
      set.status = 500;
      return { error: "Failed to create employee" };
    }
  }, {
      body: createEmployeeBodySchema // Apply validation schema to request body
  })
  // PUT /api/employees/:id
  .put("/:id", async ({ params, body, set }) => {
    try {
        // Body and params are automatically validated by Elysia
        const updatedEmployee = await updateEmployee(params.id, body);
        if (updatedEmployee) {
            return updatedEmployee;
        } else {
            // This case is less likely now updateEmployee throws if ID not found
            set.status = 404;
            return { error: `Employee with id ${params.id} not found` };
        }
    } catch (error: any) {
        console.error(`Error in PUT /api/employees/${params.id}:`, error);
        // Handle specific errors from the service
        if (error.message?.includes('not found for update')) {
            set.status = 404;
            return { error: error.message };
        } else if (error.message?.includes('already exists') || error.message?.includes('is already in use')) {
             set.status = 409; // Conflict
             return { error: error.message };
        }
        // Generic server error
        set.status = 500;
        return { error: "Failed to update employee" };
    }
  }, {
      params: employeeIdParamSchema, // Validate path parameter
      body: updateEmployeeBodySchema   // Validate request body
  })
  // DELETE /api/employees/:id
  .delete("/:id", async ({ params, set }) => {
    try {
        // Param is automatically validated by Elysia
        const deleted = await deleteEmployee(params.id);
        if (deleted) {
            set.status = 204; // No Content
            return; // Return nothing on successful deletion
        } else {
            set.status = 404;
            return { error: `Employee with id ${params.id} not found` };
        }
    } catch (error: any) {
        console.error(`Error in DELETE /api/employees/${params.id}:`, error);
        // Generic server error
        set.status = 500;
        return { error: "Failed to delete employee" };
    }
  }, {
      params: employeeIdParamSchema // Apply validation schema
  });

export default employeeRoutes; // Export the routes module 