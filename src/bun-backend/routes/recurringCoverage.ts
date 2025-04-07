import { Elysia, t, NotFoundError } from 'elysia';
import {
    getAllRecurringCoverage,
    getRecurringCoverageById,
    createRecurringCoverage,
    updateRecurringCoverage,
    deleteRecurringCoverage
} from '../services/recurringCoverageService';
import { RecurringCoverage, EmployeeGroup } from '../db/schema'; // Import necessary types

// --- Define Elysia Schemas for Recurring Coverage --- //

// Schema for EmployeeGroup array
const EmployeeGroupArraySchema = t.Array(t.Enum(EmployeeGroup));

// Schema for the days array (array of numbers 0-6)
const DaysArraySchema = t.Array(t.Integer({ minimum: 0, maximum: 6 }), { minItems: 1, description: "Array of day indices (0-6, check convention)" });

// Base schema for common RecurringCoverage fields (for responses)
const RecurringCoverageResponseSchema = t.Object({
    id: t.Number(),
    name: t.String(),
    description: t.Nullable(t.String()),
    days: DaysArraySchema,
    start_date: t.Nullable(t.String({ format: 'date' })),
    end_date: t.Nullable(t.String({ format: 'date' })),
    start_time: t.String({ format: 'time' }),
    end_time: t.String({ format: 'time' }),
    min_employees: t.Integer(),
    max_employees: t.Integer(),
    allowed_employee_groups: t.Nullable(EmployeeGroupArraySchema),
    requires_keyholder: t.Boolean(),
    is_active: t.Boolean(),
    created_at: t.String({ format: 'date-time' }),
    updated_at: t.String({ format: 'date-time' }),
});

// Schema for creating a new recurring coverage entry (POST body)
const CreateRecurringCoverageSchema = t.Object({
    name: t.String({ minLength: 1 }),
    description: t.Optional(t.Nullable(t.String())),
    days: DaysArraySchema,
    start_date: t.Optional(t.Nullable(t.String({ format: 'date' }))),
    end_date: t.Optional(t.Nullable(t.String({ format: 'date' }))),
    start_time: t.String({ format: 'time' }),
    end_time: t.String({ format: 'time' }),
    min_employees: t.Integer({ minimum: 0, default: 1 }),
    max_employees: t.Integer({ minimum: 0, default: 3 }),
    allowed_employee_groups: t.Optional(t.Nullable(EmployeeGroupArraySchema)),
    requires_keyholder: t.Boolean({ default: false }),
    is_active: t.Boolean({ default: true }),
});

// Schema for updating an existing entry (PUT body - all optional)
const UpdateRecurringCoverageSchema = t.Partial(CreateRecurringCoverageSchema);

// Schema for ID parameter in URL
const IdParamSchema = t.Object({
    id: t.Numeric({ minimum: 1, description: "Recurring Coverage Entry ID" }),
});

// --- Define Elysia Routes --- //

// Use prefix consistent with potential frontend calls (e.g., /recurring-coverage)
export const recurringCoverageRoutes = new Elysia({ prefix: '/api/recurring-coverage' })

    // GET /api/recurring-coverage - Retrieve all recurring entries
    .get('/', async ({ set }) => {
        try {
            const entries = await getAllRecurringCoverage();
            return { success: true, data: entries };
        } catch (error: any) {
            console.error(`Error getting all recurring coverage: ${error.message}`);
            set.status = 500;
            return { success: false, error: 'Failed to retrieve recurring coverage entries' };
        }
    }, {
        detail: { summary: 'Get all recurring coverage templates', tags: ['RecurringCoverage'] }
    })

    // GET /api/recurring-coverage/:id - Retrieve a single entry
    .get('/:id', async ({ params: { id }, set }) => {
        try {
            const entry = await getRecurringCoverageById(id);
            return { success: true, data: entry };
        } catch (error: any) {
            if (error instanceof NotFoundError) {
                set.status = 404;
                return { success: false, error: error.message };
            }
            console.error(`Error getting recurring coverage ${id}: ${error.message}`);
            set.status = 500;
            return { success: false, error: 'Failed to retrieve recurring coverage entry' };
        }
    }, {
        params: IdParamSchema,
        detail: { summary: 'Get recurring coverage template by ID', tags: ['RecurringCoverage'] }
    })

    // POST /api/recurring-coverage - Create a new entry (placeholder)
    .post('/', async ({ body, set }) => {
        console.warn("POST /api/recurring-coverage endpoint hit, but service is not implemented.");
        try {
            // const newEntry = await createRecurringCoverage(body);
            // set.status = 201;
            // return { success: true, data: newEntry };
            set.status = 501; // Not Implemented
            return { success: false, error: 'Create functionality not yet implemented.' };
        } catch (error: any) {
            console.error(`Error creating recurring coverage: ${error.message}`);
            set.status = 500;
            return { success: false, error: 'Failed to create recurring coverage entry' };
        }
    }, {
        body: CreateRecurringCoverageSchema,
        detail: { summary: 'Create a new recurring coverage template', tags: ['RecurringCoverage'] }
    })

    // PUT /api/recurring-coverage/:id - Update an existing entry (placeholder)
    .put('/:id', async ({ params: { id }, body, set }) => {
        console.warn(`PUT /api/recurring-coverage/${id} endpoint hit, but service is not implemented.`);
        try {
            // const updatedEntry = await updateRecurringCoverage(id, body);
            // return { success: true, data: updatedEntry };
            set.status = 501; // Not Implemented
            return { success: false, error: 'Update functionality not yet implemented.' };
        } catch (error: any) {
            if (error instanceof NotFoundError) {
                set.status = 404;
                return { success: false, error: error.message };
            }
            console.error(`Error updating recurring coverage ${id}: ${error.message}`);
            set.status = 500;
            return { success: false, error: 'Failed to update recurring coverage entry' };
        }
    }, {
        params: IdParamSchema,
        body: UpdateRecurringCoverageSchema,
        detail: { summary: 'Update an existing recurring coverage template', tags: ['RecurringCoverage'] }
    })

    // DELETE /api/recurring-coverage/:id - Delete an entry (placeholder)
    .delete('/:id', async ({ params: { id }, set }) => {
         console.warn(`DELETE /api/recurring-coverage/${id} endpoint hit, but service is not implemented.`);
        try {
            // await deleteRecurringCoverage(id);
            // set.status = 204;
            // return;
            set.status = 501; // Not Implemented
            return { success: false, error: 'Delete functionality not yet implemented.' };
        } catch (error: any) {
            if (error instanceof NotFoundError) {
                set.status = 404;
                return { success: false, error: error.message };
            }
            console.error(`Error deleting recurring coverage ${id}: ${error.message}`);
            set.status = 500;
            return { success: false, error: 'Failed to delete recurring coverage entry' };
        }
    }, {
        params: IdParamSchema,
        detail: { summary: 'Delete a recurring coverage template', tags: ['RecurringCoverage'] }
    }); 