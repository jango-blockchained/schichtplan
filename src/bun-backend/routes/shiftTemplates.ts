import { Elysia, t, NotFoundError } from "elysia";
import {
    getAllShiftTemplates,
    getShiftTemplateById,
    createShiftTemplate,
    updateShiftTemplate,
    deleteShiftTemplate,
} from "../services/shiftTemplateService";
import { ShiftType } from "../db/schema"; // Import enum for validation

// --- Define Elysia Schemas for Shift Templates --- //

// Schema for the ActiveDays JSON object
const ActiveDaysSchema = t.Record(t.String(), t.Boolean());

// Schema for creating a new shift template (POST body)
const CreateShiftTemplateSchema = t.Object({
    start_time: t.String({ format: "time", description: "Start time in HH:MM format" }),
    end_time: t.String({ format: "time", description: "End time in HH:MM format" }),
    requires_break: t.Boolean({ default: true }),
    // Use t.Enum if ShiftType enum is available at runtime
    shift_type: t.Enum(ShiftType, { description: "Type of shift (EARLY, MIDDLE, LATE, etc.)" }),
    shift_type_id: t.Optional(t.Nullable(t.String())),
    active_days: ActiveDaysSchema,
});

// Schema for updating an existing shift template (PUT body - all optional)
const UpdateShiftTemplateSchema = t.Partial(t.Object({
    start_time: t.Optional(t.String({ format: "time" })),
    end_time: t.Optional(t.String({ format: "time" })),
    requires_break: t.Optional(t.Boolean()),
    shift_type: t.Optional(t.Enum(ShiftType)),
    shift_type_id: t.Optional(t.Nullable(t.String())),
    active_days: t.Optional(ActiveDaysSchema),
}));

// Schema for ID parameter in URL
const IdParamSchema = t.Object({
    id: t.Numeric({ minimum: 1, description: "Shift Template ID" }),
});

// --- Define Elysia Routes --- //

// Using /api/shifts to match the original Flask API structure
export const shiftTemplateRoutes = new Elysia({ prefix: "/api/shifts" })
    // GET /api/shifts - Get all shift templates
    .get("/", async ({ set }) => {
        try {
            const templates = await getAllShiftTemplates();
            return { success: true, data: templates }; // Consistent response format
        } catch (error: any) {
            console.error(`Error fetching all shift templates: ${error.message}`);
            set.status = 500;
            return { success: false, error: "Failed to retrieve shift templates" };
        }
    }, {
        detail: { summary: 'Get all shift templates', tags: ['ShiftTemplates'] }
    })

    // POST /api/shifts - Create a new shift template
    .post("/", async ({ body, set }) => {
        try {
            // Assuming createShiftTemplate input matches the validated body structure
            // Need to ensure the body has all required fields expected by the service
            const newTemplate = await createShiftTemplate(body);
            set.status = 201; // Created
            return { success: true, data: newTemplate }; // Consistent response format
        } catch (error: any) {
            console.error(`Error creating shift template: ${error.message}`);
            // Consider specific error codes (e.g., 400 for validation if not caught by Elysia)
            set.status = 500; 
            return { success: false, error: "Failed to create shift template" };
        }
    }, {
        body: CreateShiftTemplateSchema,
        detail: { summary: 'Create a new shift template', tags: ['ShiftTemplates'] }
    })

    // GET /api/shifts/:id - Get a single shift template by ID
    .get("/:id", async ({ params, set }) => {
        try {
            const template = await getShiftTemplateById(params.id);
            return { success: true, data: template }; // Consistent response format
        } catch (error: any) {
            if (error instanceof NotFoundError) {
                set.status = 404;
                return { success: false, error: error.message };
            }
            console.error(`Error fetching shift template ${params.id}: ${error.message}`);
            set.status = 500;
            return { success: false, error: "Failed to retrieve shift template" };
        }
    }, {
        params: IdParamSchema,
        detail: { summary: 'Get shift template by ID', tags: ['ShiftTemplates'] }
    })

    // PUT /api/shifts/:id - Update a shift template by ID
    .put("/:id", async ({ params, body, set }) => {
        try {
            const updatedTemplate = await updateShiftTemplate(params.id, body);
            return { success: true, data: updatedTemplate }; // Consistent response format
        } catch (error: any) {
            if (error instanceof NotFoundError) {
                set.status = 404;
                return { success: false, error: error.message };
            }
            console.error(`Error updating shift template ${params.id}: ${error.message}`);
            // Consider 400 for validation errors if update logic includes them
            set.status = 500;
            return { success: false, error: "Failed to update shift template" };
        }
    }, {
        params: IdParamSchema,
        body: UpdateShiftTemplateSchema,
        detail: { summary: 'Update an existing shift template', tags: ['ShiftTemplates'] }
    })

    // DELETE /api/shifts/:id - Delete a shift template by ID
    .delete("/:id", async ({ params, set }) => {
        try {
            const result = await deleteShiftTemplate(params.id);
            if (result.success) {
                set.status = 204; // No Content
                return; // Return nothing on successful delete
            }
            // This case might be redundant if service throws NotFoundError
            set.status = 500;
            return { success: false, error: "Deletion failed unexpectedly." }; 
        } catch (error: any) {
            if (error instanceof NotFoundError) {
                set.status = 404;
                return { success: false, error: error.message };
            }
            console.error(`Error deleting shift template ${params.id}: ${error.message}`);
            set.status = 500;
            return { success: false, error: "Failed to delete shift template" };
        }
    }, {
        params: IdParamSchema,
        detail: { summary: 'Delete a shift template', tags: ['ShiftTemplates'] }
    });

// Keep default export if index.ts uses it, or remove if using named import
// export default shiftTemplateRoutes; 