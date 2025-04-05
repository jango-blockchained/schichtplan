// src/bun-backend/index.ts
import { Elysia } from "elysia";
// Import ErrorHandler type if needed for specific handlers, but let inference work for global onError
import type { Context } from "elysia"; 
import { cors } from '@elysiajs/cors'; // Import CORS plugin
// Use correct import types based on how routes are exported
import employeeRoutes from './routes/employees'; // Default import
import { settingsRoutes } from './routes/settings'; // Named import
import scheduleRoutes from './routes/schedules'; // Default import
import { shiftTemplateRoutes } from './routes/shiftTemplates'; // Named import

// Define the port, defaulting to 5001 to avoid conflict with Flask's 5000 if run concurrently
const PORT = process.env.PORT || 5001;

console.log("Initializing Elysia application...");

// Define the onError handler - let Elysia infer types for parameters
const globalErrorHandler = ({ code, error, set }) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  console.error(`Error [${code}]: ${errorMessage}`);
  if (process.env.NODE_ENV !== 'production' && stack) {
      console.error(stack);
  }

  // Handle specific known error types (like NotFoundError)
  if (code === 'NOT_FOUND') {
      set.status = 404;
      return { error: `Not Found: ${errorMessage || 'Resource not found.'}` };
  }
  // Handle validation errors specifically if using a plugin like @elysiajs/bearer or body validation
  if (code === 'VALIDATION') {
      set.status = 400; // Bad Request
      return { error: `Validation Error: ${errorMessage}`, details: (error as any).all };
  }

  // Default Internal Server Error
  set.status = 500;
  return { error: `Internal Server Error: ${code}` };
};

const app = new Elysia()
  .use(cors()) // Enable CORS for frontend interaction
  .get("/", () => ({ status: "Bun backend running" })) // Simple health check route
  // --- Mount Routes using the correct variable names ---
  .use(employeeRoutes)
  .use(settingsRoutes)
  .use(scheduleRoutes)
  .use(shiftTemplateRoutes)
  .onError(globalErrorHandler) // Use the error handler (types inferred)
  .listen(PORT);

console.log(
  `🦊 Schichtplan Bun backend is running at http://${app.server?.hostname}:${app.server?.port}`
);

export default app; // Export for potential testing or programmatic use 