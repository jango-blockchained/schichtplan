import { Elysia, t } from 'elysia';
import type { LogEntry } from '../../frontend/src/services/logService'; // Assuming path, adjust if needed
import { logger } from '../index'; // Import the base logger

// Define the expected structure for a single log entry using Elysia's validation (t)
const LogEntrySchema = t.Object({
    timestamp: t.String({ format: 'date-time' }),
    level: t.Union([
        t.Literal('info'),
        t.Literal('warning'),
        t.Literal('error'),
        t.Literal('debug')
    ]),
    module: t.String(),
    action: t.String(),
    message: t.String(),
    user: t.Optional(t.String()),
    page: t.Optional(t.String()),
    details: t.Optional(t.Any()) // Allow any type for details
});

// Define the expected body schema: an object containing an array of LogEntry objects
const LogsBodySchema = t.Object({
    logs: t.Array(LogEntrySchema)
});

export const logRoutes = new Elysia({ prefix: '/logs' })
    // --- POST /api/logs --- (Receives log batches from frontend)
    .post('/', 
        async ({ body, log }) => { // Use request-specific logger from context
            const receivedLogs = body.logs;
            log.info(`Received batch of ${receivedLogs.length} logs from frontend.`);

            // **TODO:** Implement actual log processing here (e.g., write to file, DB, etc.)
            // For now, just log them to the console using the backend logger
            receivedLogs.forEach((entry: LogEntry) => {
                // Use a level mapping or similar for more structured backend logging
                log.info({ frontendLog: entry }, `[FE Log] [${entry.level.toUpperCase()}] ${entry.module}/${entry.action}: ${entry.message}`);
            });

            return { success: true, message: `Received ${receivedLogs.length} logs.` };
        }, 
        {
            body: LogsBodySchema, // Validate the incoming request body
            detail: { // Add details for Swagger documentation
                summary: 'Receive log entries from the frontend',
                description: 'Endpoint for the frontend application to send batches of log entries.',
                tags: ['Logs'] // Add a tag for grouping in Swagger UI
            }
        }
    );

// Add GET endpoint for viewing logs (placeholder - requires log file reading)
// export const logRoutes = new Elysia({ prefix: '/logs' })
//     .get('/', async ({ log }) => {
//         log.info('Request received for GET /api/logs');
//         // Placeholder: Implement logic to read log files from the server
//         // This might involve reading from ./src/logs directory or wherever logs are stored
//         return { message: "Log viewing endpoint not yet implemented." }; 
//     });

export default logRoutes; 