import globalDb from "../db";
import { Database } from "bun:sqlite";
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
 * @param db - Optional Database instance.
 */
export async function getAbsencesForEmployee(
    employeeId: number,
    db: Database = globalDb // Added db param
): Promise<Absence[]> {
    const sql = "SELECT * FROM absences WHERE employee_id = ? ORDER BY start_date;";
    try {
        const query = db.query(sql); // Use db
        const rows = query.all(employeeId) as any[];
        return rows.map(mapRowToAbsence);
    } catch (error) {
        console.error(`Error fetching absences for employee ${employeeId}:`, error);
        throw new Error("Failed to retrieve employee absences.");
    }
}

/**
 * Retrieves a single absence entry by its ID.
 * @param id - The ID of the absence entry.
 * @param db - Optional Database instance.
 */
export async function getAbsenceById(
    id: number,
    db: Database = globalDb // Added db param
): Promise<Absence> {
    const sql = "SELECT * FROM absences WHERE id = ?;";
    try {
        const query = db.query(sql); // Use db
        const row = query.get(id) as any;
        if (!row) {
            throw new NotFoundError(`Absence entry with id ${id} not found.`);
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
 * @param db - Optional Database instance.
 */
export async function addAbsence(
    data: CreateAbsenceInput,
    db: Database = globalDb // Added db param
): Promise<Absence> {
    const { employee_id, absence_type_id, start_date, end_date, note } = data;

    // Basic validation
    // TODO: Validate employee_id and absence_type_id exist?
    // TODO: Validate start_date <= end_date

    const sql = `
        INSERT INTO absences (employee_id, absence_type_id, start_date, end_date, note, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));`;
    
    try {
        db.transaction(() => { // Use db
            const stmt = db.prepare(sql);
            stmt.run(employee_id, absence_type_id, start_date, end_date, note ?? null);
        })();
        const idQuery = db.query("SELECT last_insert_rowid() as id;"); // Use db
        const result = idQuery.get() as { id: number | bigint };
        const lastId = result?.id;
        if (!lastId) throw new Error("Failed to get ID after absence insert.");
        return getAbsenceById(Number(lastId), db); // Pass db
    } catch (error) {
        console.error("Error adding absence:", error);
        throw new Error("Failed to add absence entry.");
    }
}

// Input type for updating absence (partial, omit id/generated)
type UpdateAbsenceInput = Partial<Omit<Absence, 'id' | 'employee_id' | 'created_at' | 'updated_at'>>;

/**
 * Updates an existing absence entry.
 * @param id - The ID of the absence entry to update.
 * @param data - The fields to update.
 * @param db - Optional Database instance.
 */
export async function updateAbsence(
    id: number,
    data: UpdateAbsenceInput,
    db: Database = globalDb // Added db param
): Promise<Absence> {
    await getAbsenceById(id, db); // Check existence using db

    const updates: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
             // Ensure null is passed correctly if provided for nullable fields
             updates[key] = (key === 'note' && value === null) ? null : value;
        }
    }

    if (Object.keys(updates).length === 0) {
        return getAbsenceById(id, db); // Use db
    }

    updates.updated_at = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
    const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(", ");
    const values = Object.values(updates);
    const sql = `UPDATE absences SET ${setClauses} WHERE id = ?;`;

    try {
        const stmt = db.prepare(sql); // Use db
        stmt.run(...values, id);
        return getAbsenceById(id, db); // Use db
    } catch (error) {
        console.error(`Error updating absence ${id}:`, error);
        throw new Error("Failed to update absence entry.");
    }
}

/**
 * Deletes an absence entry by its ID.
 * @param id - The ID of the absence entry to delete.
 * @param db - Optional Database instance.
 */
export async function deleteAbsence(
    id: number,
    db: Database = globalDb // Added db param
): Promise<{ success: boolean }> {
    await getAbsenceById(id, db); // Check existence using db
    const sql = "DELETE FROM absences WHERE id = ?;";
    try {
        const stmt = db.prepare(sql); // Use db
        const info = stmt.run(id);
        if (info.changes === 0) throw new Error(`Delete failed unexpectedly for absence ${id}.`);
        return { success: true };
    } catch (error) {
        console.error(`Error deleting absence ${id}:`, error);
        if (error instanceof NotFoundError) throw error; 
        throw new Error("Failed to delete absence entry.");
    }
}

/**
 * Retrieves all absence entries that overlap with a given date range.
 * @param startDate - The start date of the range (YYYY-MM-DD).
 * @param endDate - The end date of the range (YYYY-MM-DD).
 * @param db - Optional Database instance.
 */
export async function getAbsencesInRange(
    startDate: string,
    endDate: string,
    db: Database = globalDb // Added db param
): Promise<Absence[]> {
    const sql = `
        SELECT * FROM absences
        WHERE start_date <= ? -- Absence starts on or before the range ends
          AND end_date >= ?   -- Absence ends on or after the range starts
        ORDER BY employee_id, start_date;
    `;
    try {
        const query = db.query(sql); // Use db
        const rows = query.all(endDate, startDate) as any[]; 
        return rows.map(mapRowToAbsence);
    } catch (error) {
        console.error(`Error fetching absences in range ${startDate} - ${endDate}:`, error);
        throw new Error("Failed to retrieve absences in range.");
    }
} 