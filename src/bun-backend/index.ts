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
import { shiftPatternRoutes } from './routes/shiftPatterns'; // Import shift pattern routes
import { swagger } from '@elysiajs/swagger';
import { jwt } from '@elysiajs/jwt';
import { staticPlugin } from '@elysiajs/static';
import pino from 'pino';
import { randomUUID } from 'node:crypto';
// Removed incorrect import: import { globalErrorHandler } from './lib/errorHandler';

// Define the port, defaulting to 5001 to avoid conflict with Flask's 5000 if run concurrently
const PORT = process.env.PORT || 5001;

console.log("Initializing Elysia application...");

// Configure Pino Logger
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info');

const logger = pino(
  {
    level: logLevel,
  },
  // Use pino-pretty in development, otherwise default JSON
  process.env.NODE_ENV === 'development'
    ? pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          levelFirst: true,
          translateTime: 'SYS:HH:MM:ss.l',
          ignore: 'pid,hostname,reqId,req,res', // Ignore these fields in pretty print
          messageFormat: '({reqId}) {msg}', // Add reqId to the message
        },
      })
    : undefined, // Use default JSON transport in production/other envs
);

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
  // --- Base Logger & Request ID --- 
  .decorate('log', logger) // Add base logger to app decoration
  .onRequest(({ request, set, log }) => {
    // Generate unique request ID
    const reqId = randomUUID(); 
    // Create request-specific child logger
    set.headers['X-Request-ID'] = reqId; // Add header for tracing
    // Attach child logger with reqId to context (will overwrite base log decoration for this request)
    (set as any).log = log.child({ reqId });
    (set as any).log.debug({ req: request }, `Request received: ${request.method} ${new URL(request.url).pathname}`);
  })
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
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET || 'fallback-secret-key-change-me!', // Use environment variable!
    exp: '7d' // Token expiration time
  }))
  .onError(({ code, error, set, log }) => {
    // Safer error message extraction
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error({ err: error, code }, `Error occurred: ${errorMessage}`);

    // Standard Elysia error handling - use safer errorMessage
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { error: `Not Found: ${errorMessage}` };
    }
    if (code === 'VALIDATION') {
      set.status = 400;
      // Accessing nested error details might still be complex, keep original for now if needed
      return { error: `Validation Error: ${errorMessage}`, details: (error as any).validator?.Errors(error.value).First()?.message };
    }
    if (code === 'INTERNAL_SERVER_ERROR') {
      set.status = 500;
      return { error: `Internal Server Error: ${errorMessage}` };
    }
    
    // Default catch-all
    set.status = 500;
    return { error: `An unexpected error occurred: ${errorMessage}` };
  })
  // --- Response Logging (using onAfterHandle) ---
  // Temporarily commented out due to typing issues
  /*
  .onAfterHandle((context) => {
    const { request, set, log, response } = context;
    const reqLog = log as pino.Logger; 
    reqLog.info({ status: set.status }, `Response sent: ${request.method} ${new URL(request.url).pathname} -> ${set.status}`);
  })
  */
  // --- Server Start --- 
  .listen(PORT);

// Log server start
logger.info(`🦊 Schichtplan Bun backend is running at http://${app.server?.hostname}:${app.server?.port}`);
logger.info(`📄 API Docs available at http://${app.server?.hostname}:${app.server?.port}/api-docs`);

// Export the app instance and the base logger
export { app, logger };