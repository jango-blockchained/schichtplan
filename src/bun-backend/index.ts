// src/bun-backend/index.ts
import { Elysia, type Context } from "elysia";
import { cors } from '@elysiajs/cors';
import employeeRoutes from './routes/employees';
import { settingsRoutes } from './routes/settings';
import scheduleRoutes from './routes/schedules';
import { shiftTemplateRoutes } from './routes/shiftTemplates';
// Import availability routes
import { employeeAvailabilityRoutes, availabilityRoutes } from './routes/employeeAvailability';
// Import absence routes
import { employeeAbsenceRoutes, absenceRoutes } from './routes/absences';
// Import coverage routes
import { coverageRoutes } from './routes/coverage';
import { recurringCoverageRoutes } from './routes/recurringCoverage';
import { shiftPatternRoutes } from './routes/shiftPatterns';
import { demoDataRoutes } from './routes/demoData';
import logRoutes from './routes/logs';
import { swagger } from '@elysiajs/swagger';
import { jwt } from '@elysiajs/jwt';
import { staticPlugin } from '@elysiajs/static';
import logger from './logger';
import { randomUUID } from 'node:crypto';
import { getDb } from './db';
import { ensureDatabaseInitialized } from './db/ensureInitialized';

// Log startup after logger is imported
logger.info("[index.ts] Script execution started.");

// Define the port, defaulting to 5002
const PORT = process.env.PORT || 5002;

// Define error handler
const globalErrorHandler = ({ code, error, set }: { code: unknown, error: any, set: Context['set'] }) => {
    const errorMessage = typeof error?.message === 'string' ? error.message : 'Unknown error';
    const errorStack = typeof error?.stack === 'string' ? error.stack : undefined;

    logger.error(`GLOBAL ERROR Handler - Code: ${code}, Message: ${errorMessage}`);
    if (process.env.NODE_ENV !== 'production' && errorStack) {
        logger.error(`Stack trace: ${errorStack}`);
    }

    switch (code) {
        case 'NOT_FOUND':
            set.status = 404;
            return { error: `Not Found: ${errorMessage}` };
        case 'VALIDATION':
            set.status = 400;
            const details = error?.all ?? error?.validator?.Errors(error).First()?.message ?? errorMessage;
            return { error: `Validation Error`, details: details };
        case 'INTERNAL_SERVER_ERROR':
            set.status = 500;
            return { error: `Internal Server Error`, details: errorMessage };
        case 'PARSE':
             set.status = 400;
             return { error: `Request Parse Error`, details: errorMessage };
        default:
             if (typeof error?.status === 'number') {
                set.status = error.status;
            } else {
                 set.status = 500;
            }
            return { error: `An unexpected error occurred (${code})`, details: errorMessage };
    }
};

// Async function to initialize and start the app
async function startApp() {
  logger.info("Initializing Elysia application...");

  try {
    await getDb();
    logger.info("Database connection initialized (or already running).");
  } catch(error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`CRITICAL: Database initialization failed: ${errorMsg}`);
  }

  const app = new Elysia()
    // Add the logger as a decorator
    .decorate('log', logger)
    // Add request tracking middleware
    .onRequest((context) => {
      const requestId = randomUUID();
      context.request.headers.set('X-Request-ID', requestId);
      logger.debug(`${context.request.method} ${context.request.url} - Request ${requestId} started`);
    })
    // Add CORS middleware
    .use(cors({
      origin: ['http://localhost:3000', '*'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    }))
    // Add swagger for API documentation
    .use(swagger({
      documentation: {
        info: {
          title: 'Schichtplan API',
          version: '1.0.0',
        },
      },
    }))
    // Basic route to verify server is running
    .get("/", () => ({ status: "Bun backend running" }))
    // Add all routes
    .use(employeeRoutes)
    .use(settingsRoutes)
    .use(scheduleRoutes)
    .use(shiftTemplateRoutes)
    .use(employeeAvailabilityRoutes)
    .use(availabilityRoutes)
    .use(employeeAbsenceRoutes)
    .use(absenceRoutes)
    .use(coverageRoutes)
    .use(recurringCoverageRoutes)
    .use(shiftPatternRoutes)
    .use(demoDataRoutes)
    .use(logRoutes)
    // Add JWT for authentication
    .use(jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'super-secret-key-change-in-production',
    }))
    // Global error handler
    .onError(globalErrorHandler)
    // After request handler
    .onAfterHandle((context) => {
      // Log successful responses
      const status = context.set.status;
      if (typeof status === 'number' && status >= 200 && status < 400) {
        logger.debug(`${context.request.method} ${context.request.url} - ${status}`);
      }
    });

  // Start listening
  logger.info("Starting server...");
  app.listen({
      port: PORT,
      hostname: 'localhost'
  });

  // Log server info
  const actualHostname = app.server?.hostname;
  const actualPort = app.server?.port;
  logger.info(`Schichtplan Bun backend is running at http://${actualHostname}:${actualPort}`);
  logger.info(`API Docs available at http://${actualHostname}:${actualPort}/api-docs`);

  return app;
}

// Start the application
const appPromise = startApp();

// Export the promise which resolves to the app, and the base logger
export { appPromise, logger };
