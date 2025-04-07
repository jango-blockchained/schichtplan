import { Elysia, t, NotFoundError } from "elysia";
import {
    getAbsencesForEmployee,
    getAbsenceById,
    addAbsence,
    updateAbsence,
    deleteAbsence,
} from "../services/absenceService";
// No enum needed here unless absence_type_id comes from a strict list

// --- Schemas --- //

const EmployeeIdParamSchema = t.Object({
    employeeId: t.Numeric({ minimum: 1, description: "Employee ID" }),
});

const AbsenceIdParamSchema = t.Object({
    id: t.Numeric({ minimum: 1, description: "Absence Entry ID" }),
});

// Schema for creating absence (POST body)
// employee_id comes from URL
const CreateAbsenceSchema = t.Object({
    absence_type_id: t.String({ description: "Identifier for the type of absence (e.g., 'URL', 'KRANK')" }),
    start_date: t.String({ format: "date", description: "Start date YYYY-MM-DD" }),
    end_date: t.String({ format: "date", description: "End date YYYY-MM-DD" }),
    note: t.Optional(t.Nullable(t.String())),
    // TODO: Add validation: start_date <= end_date
});

// Schema for updating absence (PUT body - partial)
const UpdateAbsenceSchema = t.Partial(t.Object({
    absence_type_id: t.Optional(t.String()),
    start_date: t.Optional(t.String({ format: "date" })),
    end_date: t.Optional(t.String({ format: "date" })),
    note: t.Optional(t.Nullable(t.String())),
    // TODO: Add validation: start_date <= end_date if both present
}));

// --- Routes --- //

// Nested routes under employee
export const employeeAbsenceRoutes = new Elysia({ prefix: "/api/employees/:employeeId/absences" })
    // GET absences for a specific employee
    .get("/", async ({ params, set }) => {
        try {
            // TODO: Validate employeeId exists?
            const absences = await getAbsencesForEmployee(params.employeeId);
            return absences;
        } catch (error: any) {
            console.error(`Error fetching absences for employee ${params.employeeId}: ${error.message}`);
            set.status = 500;
            return { error: "Failed to retrieve employee absences" };
        }
    }, {
        params: EmployeeIdParamSchema,
    })

    // POST new absence for a specific employee
    .post("/", async ({ params, body, set }) => {
        try {
            const absenceData = {
                ...body,
                employee_id: params.employeeId,
            };
            const newAbsence = await addAbsence(absenceData);
            set.status = 201;
            return newAbsence;
        } catch (error: any) {
            console.error(`Error adding absence for employee ${params.employeeId}: ${error.message}`);
            set.status = 500; // Or 400 if validation fails
            return { error: "Failed to add absence entry" };
        }
    }, {
        params: EmployeeIdParamSchema,
        body: CreateAbsenceSchema,
    });

// Top-level routes for specific absence ID actions
export const absenceRoutes = new Elysia({ prefix: "/api/absences" })
    // GET specific absence by ID (Optional, often not needed if fetched via employee)
    // .get("/:id", ...) 

    // PUT update specific absence entry
    .put("/:id", async ({ params, body, set }) => {
        try {
            const updated = await updateAbsence(params.id, body);
            return updated;
        } catch (error: any) {
            if (error instanceof NotFoundError) {
                set.status = 404;
                return { error: error.message };
            }
            console.error(`Error updating absence ${params.id}: ${error.message}`);
            set.status = 500; // Or 400 if validation fails
            return { error: "Failed to update absence entry" };
        }
    }, {
        params: AbsenceIdParamSchema,
        body: UpdateAbsenceSchema,
    })

    // DELETE specific absence entry
    .delete("/:id", async ({ params, set }) => {
        try {
            await deleteAbsence(params.id);
            set.status = 204; // No Content
            return;
        } catch (error: any) {
            if (error instanceof NotFoundError) {
                set.status = 404;
                return { error: error.message };
            }
            console.error(`Error deleting absence ${params.id}: ${error.message}`);
            set.status = 500;
            return { error: "Failed to delete absence entry" };
        }
    }, {
        params: AbsenceIdParamSchema,
    }); 