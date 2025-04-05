// src/bun-backend/index.ts
import { Elysia } from "elysia";
import type { ErrorHandler } from "elysia"; // Import ErrorHandler type
import { cors } from '@elysiajs/cors'; // Import CORS plugin
import employeeRoutes from './routes/employees'; // Import employee routes

// Define the port, defaulting to 5001 to avoid conflict with Flask's 5000 if run concurrently
const PORT = process.env.PORT || 5001;

console.log("Initializing Elysia application...");

// Define the onError handler with explicit types
const globalErrorHandler: ErrorHandler = ({ code, error, set }) => {
  console.error(`Error [${code}]: ${error.message}`);
  // Log stack trace for debugging if in development
  if (process.env.NODE_ENV !== 'production') {
      console.error(error.stack);
  }
  // Set response status code via 'set'
  set.status = 500; 
  return { error: `Internal Server Error: ${code}` }; // Return simple JSON object
};

const app = new Elysia()
  .use(cors()) // Enable CORS for frontend interaction
  .get("/", () => ({ status: "Bun backend running" })) // Simple health check route
  // --- Mount Routes ---
  .use(employeeRoutes) // Mount employee routes
  // .use(scheduleRoutes) // Example for future routes
  .onError(globalErrorHandler) // Use the typed handler
  .listen(PORT);

console.log(
  `🦊 Schichtplan Bun backend is running at http://${app.server?.hostname}:${app.server?.port}`
);

export default app; // Export for potential testing or programmatic use 