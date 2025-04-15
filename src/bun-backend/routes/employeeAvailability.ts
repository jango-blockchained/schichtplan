import { Elysia, t, NotFoundError } from "elysia";
import { getDb } from "../db"; // Import getDb
import { Database } from "bun:sqlite"; // Import Database type
import logger from "../logger"; // Import the logger
import {
    getAvailabilitiesForEmployee as getServiceAvailabilitiesForEmployee,
    getAvailabilityById as getServiceAvailabilityById,
    addAvailability as addServiceAvailability,
    updateAvailability as updateServiceAvailability,
    deleteAvailability as deleteServiceAvailability,
    replaceEmployeeAvailabilities as replaceServiceEmployeeAvailabilities,
} from "../services/employeeAvailabilityService";
import { AvailabilityType } from "../db/schema"; // Enum for validation

// --- Schemas --- //

const EmployeeIdParamSchema = t.Object({
    id: t.Numeric({ minimum: 1, description: "Employee ID" }),
});

const AvailabilityIdParamSchema = t.Object({
    id: t.Numeric({ minimum: 1, description: "Availability Entry ID" }),
});

// Schema for creating availability (POST body)
// employee_id will be taken from the URL parameter
const CreateAvailabilitySchema = t.Object({
    day_of_week: t.Integer({ minimum: 0, maximum: 6, description: "0=Sunday, 6=Saturday" }),
    hour: t.Integer({ minimum: 0, maximum: 23 }),
    availability_type: t.Enum(AvailabilityType),
    start_date: t.Optional(t.Nullable(t.String({ format: "date", description: "YYYY-MM-DD" }))),
    end_date: t.Optional(t.Nullable(t.String({ format: "date", description: "YYYY-MM-DD" }))),
    is_recurring: t.Boolean({ default: true }),
});

// Schema for updating availability (PUT body - partial)
const UpdateAvailabilitySchema = t.Partial(t.Object({
    day_of_week: t.Optional(t.Integer({ minimum: 0, maximum: 6, description: "0=Sunday, 6=Saturday" })),
    hour: t.Optional(t.Integer({ minimum: 0, maximum: 23 })),
    availability_type: t.Optional(t.Enum(AvailabilityType)),
    start_date: t.Optional(t.Nullable(t.String({ format: "date" }))),
    end_date: t.Optional(t.Nullable(t.String({ format: "date" }))),
    is_recurring: t.Optional(t.Boolean()),
}));

// Schema for the bulk update payload (PUT /employees/:id/availability/)
const BulkAvailabilityEntrySchema = t.Object({
    day_of_week: t.Integer({ minimum: 0, maximum: 6, description: "0=Sunday, 6=Saturday" }),
    hour: t.Integer({ minimum: 0, maximum: 23 }),
    // is_available: t.Boolean(), // Receive boolean from frontend
    availability_type: t.String(), // Receive type string from frontend
});

const BulkUpdateAvailabilitySchema = t.Object({
    availabilities: t.Array(BulkAvailabilityEntrySchema),
});

// --- Routes --- //

// Note: Using separate prefixes for clarity, but could be combined

// Nested routes under employee
export const employeeAvailabilityRoutes = new Elysia({ prefix: "/api/employees/:id/availabilities" })
    // GET availability for a specific employee
    .get("/", async ({ params, set, ...ctx }) => { // Add context
        const context = ctx as { db?: Database };
        const currentDb = context.db ?? getDb(); // Use getDb()
        const routeLogger = (ctx as any).log ?? logger; // Correct logger access
        try {
            const availabilities = await getServiceAvailabilitiesForEmployee(params.id, currentDb); // Pass db
            return availabilities;
        } catch (error: any) {
            console.error(`Error fetching availability for employee ${params.id}: ${error.message}`);
            set.status = 500;
            return { error: "Failed to retrieve employee availability" };
        }
    }, {
        params: EmployeeIdParamSchema,
    })

    // POST new availability for a specific employee
    .post("/", async ({ params, body, set, ...ctx }) => { // Add context
        const context = ctx as { db?: Database };
        const currentDb = context.db ?? getDb(); // Use getDb()
        const routeLogger = (ctx as any).log ?? logger; // Correct logger access
        try {
            const availabilityData = {
                ...body,
                employee_id: params.id,
            };
            const newAvailability = await addServiceAvailability(availabilityData, currentDb); // Pass db
            set.status = 201;
            return newAvailability;
        } catch (error: any) {
            console.error(`Error adding availability for employee ${params.id}: ${error.message}`);
            set.status = 500; 
            return { error: "Failed to add availability entry", details: error.message };
        }
    }, {
        params: EmployeeIdParamSchema,
        body: CreateAvailabilitySchema,
    })
    // PUT: Replace all availability for a specific employee (Bulk Update)
    .put("/", async ({ params, body, set, ...ctx }) => {
        const context = ctx as { db?: Database };
        const currentDb = context.db ?? getDb(); // Use getDb()
        const routeLogger = (ctx as any).log ?? logger; // Correct logger access

        try {
            routeLogger.info(`Replacing availability for employee ${params.id}...`);
            // Pass the raw array from the validated body
            await replaceServiceEmployeeAvailabilities(params.id, body.availabilities, currentDb);
            routeLogger.info(`Successfully replaced availability for employee ${params.id}.`);
            return { message: "Availability updated successfully" };
        } catch (error: any) {
            routeLogger.error({ err: error }, `Error replacing availability for employee ${params.id}`);
            set.status = 500;
            return { error: "Failed to update employee availability", details: error.message };
        }
    }, {
        params: EmployeeIdParamSchema,
        body: BulkUpdateAvailabilitySchema, // Use the new bulk schema
    });

// Top-level routes for specific availability ID actions
export const availabilityRoutes = new Elysia({ prefix: "/api/availability" })
    // PUT update specific availability entry
    .put("/:id", async ({ params, body, set, ...ctx }) => { // Add context
        const context = ctx as { db?: Database };
        const currentDb = context.db ?? getDb(); // Use getDb()
        const routeLogger = (ctx as any).log ?? logger; // Correct logger access
        try {
            const updated = await updateServiceAvailability(params.id, body, currentDb); // Pass db
            routeLogger.info(`Updated availability ${params.id}`);
            return updated; // Service throws NotFoundError
        } catch (error: any) {
            if (error instanceof NotFoundError) {
                set.status = 404;
                return { error: error.message, details: error.message };
            }
            console.error(`Error updating availability ${params.id}: ${error.message}`);
            set.status = 500; 
            return { error: "Failed to update availability entry", details: error.message };
        }
    }, {
        params: AvailabilityIdParamSchema,
        body: UpdateAvailabilitySchema,
    })

    // DELETE specific availability entry
    .delete("/:id", async ({ params, set, ...ctx }) => { // Add context
        const context = ctx as { db?: Database };
        const currentDb = context.db ?? getDb(); // Use getDb()
        const routeLogger = (ctx as any).log ?? logger; // Correct logger access
        try {
            await deleteServiceAvailability(params.id, currentDb); // Pass db, service throws NotFoundError
            routeLogger.info(`Deleted availability ${params.id}`);
            set.status = 204; 
            return;
        } catch (error: any) {
            if (error instanceof NotFoundError) {
                set.status = 404;
                return { error: error.message, details: error.message };
            }
            console.error(`Error deleting availability ${params.id}: ${error.message}`);
            set.status = 500;
            return { error: "Failed to delete availability entry", details: error.message };
        }
    }, {
        params: AvailabilityIdParamSchema,
    }); 