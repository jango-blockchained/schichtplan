import { Elysia, t, NotFoundError } from "elysia";
import globalDb from "../db"; // Import globalDb
import { Database } from "bun:sqlite"; // Import Database type
import {
    getAvailabilitiesForEmployee as getServiceAvailabilitiesForEmployee,
    getAvailabilityById as getServiceAvailabilityById,
    addAvailability as addServiceAvailability,
    updateAvailability as updateServiceAvailability,
    deleteAvailability as deleteServiceAvailability,
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
    day_of_week: t.Integer({ minimum: 0, maximum: 6, description: "0=Monday, 6=Sunday" }),
    hour: t.Integer({ minimum: 0, maximum: 23 }),
    availability_type: t.Enum(AvailabilityType),
    start_date: t.Optional(t.Nullable(t.String({ format: "date", description: "YYYY-MM-DD" }))),
    end_date: t.Optional(t.Nullable(t.String({ format: "date", description: "YYYY-MM-DD" }))),
    is_recurring: t.Boolean({ default: true }),
});

// Schema for updating availability (PUT body - partial)
const UpdateAvailabilitySchema = t.Partial(t.Object({
    day_of_week: t.Optional(t.Integer({ minimum: 0, maximum: 6 })),
    hour: t.Optional(t.Integer({ minimum: 0, maximum: 23 })),
    availability_type: t.Optional(t.Enum(AvailabilityType)),
    start_date: t.Optional(t.Nullable(t.String({ format: "date" }))),
    end_date: t.Optional(t.Nullable(t.String({ format: "date" }))),
    is_recurring: t.Optional(t.Boolean()),
}));

// --- Routes --- //

// Note: Using separate prefixes for clarity, but could be combined

// Nested routes under employee
export const employeeAvailabilityRoutes = new Elysia({ prefix: "/api/employees/:id/availability" })
    // GET availability for a specific employee
    .get("/", async ({ params, set, ...ctx }) => { // Add context
        const context = ctx as { db?: Database };
        const currentDb = context.db ?? globalDb;
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
        const currentDb = context.db ?? globalDb;
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
    });

// Top-level routes for specific availability ID actions
export const availabilityRoutes = new Elysia({ prefix: "/api/availability" })
    // PUT update specific availability entry
    .put("/:id", async ({ params, body, set, ...ctx }) => { // Add context
        const context = ctx as { db?: Database };
        const currentDb = context.db ?? globalDb;
        try {
            const updated = await updateServiceAvailability(params.id, body, currentDb); // Pass db
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
        const currentDb = context.db ?? globalDb;
        try {
            await deleteServiceAvailability(params.id, currentDb); // Pass db, service throws NotFoundError
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