// src/bun-backend/routes/employees.ts
import { Elysia, t } from "elysia"; // Import t for validation
import { getDb } from "../db"; // Import getDb
import { Database } from "bun:sqlite"; // Import Database type
import { getAllEmployees, getEmployeeById, createEmployee, updateEmployee, deleteEmployee } from "../services/employeesService"; // Import service functions
import { EmployeeGroup } from "../db/schema"; // Import EmployeeGroup enum
import { NotFoundError } from "elysia"; // Import NotFoundError

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
  // GET /api/employees
  .get("/", async ({ query, set, ...ctx }) => { // Add context
    const context = ctx as { db?: Database };
    const currentDb = context.db ?? getDb();
    try {
      const employees = await getAllEmployees(query, currentDb); // Pass db
      return employees; 
    } catch (error) {
      console.error("Error in GET /api/employees:", error);
      set.status = 500; 
      return { error: "Failed to retrieve employees" }; 
    }
  }, {
    query: getEmployeesQuerySchema 
  })
  // GET /api/employees/:id
  .get("/:id", async ({ params, set, ...ctx }) => { // Add context
    const context = ctx as { db?: Database };
    const currentDb = context.db ?? getDb();
    try {
      const employee = await getEmployeeById(params.id, currentDb); // Pass db
      if (employee) {
        return employee;
      } else {
        set.status = 404;
        return { error: `Employee with id ${params.id} not found` };
      }
    } catch (error: any) {
        console.error(`Error in GET /api/employees/${params.id}:`, error);
        // Let global handler manage status based on error type if possible
        if (error instanceof NotFoundError) {
            set.status = 404;
            return { error: error.message };
        }
        set.status = 500;
        return { error: "Failed to retrieve employee" };
    }
  }, {
      params: employeeIdParamSchema 
  })
  // POST /api/employees
  .post("/", async ({ body, set, ...ctx }) => { // Add context
    const context = ctx as { db?: Database };
    const currentDb = context.db ?? getDb();
    try {
      const newEmployee = await createEmployee(body, currentDb); // Pass db
      set.status = 201; 
      return newEmployee;
    } catch (error: any) {
      console.error("Error in POST /api/employees:", error);
      if (error.message?.includes('already exists') || error.message?.includes('is already in use')) {
           set.status = 409; 
           return { error: error.message, details: error.message };
      } else if (error.message?.includes('Missing required fields')) {
          set.status = 400; 
          return { error: error.message, details: error.message };
      }
      set.status = 500;
      return { error: "Failed to create employee", details: error.message };
    }
  }, {
      body: createEmployeeBodySchema 
  })
  // PUT /api/employees/:id
  .put("/:id", async ({ params, body, set, ...ctx }) => { // Add context
    const context = ctx as { db?: Database };
    const currentDb = context.db ?? getDb();
    try {
        const updatedEmployee = await updateEmployee(params.id, body, currentDb); // Pass db
        return updatedEmployee; // Service now throws NotFoundError
    } catch (error: any) {
        console.error(`Error in PUT /api/employees/${params.id}:`, error);
        if (error instanceof NotFoundError) {
            set.status = 404;
            return { error: error.message, details: error.message };
        } else if (error.message?.includes('already exists') || error.message?.includes('is already in use')) {
             set.status = 409; 
             return { error: error.message, details: error.message };
        }
        set.status = 500;
        return { error: "Failed to update employee", details: error.message };
    }
  }, {
      params: employeeIdParamSchema, 
      body: updateEmployeeBodySchema   
  })
  // DELETE /api/employees/:id
  .delete("/:id", async ({ params, set, ...ctx }) => { // Add context
    const context = ctx as { db?: Database };
    const currentDb = context.db ?? getDb();
    try {
        await deleteEmployee(params.id, currentDb); // Pass db, service throws NotFoundError
        set.status = 204; 
        return; 
    } catch (error: any) {
        console.error(`Error in DELETE /api/employees/${params.id}:`, error);
        if (error instanceof NotFoundError) {
            set.status = 404;
            return { error: error.message, details: error.message };
        }
        set.status = 500;
        return { error: "Failed to delete employee", details: error.message };
    }
  }, {
      params: employeeIdParamSchema 
  });

export default employeeRoutes; // Export the routes module 