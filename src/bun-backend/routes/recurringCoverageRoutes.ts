import { Elysia, t } from 'elysia';
// Removed prisma import
// import { prisma } from '../lib/prisma';
import { 
    getAllRecurringCoverages,
    getRecurringCoverageById,
    createRecurringCoverage,
    updateRecurringCoverage,
    deleteRecurringCoverage,
    CreateRecurringCoverageInput, // Import input/output types
    UpdateRecurringCoverageInput
} from '../services/recurringCoverageService'; // Use .js extension for consistency?
import { NotFoundError } from 'elysia'; // Import standard Elysia error

// Reuse validation schema for request bodies/params
const recurringCoverageIdParamSchema = t.Object({
    id: t.Numeric() // Ensure id is a number
});

const createRecurringCoverageBodySchema = t.Object({
    shift_template_id: t.Numeric({ minimum: 1, error: "shift_template_id is required and must be a positive number." }),
    employee_id: t.Optional(t.Nullable(t.Numeric({ minimum: 1, error: "employee_id must be a positive number if provided." }))),
    recurrence_rule: t.String({ minLength: 1, error: "recurrence_rule is required." }),
    start_date: t.String({ format: 'date-time', error: 'Invalid start_date format (ISO 8601)' }),
    end_date: t.Optional(t.Nullable(t.String({ format: 'date-time', error: 'Invalid end_date format (ISO 8601)' }))),
    start_time: t.String({ pattern: '^\\d{2}:\\d{2}$', error: 'Invalid start_time format (HH:MM)' }),
    end_time: t.String({ pattern: '^\\d{2}:\\d{2}$', error: 'Invalid end_time format (HH:MM)' }),
    notes: t.Optional(t.Nullable(t.String())),
});

// Make all fields optional for update, keep original validation rules where applicable
const updateRecurringCoverageBodySchema = t.Partial(createRecurringCoverageBodySchema, {
     // No additional config needed for Partial, all fields become optional
});


export const recurringCoverageRoutes = new Elysia({ prefix: '/api/recurring-coverage' }) // Standardized prefix
  // --- GET /recurring-coverage --- // Standardized path
  .get('/', async ({ set }) => {
    try {
      const recurringCoverages = await getAllRecurringCoverages();
      return recurringCoverages;
    } catch (error: any) {
      console.error(`GET /api/recurring-coverage Error: ${error.message}`);
      set.status = 500;
      return { error: "Failed to fetch recurring coverage" };
    }
  }, {
       detail: {
            summary: 'Get all Recurring Coverage rules',
            description: 'Retrieves a list of all recurring coverage patterns.',
            tags: ['RecurringCoverage'],
        }
  })

  // --- GET /recurring-coverage/:id --- // Standardized path
  .get('/:id', async ({ params, set }) => {
    try {
      const recurringCoverage = await getRecurringCoverageById(params.id);
      if (!recurringCoverage) {
         throw new NotFoundError('Recurring coverage not found'); // Use Elysia's error
      }
      return recurringCoverage;
    } catch (error: any) {
      console.error(`GET /api/recurring-coverage/${params.id} Error: ${error.message}`);
      // Let the global error handler manage the response
       if (error instanceof NotFoundError) {
           set.status = 404;
           return { error: error.message };
       }
      set.status = 500;
      return { error: "Failed to fetch recurring coverage" };
    }
  }, {
      params: recurringCoverageIdParamSchema,
      detail: {
            summary: 'Get Recurring Coverage by ID',
            description: 'Retrieves details of a specific recurring coverage pattern.',
            tags: ['RecurringCoverage'],
        }
  })

  // --- POST /recurring-coverage --- // Standardized path
  .post('/', async ({ body, set }) => {
      try {
        // Body validation is handled by Elysia via the schema
        // Type assertion needed as Elysia's inferred body type might not exactly match service input type
        const newRecurringCoverage = await createRecurringCoverage(body as CreateRecurringCoverageInput);
        set.status = 201; // Created
        return newRecurringCoverage;
      } catch (error: any) {
        console.error(`POST /api/recurring-coverage Error: ${error.message}`);
        // Handle specific errors from the service (e.g., FK violation)
        if (error.message?.includes('Invalid')) { // Basic check for FK error message from service
            set.status = 400; // Bad Request
            return { error: error.message };
        }
        // Generic error
        set.status = 500;
        return { error: "Failed to create recurring coverage" };
      }
    },
    {
      body: createRecurringCoverageBodySchema,
      detail: {
        summary: 'Create a new Recurring Coverage rule',
        description: 'Creates a recurring coverage pattern based on an RRULE string.',
        tags: ['RecurringCoverage'],
      }
    }
  )

  // --- PUT /recurring-coverage/:id --- // Standardized path
  .put('/:id', async ({ params, body, set }) => {
      try {
        // Params and body validation handled by Elysia
        const updatedRecurringCoverage = await updateRecurringCoverage(params.id, body as UpdateRecurringCoverageInput);
        
        // updateRecurringCoverage now throws specific error if not found
        return updatedRecurringCoverage;

      } catch (error: any) {
        console.error(`PUT /api/recurring-coverage/${params.id} Error: ${error.message}`);
         // Handle specific errors from the service
        if (error.message?.includes('not found for update')) {
            set.status = 404;
            return { error: error.message };
        }
         if (error.message?.includes('Invalid')) { // Basic check for FK error
             set.status = 400; // Bad Request
             return { error: error.message };
         }
        // Generic error
        set.status = 500;
        return { error: "Failed to update recurring coverage" };
      }
    },
    {
       params: recurringCoverageIdParamSchema,
       body: updateRecurringCoverageBodySchema,
       detail: {
         summary: 'Update an existing Recurring Coverage rule',
         description: 'Updates details of a specific recurring coverage pattern.',
         tags: ['RecurringCoverage'],
       }
    }
  )

  // --- DELETE /recurring-coverage/:id --- // Standardized path
  .delete('/:id', async ({ params, set }) => {
    try {
      const deleted = await deleteRecurringCoverage(params.id);
      if (!deleted) {
         throw new NotFoundError('Recurring coverage not found for deletion');
      }
      set.status = 204; // No Content
      return; // Return nothing on successful deletion
    } catch (error: any) {
      console.error(`DELETE /api/recurring-coverage/${params.id} Error: ${error.message}`);
       // Handle specific errors (like NotFoundError)
       if (error instanceof NotFoundError) {
           set.status = 404;
           return { error: error.message };
       }
      // Generic error
      set.status = 500;
      return { error: "Failed to delete recurring coverage" };
    }
  },
  {
      params: recurringCoverageIdParamSchema,
      detail: {
         summary: 'Delete a Recurring Coverage rule',
         description: 'Deletes a specific recurring coverage pattern.',
         tags: ['RecurringCoverage'],
       }
  }); 