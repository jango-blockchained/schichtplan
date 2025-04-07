// src/bun-backend/index.ts
import { Elysia, type Context, type ErrorHandler } from "elysia";
import { cors } from '@elysiajs/cors'; // Import CORS plugin
// Use correct import types based on how routes are exported
import employeeRoutes from './routes/employees'; // Default import
import { settingsRoutes } from './routes/settings'; // Named import
import scheduleRoutes from './routes/schedules'; // Default import
import { shiftTemplateRoutes } from './routes/shiftTemplates'; // Named import
// Import the new availability routes (assuming named exports)
import { employeeAvailabilityRoutes, availabilityRoutes } from './routes/employeeAvailability';
// Import the new absence routes (assuming named exports)
import { employeeAbsenceRoutes, absenceRoutes } from './routes/absences';
// Import the new coverage routes (assuming named export)
import { coverageRoutes } from './routes/coverage';
import { recurringCoverageRoutes } from './routes/recurringCoverage'; // Import recurring coverage routes
import { shiftPatternRoutes } from './routes/shiftPatternRoutes.js'; // Added import, using .js extension
import { swagger } from '@elysiajs/swagger';
// Removed incorrect import: import { globalErrorHandler } from './lib/errorHandler';

// Define the port, defaulting to 5001 to avoid conflict with Flask's 5000 if run concurrently
const PORT = process.env.PORT || 5001;

console.log("Initializing Elysia application...");

// Define the global error handler WITHOUT explicit ErrorHandler type
// Let Elysia infer the types when passed to .onError()
const globalErrorHandler = ({ code, error, set }: { code: unknown, error: any, set: Context['set'] }) => {
    // Safely access message and stack
    const errorMessage = typeof error?.message === 'string' ? error.message : 'Unknown error';
    const errorStack = typeof error?.stack === 'string' ? error.stack : undefined;

    console.error(`Error Code: ${code}, Message: ${errorMessage}`);
    if (process.env.NODE_ENV !== 'production' && errorStack) {
        console.error(errorStack);
    }

    switch (code) {
        case 'NOT_FOUND':
            set.status = 404;
            return { error: `Not Found: ${errorMessage}` };
        case 'VALIDATION':
            set.status = 400;
            // Attempt to get details from common Elysia validation error structures
            const details = error?.all ?? error?.validator?.Errors(error).First()?.message ?? errorMessage;
            return { error: `Validation Error`, details: details };
        case 'INTERNAL_SERVER_ERROR':
            set.status = 500;
            return { error: `Internal Server Error`, details: errorMessage };
        case 'PARSE':
             set.status = 400;
             return { error: `Request Parse Error`, details: errorMessage };
        // Add other specific Elysia codes as needed
        default:
            // Try to use status from the error if it exists
             if (typeof error?.status === 'number') {
                set.status = error.status;
            } else {
                 set.status = 500;
            }
            return { error: `An unexpected error occurred (${code})`, details: errorMessage };
    }
};

const app = new Elysia()
  .use(cors()) // Enable CORS for frontend interaction
  .use(swagger({ // Setup Swagger UI
      path: '/api-docs',
      documentation: {
          info: {
              title: 'Schichtplan API (Bun)',
              version: '1.0.0',
              description: 'API documentation for the Schichtplan application backend (Bun/Elysia)',
          },
          // Add tags for grouping endpoints in Swagger UI
           tags: [
                { name: 'Employees', description: 'Employee management endpoints' },
                { name: 'ShiftTemplates', description: 'Shift Template management endpoints' },
                { name: 'Coverage', description: 'Coverage record management endpoints' },
                { name: 'RecurringCoverage', description: 'Recurring Coverage rule management endpoints' },
                { name: 'ShiftPatterns', description: 'Shift Pattern management endpoints' },
                { name: 'Absences', description: 'Absence record management endpoints' },
                { name: 'EmployeeAvailability', description: 'Employee Availability management endpoints' },
                { name: 'Schedules', description: 'Schedule management and generation endpoints' },
                { name: 'Settings', description: 'Application settings endpoints' },
            ]
      },
  }))
  .get("/", () => ({ status: "Bun backend running" })) // Simple health check route
  // --- Mount Routes using the correct variable names ---
  .use(employeeRoutes)
  .use(settingsRoutes)
  .use(scheduleRoutes)
  .use(shiftTemplateRoutes)
  .use(employeeAvailabilityRoutes) // Mount employee-nested availability routes
  .use(availabilityRoutes)       // Mount top-level availability routes (PUT/DELETE by ID)
  .use(employeeAbsenceRoutes) // Mount employee-nested absence routes
  .use(absenceRoutes)         // Mount top-level absence routes (PUT/DELETE by ID)
  .use(coverageRoutes) // Mount coverage routes
  .use(recurringCoverageRoutes) // Mount recurring coverage routes
  .use(shiftPatternRoutes) // Mounted routes
  .use(settingsRoutes)
  .use(scheduleRoutes) // Original schedule routes (likely for generation/overview)
  .onError(globalErrorHandler) // Use the error handler (types inferred)
  .listen(PORT);

console.log(
  `🦊 Schichtplan Bun backend is running at http://${app.server?.hostname}:${app.server?.port}`
);

console.log(`📄 API Docs available at http://${app.server?.hostname}:${app.server?.port}/api-docs`);

export default app; // Export for potential testing or programmatic use