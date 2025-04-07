import { Elysia, t, NotFoundError } from "elysia";
import {
    getAllCoverageEntries,
    getCoverageById,
    createCoverage,
    updateCoverage,
    deleteCoverage,
} from "../services/coverageService";
import { EmployeeGroup } from "../db/schema"; // Enum for validation

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

// --- Routes --- //

export const coverageRoutes = new Elysia({ prefix: "/api/coverage" })
    // GET all coverage entries
    .get("/", async ({ set }) => {
        try {
            const coverageEntries = await getAllCoverageEntries();
            return coverageEntries;
        } catch (error: any) {
            console.error(`Error fetching all coverage entries: ${error.message}`);
            set.status = 500;
            return { error: "Failed to retrieve coverage entries" };
        }
    })

    // POST a new coverage entry
    .post("/", async ({ body, set }) => {
        try {
            const newCoverage = await createCoverage(body);
            set.status = 201;
            return newCoverage;
        } catch (error: any) {
            console.error(`Error creating coverage entry: ${error.message}`);
            set.status = 500; // Or 400 if validation fails
            return { error: "Failed to create coverage entry" };
        }
    }, {
        body: CreateCoverageSchema,
    })

    // GET a single coverage entry by ID
    .get("/:id", async ({ params, set }) => {
        try {
            const coverage = await getCoverageById(params.id);
            return coverage;
        } catch (error: any) {
            if (error instanceof NotFoundError) {
                set.status = 404;
                return { error: error.message };
            }
            console.error(`Error fetching coverage entry ${params.id}: ${error.message}`);
            set.status = 500;
            return { error: "Failed to retrieve coverage entry" };
        }
    }, {
        params: IdParamSchema,
    })

    // PUT update a coverage entry by ID
    .put("/:id", async ({ params, body, set }) => {
        try {
            const updatedCoverage = await updateCoverage(params.id, body);
            return updatedCoverage;
        } catch (error: any) {
            if (error instanceof NotFoundError) {
                set.status = 404;
                return { error: error.message };
            }
            console.error(`Error updating coverage entry ${params.id}: ${error.message}`);
            set.status = 500; // Or 400 if validation fails
            return { error: "Failed to update coverage entry" };
        }
    }, {
        params: IdParamSchema,
        body: UpdateCoverageSchema,
    })

    // DELETE a coverage entry by ID
    .delete("/:id", async ({ params, set }) => {
        try {
            await deleteCoverage(params.id);
            set.status = 204; // No Content
            return;
        } catch (error: any) {
            if (error instanceof NotFoundError) {
                set.status = 404;
                return { error: error.message };
            }
            console.error(`Error deleting coverage entry ${params.id}: ${error.message}`);
            set.status = 500;
            return { error: "Failed to delete coverage entry" };
        }
    }, {
        params: IdParamSchema,
    }); 