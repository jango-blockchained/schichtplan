import { Elysia, t, NotFoundError } from 'elysia';
import {
    getAllShiftPatterns,
    getShiftPatternById,
    createShiftPattern,
    updateShiftPattern,
    deleteShiftPattern
} from '../services/shiftPatternService';
import { ShiftPattern, ActiveDays } from '../db/schema'; // Import necessary types

// --- Define Elysia Schemas for Shift Patterns --- //

// Schema for the ActiveDays JSON object
const ActiveDaysSchema = t.Record(t.String(), t.Boolean(), {
    description: "Object mapping day index (string '0'-'6') to boolean active status"
});

// Schema for the shifts array (array of ShiftTemplate IDs)
const ShiftsArraySchema = t.Array(t.Integer({ minimum: 1 }), {
    description: "Array of ShiftTemplate IDs associated with the pattern"
});

// Base schema for common ShiftPattern fields (for responses)
const ShiftPatternResponseSchema = t.Object({
    id: t.Number(),
    name: t.String(),
    description: t.Nullable(t.String()),
    shifts: ShiftsArraySchema,
    active_days: ActiveDaysSchema,
    is_active: t.Boolean(),
    created_at: t.String({ format: 'date-time' }),
    updated_at: t.String({ format: 'date-time' }),
});

// Schema for creating a new shift pattern (POST body)
const CreateShiftPatternSchema = t.Object({
    name: t.String({ minLength: 1 }),
    description: t.Optional(t.Nullable(t.String())),
    shifts: ShiftsArraySchema,
    active_days: ActiveDaysSchema,
    is_active: t.Boolean({ default: true }),
});

// Schema for updating an existing entry (PUT body - all optional)
const UpdateShiftPatternSchema = t.Partial(CreateShiftPatternSchema);

// Schema for ID parameter in URL
const IdParamSchema = t.Object({
    id: t.Numeric({ minimum: 1, description: "Shift Pattern ID" }),
});

// --- Define Elysia Routes --- //

// Use prefix consistent with potential frontend calls (e.g., /shift-patterns)
export const shiftPatternRoutes = new Elysia({ prefix: '/api/shift-patterns' })

    // GET /api/shift-patterns - Retrieve all entries
    .get('/', async ({ set }) => {
        try {
            const patterns = await getAllShiftPatterns();
            return { success: true, data: patterns };
        } catch (error: any) {
            console.error(`Error getting all shift patterns: ${error.message}`);
            set.status = 500;
            return { success: false, error: 'Failed to retrieve shift patterns' };
        }
    }, {
        detail: { summary: 'Get all shift patterns', tags: ['ShiftPatterns'] }
    })

    // GET /api/shift-patterns/:id - Retrieve a single entry
    .get('/:id', async ({ params: { id }, set }) => {
        try {
            const pattern = await getShiftPatternById(id);
            return { success: true, data: pattern };
        } catch (error: any) {
            if (error instanceof NotFoundError) {
                set.status = 404;
                return { success: false, error: error.message };
            }
            console.error(`Error getting shift pattern ${id}: ${error.message}`);
            set.status = 500;
            return { success: false, error: 'Failed to retrieve shift pattern' };
        }
    }, {
        params: IdParamSchema,
        detail: { summary: 'Get shift pattern by ID', tags: ['ShiftPatterns'] }
    })

    // POST /api/shift-patterns - Create a new entry
    .post('/', async ({ body, set }) => {
        try {
            const newPattern = await createShiftPattern(body);
            set.status = 201;
            return { success: true, data: newPattern };
        } catch (error: any) {
            console.error(`Error creating shift pattern: ${error.message}`);
            // Handle specific errors like UNIQUE constraint violation
            if (error.message?.includes('already exists')) {
                set.status = 409; // Conflict
                return { success: false, error: error.message };
            }
            set.status = 500;
            return { success: false, error: 'Failed to create shift pattern' };
        }
    }, {
        body: CreateShiftPatternSchema,
        detail: { summary: 'Create a new shift pattern', tags: ['ShiftPatterns'] }
    })

    // PUT /api/shift-patterns/:id - Update an existing entry
    .put('/:id', async ({ params: { id }, body, set }) => {
        try {
            const updatedPattern = await updateShiftPattern(id, body);
            return { success: true, data: updatedPattern };
        } catch (error: any) {
            if (error instanceof NotFoundError) {
                set.status = 404;
                return { success: false, error: error.message };
            }
            if (error.message?.includes('already exists')) {
                set.status = 409; // Conflict
                return { success: false, error: error.message };
            }
            console.error(`Error updating shift pattern ${id}: ${error.message}`);
            set.status = 500;
            return { success: false, error: 'Failed to update shift pattern' };
        }
    }, {
        params: IdParamSchema,
        body: UpdateShiftPatternSchema,
        detail: { summary: 'Update an existing shift pattern', tags: ['ShiftPatterns'] }
    })

    // DELETE /api/shift-patterns/:id - Delete an entry
    .delete('/:id', async ({ params: { id }, set }) => {
        try {
            await deleteShiftPattern(id);
            set.status = 204; // No Content
            return; // Return nothing on success
        } catch (error: any) {
            if (error instanceof NotFoundError) {
                set.status = 404;
                return { success: false, error: error.message };
            }
            console.error(`Error deleting shift pattern ${id}: ${error.message}`);
            set.status = 500;
            return { success: false, error: 'Failed to delete shift pattern' };
        }
    }, {
        params: IdParamSchema,
        detail: { summary: 'Delete a shift pattern', tags: ['ShiftPatterns'] }
    }); 