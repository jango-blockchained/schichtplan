// src/bun-backend/routes/shiftPatternRoutes.ts
import { Elysia, t } from 'elysia';
import {
    getAllShiftPatterns,
    getShiftPatternById,
    createShiftPattern,
    updateShiftPattern,
    deleteShiftPattern,
    CreateShiftPatternInput,
    UpdateShiftPatternInput
} from '../services/shiftPatternService.js'; // Use .js extension? Check resolution
import { NotFoundError } from 'elysia';

// --- Validation Schemas ---
const shiftPatternIdParamSchema = t.Object({
    id: t.Numeric({ minimum: 1, error: "Pattern ID must be a positive number." })
});

const createShiftPatternBodySchema = t.Object({
    name: t.String({ minLength: 1, error: "Pattern name is required." }),
    // Ensure it's an array, and ideally contains only numbers (can add deeper validation if needed)
    shift_template_ids: t.Array(t.Numeric({ minimum: 1 }), { minItems: 1, error: "shift_template_ids must be a non-empty array of positive numbers." })
});

const updateShiftPatternBodySchema = t.Partial(t.Object({
     name: t.String({ minLength: 1, error: "Pattern name cannot be empty if provided." }),
     shift_template_ids: t.Array(t.Numeric({ minimum: 1 }), { minItems: 1, error: "shift_template_ids must be a non-empty array of positive numbers if provided." })
}), {
    // Partial makes all fields optional. We might want validation like "at least one field must be present".
});


// --- Routes ---
export const shiftPatternRoutes = new Elysia({ prefix: '/api/shift-patterns' })

    // GET /api/shift-patterns
    .get('/', async ({ set }) => {
        try {
            const patterns = await getAllShiftPatterns();
            return patterns;
        } catch (error: any) {
            console.error(`GET /api/shift-patterns Error: ${error.message}`);
            set.status = 500;
            return { error: "Failed to fetch shift patterns" };
        }
    }, {
        detail: {
            summary: 'Get all Shift Patterns',
            description: 'Retrieves a list of all defined shift patterns.',
            tags: ['ShiftPatterns'], // Add tag for Swagger
        }
    })

    // GET /api/shift-patterns/:id
    .get('/:id', async ({ params, set }) => {
        try {
            const pattern = await getShiftPatternById(params.id);
            if (!pattern) {
                throw new NotFoundError('Shift pattern not found');
            }
            return pattern;
        } catch (error: any) {
            console.error(`GET /api/shift-patterns/${params.id} Error: ${error.message}`);
            if (error instanceof NotFoundError) {
                set.status = 404;
                return { error: error.message };
            }
            set.status = 500;
            return { error: "Failed to fetch shift pattern" };
        }
    }, {
        params: shiftPatternIdParamSchema,
        detail: {
            summary: 'Get Shift Pattern by ID',
            description: 'Retrieves details of a specific shift pattern.',
            tags: ['ShiftPatterns'],
        }
    })

    // POST /api/shift-patterns
    .post('/', async ({ body, set }) => {
        try {
            // Type assertion for safety when passing to service
            const newPattern = await createShiftPattern(body as CreateShiftPatternInput);
            set.status = 201;
            return newPattern;
        } catch (error: any) {
            console.error(`POST /api/shift-patterns Error: ${error.message}`);
            if (error.message?.includes('already exists')) {
                set.status = 409; // Conflict
                return { error: error.message };
            }
             if (error.message?.includes('Invalid input')) {
                set.status = 400; // Bad request (from service validation)
                return { error: error.message };
            }
            // Consider handling potential JSON parsing errors from the service if needed
            set.status = 500;
            return { error: "Failed to create shift pattern" };
        }
    }, {
        body: createShiftPatternBodySchema,
        detail: {
            summary: 'Create a new Shift Pattern',
            description: 'Creates a new shift pattern with a name and a list of shift template IDs.',
            tags: ['ShiftPatterns'],
        }
    })

    // PUT /api/shift-patterns/:id
    .put('/:id', async ({ params, body, set }) => {
        try {
             if (Object.keys(body).length === 0) {
                 set.status = 400;
                 return { error: "Request body cannot be empty for update." };
            }
            // Type assertion for safety
            const updatedPattern = await updateShiftPattern(params.id, body as UpdateShiftPatternInput);
             // updateShiftPattern throws if not found, so no need for explicit check here
            return updatedPattern;
        } catch (error: any) {
            console.error(`PUT /api/shift-patterns/${params.id} Error: ${error.message}`);
            if (error.message?.includes('not found')) {
                set.status = 404;
                return { error: error.message };
            }
            if (error.message?.includes('already exists')) {
                set.status = 409; // Conflict
                return { error: error.message };
            }
            set.status = 500;
            return { error: "Failed to update shift pattern" };
        }
    }, {
        params: shiftPatternIdParamSchema,
        body: updateShiftPatternBodySchema,
        detail: {
            summary: 'Update an existing Shift Pattern',
            description: 'Updates the name and/or the list of shift template IDs for a specific pattern.',
            tags: ['ShiftPatterns'],
        }
    })

    // DELETE /api/shift-patterns/:id
    .delete('/:id', async ({ params, set }) => {
        try {
            const deleted = await deleteShiftPattern(params.id);
            if (!deleted) {
                throw new NotFoundError('Shift pattern not found for deletion');
            }
            set.status = 204; // No Content
            return; // No body on successful delete
        } catch (error: any) {
            console.error(`DELETE /api/shift-patterns/${params.id} Error: ${error.message}`);
             if (error instanceof NotFoundError) {
                set.status = 404;
                return { error: error.message };
            }
            set.status = 500;
            return { error: "Failed to delete shift pattern" };
        }
    }, {
        params: shiftPatternIdParamSchema,
        detail: {
            summary: 'Delete a Shift Pattern',
            description: 'Deletes a specific shift pattern.',
            tags: ['ShiftPatterns'],
        }
    }); 