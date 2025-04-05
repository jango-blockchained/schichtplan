import { Elysia, t, NotFoundError } from "elysia";
import {
    getAvailabilitiesForEmployee,
    getAvailabilityById,
    addAvailability,
    updateAvailability,
    deleteAvailability,
} from "../services/employeeAvailabilityService";
import { AvailabilityType } from "../db/schema"; // Enum for validation

// --- Schemas --- //

const EmployeeIdParamSchema = t.Object({
    employeeId: t.Numeric({ minimum: 1, description: "Employee ID" }),
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

export const employeeAvailabilityRoutes = new Elysia({ prefix: "/api/employees/:employeeId/availability" })
    // GET availability for a specific employee
    .get("/", async ({ params, set }) => {
        try {
            // TODO: Validate employeeId exists before fetching?
            const availabilities = await getAvailabilitiesForEmployee(params.employeeId);
            return availabilities;
        } catch (error: any) {
            console.error(`Error fetching availability for employee ${params.employeeId}: ${error.message}`);
            set.status = 500;
            return { error: "Failed to retrieve employee availability" };
        }
    }, {
        params: EmployeeIdParamSchema,
    })

    // POST new availability for a specific employee
    .post("/", async ({ params, body, set }) => {
        try {
            // Combine employeeId from params with body data
            const availabilityData = {
                ...body,
                employee_id: params.employeeId,
            };
            const newAvailability = await addAvailability(availabilityData);
            set.status = 201;
            return newAvailability;
        } catch (error: any) {
            console.error(`Error adding availability for employee ${params.employeeId}: ${error.message}`);
            // Handle potential errors like employee not found (if service checks)
            set.status = 500; // Or 400 if validation fails earlier
            return { error: "Failed to add availability entry" };
        }
    }, {
        params: EmployeeIdParamSchema,
        body: CreateAvailabilitySchema,
    });

// Separate route group for actions on a specific availability ID
export const availabilityRoutes = new Elysia({ prefix: "/api/availability" })
    // PUT update specific availability entry
    .put("/:id", async ({ params, body, set }) => {
        try {
            const updated = await updateAvailability(params.id, body);
            return updated;
        } catch (error: any) {
            if (error instanceof NotFoundError) {
                set.status = 404;
                return { error: error.message };
            }
            console.error(`Error updating availability ${params.id}: ${error.message}`);
            set.status = 500; // Or 400 if validation fails
            return { error: "Failed to update availability entry" };
        }
    }, {
        params: AvailabilityIdParamSchema,
        body: UpdateAvailabilitySchema,
    })

    // DELETE specific availability entry
    .delete("/:id", async ({ params, set }) => {
        try {
            await deleteAvailability(params.id);
            set.status = 204; // No Content
            return;
        } catch (error: any) {
            if (error instanceof NotFoundError) {
                set.status = 404;
                return { error: error.message };
            }
            console.error(`Error deleting availability ${params.id}: ${error.message}`);
            set.status = 500;
            return { error: "Failed to delete availability entry" };
        }
    }, {
        params: AvailabilityIdParamSchema,
    }); 