// src/bun-backend/routes/employees.ts
import { Elysia } from "elysia";
import { getAllEmployees } from "../services/employeesService"; // Import the service function

// Define routes related to employees
const employeeRoutes = new Elysia({ prefix: "/api/employees" }) // Set base path for these routes
  .get("/", async ({ set }) => { // Define GET handler for the base path ("/")
    try {
      const employees = await getAllEmployees();
      return employees; // Elysia automatically handles JSON serialization
    } catch (error) {
      console.error("Error in GET /api/employees:", error);
      set.status = 500; // Set response status code
      return { error: "Failed to retrieve employees" }; // Return error object
    }
  });
  // --- Add other employee routes later (GET by ID, POST, PUT, DELETE) ---
  // .get("/:id", async ({ params: { id }, set }) => { ... })
  // .post("/", async ({ body, set }) => { ... }) // Need input validation/typing here
  // .put("/:id", async ({ params: { id }, body, set }) => { ... })
  // .delete("/:id", async ({ params: { id }, set }) => { ... });

export default employeeRoutes; // Export the routes module 