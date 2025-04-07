import db from "../db";
import { type Absence } from "../db/schema";
import { NotFoundError } from "elysia";
// TODO: Potentially import settings service to validate absence_type_id if needed

// Helper to map a raw database row to the Absence interface
function mapRowToAbsence(row: any): Absence {
    if (!row) {
        throw new NotFoundError("Absence row not found.");
    }
    // No boolean or JSON fields to convert in basic Absence model
    // Dates are already strings
    return {
        ...row,
        // Ensure absence_type_id is a string (it should be already)
        absence_type_id: String(row.absence_type_id),
    } as Absence; // Cast to ensure type compliance
}

/**
 * Retrieves all absence entries for a specific employee.
 * @param employeeId - The ID of the employee.
 */
export async function getAbsencesForEmployee(employeeId: number): Promise<Absence[]> {
    try {
        // Order by start date for logical listing
        const query = db.query("SELECT * FROM absences WHERE employee_id = ? ORDER BY start_date;");
        const rows = query.all(employeeId) as any[];
        // Add check if employee exists?
        return rows.map(mapRowToAbsence);
    } catch (error) {
        console.error(`Error fetching absences for employee ${employeeId}:`, error);
        throw new Error("Failed to retrieve employee absences.");
    }
}

/**
 * Retrieves a single absence entry by its ID.
 * @param id - The ID of the absence entry.
 */
export async function getAbsenceById(id: number): Promise<Absence> {
    try {
        const query = db.query("SELECT * FROM absences WHERE id = ?;");
        const row = query.get(id) as any;
        if (!row) {
            throw new NotFoundError(`Absence with id ${id} not found.`);
        }
        return mapRowToAbsence(row);
    } catch (error) {
        console.error(`Error fetching absence ${id}:`, error);
        if (error instanceof NotFoundError) throw error;
        throw new Error("Failed to retrieve absence entry.");
    }
}

// Input type for creating a new absence entry
type CreateAbsenceInput = Omit<Absence, 'id' | 'created_at' | 'updated_at'>;

/**
 * Adds a new absence entry for an employee.
 * @param data - The absence data.
 */
export async function addAbsence(data: CreateAbsenceInput): Promise<Absence> {
    const { employee_id, absence_type_id, start_date, end_date, note } = data;

    // Basic validation (dates, existence of absence_type_id in settings?)
    // TODO: Add check that start_date <= end_date?
    // TODO: Add check that absence_type_id is valid based on settings?

    const safe_note = note ?? null;

    const sql = `
        INSERT INTO absences
          (employee_id, absence_type_id, start_date, end_date, note, created_at, updated_at)
        VALUES
          (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id;`;

    try {
        // TODO: Add check to ensure employee_id exists
        const stmt = db.prepare(sql);
        const result = stmt.get(
            employee_id,
            absence_type_id,
            start_date,
            end_date,
            safe_note
        ) as { id: number };

        if (!result || !result.id) {
            throw new Error("Failed to add absence, no ID returned.");
        }
        return getAbsenceById(result.id);
    } catch (error) {
        console.error("Error adding absence:", error);
        // Catch potential foreign key constraint errors
        throw new Error("Failed to add absence entry.");
    }
}

// Input type for updating absence (partial, omit id/generated)
type UpdateAbsenceInput = Partial<Omit<Absence, 'id' | 'employee_id' | 'created_at' | 'updated_at'>>;

/**
 * Updates an existing absence entry.
 * @param id - The ID of the absence entry to update.
 * @param data - The fields to update.
 */
export async function updateAbsence(id: number, data: UpdateAbsenceInput): Promise<Absence> {
    // Check if exists first
    await getAbsenceById(id); // Throws NotFoundError if not found

    const updates: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
        if (value === undefined) continue; // Skip undefined fields

        // Handle specific fields if needed (e.g., validation)
        if (key === 'note') {
            updates[key] = value ?? null;
        } else {
            updates[key] = value;
            // TODO: Add validation for start_date <= end_date if both are updated?
            // TODO: Validate absence_type_id against settings?
        }
    }

    if (Object.keys(updates).length === 0) {
        return getAbsenceById(id); // No changes provided
    }

    // Build the SQL query dynamically
    updates.updated_at = "CURRENT_TIMESTAMP"; // Always update timestamp
    const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(", ");
    const values = Object.values(updates);

    const sql = `UPDATE absences SET ${setClauses} WHERE id = ?;`;

    try {
        const stmt = db.prepare(sql);
        stmt.run(...values, id);

        // Fetch and return the updated entry
        return getAbsenceById(id);
    } catch (error) {
        console.error(`Error updating absence ${id}:`, error);
        throw new Error("Failed to update absence entry.");
    }
}

/**
 * Deletes an absence entry by its ID.
 * @param id - The ID of the absence entry to delete.
 */
export async function deleteAbsence(id: number): Promise<{ success: boolean }> {
    // Check if exists first
    await getAbsenceById(id); // Throws NotFoundError if not found

    const sql = "DELETE FROM absences WHERE id = ?;";
    try {
        const stmt = db.prepare(sql);
        stmt.run(id);
        return { success: true };
    } catch (error) {
        console.error(`Error deleting absence ${id}:`, error);
        throw new Error("Failed to delete absence entry.");
    }
}

/**
 * Retrieves all absence entries that overlap with a given date range for all employees.
 * @param startDate - The start date of the range (YYYY-MM-DD).
 * @param endDate - The end date of the range (YYYY-MM-DD).
 */
export async function getAbsencesInRange(startDate: string, endDate: string): Promise<Absence[]> {
    // An absence overlaps the range if:
    // - Absence starts before or on the range end AND absence ends after or on the range start
    const sql = `
        SELECT *
        FROM absences
        WHERE
            start_date <= ? AND end_date >= ?
        ORDER BY employee_id, start_date;
    `;

    try {
        const query = db.query(sql);
        // Parameters for the overlap check: range end date, range start date
        const rows = query.all(endDate, startDate) as any[];
        return rows.map(mapRowToAbsence);
    } catch (error) {
        console.error(`Error fetching absences in range ${startDate} - ${endDate}:`, error);
        throw new Error("Failed to retrieve absences for the specified range.");
    }
} 