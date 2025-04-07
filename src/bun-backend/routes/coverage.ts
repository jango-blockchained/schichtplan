import { Elysia, t, NotFoundError } from "elysia";
import globalDb from "../db"; // Import globalDb
import { Database } from "bun:sqlite"; // Import Database type
import {
    getAllCoverage as getServiceAllCoverage, // Use aliases to avoid name clash
    getCoverageById as getServiceCoverageById,
    createCoverage as createServiceCoverage,
    updateCoverage as updateServiceCoverage,
    deleteCoverage as deleteServiceCoverage,
    bulkUpdateCoverage as bulkServiceUpdateCoverage,
} from "../services/coverageService";
import { Coverage, EmployeeGroup } from "../db/schema"; // Import necessary types

// --- Schemas --- //

const IdParamSchema = t.Object({
    id: t.Numeric({ minimum: 1, description: "Coverage Entry ID" }),
});

// Schema for EmployeeGroup array (used in create/update)
const EmployeeGroupArraySchema = t.Array(t.Enum(EmployeeGroup));

// Schema for creating coverage (POST body)
const CreateCoverageSchema = t.Object({
    day_index: t.Integer({ minimum: 0, maximum: 6, description: "0-6, Sunday-Saturday or Monday-Sunday? Needs clarification" }),
    start_time: t.String({ format: "time", description: "HH:MM" }),
    end_time: t.String({ format: "time", description: "HH:MM" }),
    min_employees: t.Integer({ minimum: 0, default: 1 }),
    max_employees: t.Integer({ minimum: 0, default: 3 }),
    employee_types: EmployeeGroupArraySchema, // Required employee types for this slot
    allowed_employee_groups: t.Optional(t.Nullable(EmployeeGroupArraySchema)), // Optional: Restrict which groups can fill
    requires_keyholder: t.Boolean({ default: false }),
    keyholder_before_minutes: t.Optional(t.Nullable(t.Integer({ minimum: 0 }))),
    keyholder_after_minutes: t.Optional(t.Nullable(t.Integer({ minimum: 0 }))),
    // TODO: Add validation: start_time < end_time (handle overnight?)
});

// Schema for updating coverage (PUT body - partial)
const UpdateCoverageSchema = t.Partial(t.Object({
    day_index: t.Optional(t.Integer({ minimum: 0, maximum: 6 })),
    start_time: t.Optional(t.String({ format: "time" })),
    end_time: t.Optional(t.String({ format: "time" })),
    min_employees: t.Optional(t.Integer({ minimum: 0 })),
    max_employees: t.Optional(t.Integer({ minimum: 0 })),
    employee_types: t.Optional(EmployeeGroupArraySchema),
    allowed_employee_groups: t.Optional(t.Nullable(EmployeeGroupArraySchema)),
    requires_keyholder: t.Optional(t.Boolean()),
    keyholder_before_minutes: t.Optional(t.Nullable(t.Integer({ minimum: 0 }))),
    keyholder_after_minutes: t.Optional(t.Nullable(t.Integer({ minimum: 0 }))),
}));

// Schema for a single coverage time slot
const CoverageTimeSlotSchema = t.Object({
    id: t.Optional(t.Number()), // Optional ID, might not be present in input
    day_index: t.Number({ minimum: 0, maximum: 6, description: "Day index (0-6, Sun-Sat or Mon-Sun - check convention)" }),
    start_time: t.String({ format: 'time', description: 'Start time HH:MM' }),
    end_time: t.String({ format: 'time', description: 'End time HH:MM' }),
    min_employees: t.Number({ minimum: 0, default: 1 }),
    max_employees: t.Number({ minimum: 0, default: 3 }),
    employee_types: t.Array(t.Enum(EmployeeGroup, { description: "Employee group identifier" }), { default: [] }),
    allowed_employee_groups: t.Array(t.Enum(EmployeeGroup, { description: "Employee group identifier" }), { default: [] }),
    requires_keyholder: t.Boolean({ default: false }),
    keyholder_before_minutes: t.Optional(t.Nullable(t.Number())),
    keyholder_after_minutes: t.Optional(t.Nullable(t.Number())),
    // Timestamps are usually handled by DB
    created_at: t.Optional(t.String({ format: 'date-time' })),
    updated_at: t.Optional(t.String({ format: 'date-time' })),
});

// Schema for the bulk update request body (array of coverage slots)
const BulkCoverageUpdateSchema = t.Array(CoverageTimeSlotSchema);

// --- Routes --- //

export const coverageRoutes = new Elysia({ prefix: "/api/coverage" })
    // GET all coverage entries
    .get("/", async ({ set, ...ctx }) => { // Add context
        const context = ctx as { db?: Database };
        const currentDb = context.db ?? globalDb;
        try {
            const coverageEntries = await getServiceAllCoverage(currentDb); // Pass db
            // Existing logic returned success/data wrapper, keep for now?
            // Or just return the data directly? Assuming direct return for consistency.
            return coverageEntries;
        } catch (error: any) {
            console.error(`Error getting all coverage entries: ${error.message}`);
            set.status = 500;
            return { error: 'Failed to retrieve coverage entries' };
        }
    }, {
        detail: { summary: 'Get all coverage entries', tags: ['Coverage'] }
    })

    // POST a new coverage entry
    .post("/", async ({ body, set, ...ctx }) => { // Add context
        const context = ctx as { db?: Database };
        const currentDb = context.db ?? globalDb;
        try {
            const newCoverage = await createServiceCoverage(body, currentDb); // Pass db
            set.status = 201;
            return newCoverage;
        } catch (error: any) {
            console.error(`Error creating coverage entry: ${error.message}`);
            set.status = 500; 
            return { error: "Failed to create coverage entry", details: error.message };
        }
    }, {
        body: CreateCoverageSchema,
        detail: { summary: 'Create new coverage entry', tags: ['Coverage'] }
    })

    // GET a single coverage entry by ID
    .get("/:id", async ({ params, set, ...ctx }) => { // Add context
        const context = ctx as { db?: Database };
        const currentDb = context.db ?? globalDb;
        try {
            const coverage = await getServiceCoverageById(params.id, currentDb); // Pass db
            return coverage; // Service throws NotFoundError
        } catch (error: any) {
            if (error instanceof NotFoundError) {
                set.status = 404;
                return { error: error.message, details: error.message };
            }
            console.error(`Error fetching coverage entry ${params.id}: ${error.message}`);
            set.status = 500;
            return { error: "Failed to retrieve coverage entry" };
        }
    }, {
        params: IdParamSchema,
        detail: { summary: 'Get coverage entry by ID', tags: ['Coverage'] }
    })

    // PUT update a coverage entry by ID
    .put("/:id", async ({ params, body, set, ...ctx }) => { // Add context
        const context = ctx as { db?: Database };
        const currentDb = context.db ?? globalDb;
        try {
            const updatedCoverage = await updateServiceCoverage(params.id, body, currentDb); // Pass db
            return updatedCoverage; // Service throws NotFoundError
        } catch (error: any) {
            if (error instanceof NotFoundError) {
                set.status = 404;
                return { error: error.message, details: error.message };
            }
            console.error(`Error updating coverage entry ${params.id}: ${error.message}`);
            set.status = 500; 
            return { error: "Failed to update coverage entry", details: error.message };
        }
    }, {
        params: IdParamSchema,
        body: UpdateCoverageSchema,
        detail: { summary: 'Update coverage entry by ID', tags: ['Coverage'] }
    })

    // DELETE a coverage entry by ID
    .delete("/:id", async ({ params, set, ...ctx }) => { // Add context
        const context = ctx as { db?: Database };
        const currentDb = context.db ?? globalDb;
        try {
            await deleteServiceCoverage(params.id, currentDb); // Pass db, service throws NotFoundError
            set.status = 204; 
            return;
        } catch (error: any) {
            if (error instanceof NotFoundError) {
                set.status = 404;
                return { error: error.message, details: error.message };
            }
            console.error(`Error deleting coverage entry ${params.id}: ${error.message}`);
            set.status = 500;
            return { error: "Failed to delete coverage entry", details: error.message };
        }
    }, {
        params: IdParamSchema,
        detail: { summary: 'Delete coverage entry by ID', tags: ['Coverage'] }
    })

    // POST /api/coverage/bulk - Bulk update coverage entries
    .post('/bulk', async ({ body, set, ...ctx }) => { // Add context
        const context = ctx as { db?: Database };
        const currentDb = context.db ?? globalDb;
         try {
            const resultCoverage = await bulkServiceUpdateCoverage(body, currentDb); // Pass db
            // Return the result from the service (which is the input data on success)
            return resultCoverage; 
         } catch(error: any) {
             console.error(`Error bulk updating coverage: ${error.message}`);
             set.status = 500;
             return { error: 'Failed to update coverage entries', details: error.message };
         }
    }, {
        body: BulkCoverageUpdateSchema, 
        detail: { 
            summary: 'Bulk update/replace coverage entries', 
            description: 'Replaces existing coverage for the days included in the input array with the provided set.',
            tags: ['Coverage'] 
        }
    }); 