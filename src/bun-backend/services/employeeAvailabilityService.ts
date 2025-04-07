import globalDb from "../db";
import { Database } from "bun:sqlite";
import { type EmployeeAvailability, AvailabilityType } from "../db/schema";
import { NotFoundError } from "elysia";

// Helper to map a raw database row to the EmployeeAvailability interface
function mapRowToEmployeeAvailability(row: any): EmployeeAvailability {
    if (!row) {
        throw new NotFoundError("EmployeeAvailability row not found during mapping.");
    }
    return {
        id: row.id,
        employee_id: row.employee_id,
        day_of_week: row.day_of_week,
        hour: row.hour,
        availability_type: row.availability_type as AvailabilityType,
        start_date: row.start_date ?? null,
        end_date: row.end_date ?? null,
        is_recurring: Boolean(row.is_recurring),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

/**
 * Retrieves all availability entries for a specific employee.
 * @param employeeId - The ID of the employee.
 * @param db - Optional Database instance.
 */
export async function getAvailabilitiesForEmployee(
    employeeId: number,
    db: Database = globalDb
): Promise<EmployeeAvailability[]> {
    const sql = "SELECT * FROM employee_availabilities WHERE employee_id = ? ORDER BY day_of_week, hour;";
    try {
        const query = db.query(sql);
        const rows = query.all(employeeId) as any[];
        return rows.map(mapRowToEmployeeAvailability);
    } catch (error) {
        console.error(`Error fetching availabilities for employee ${employeeId}:`, error);
        throw new Error("Failed to retrieve employee availabilities.");
    }
}

/**
 * Retrieves a single availability entry by its ID.
 * @param id - The ID of the availability entry.
 * @param db - Optional Database instance.
 */
export async function getAvailabilityById(
    id: number,
    db: Database = globalDb
): Promise<EmployeeAvailability> {
    const sql = "SELECT * FROM employee_availabilities WHERE id = ?;";
    try {
        const query = db.query(sql);
        const row = query.get(id) as any;
        if (!row) {
            throw new NotFoundError(`Availability entry with id ${id} not found.`);
        }
        return mapRowToEmployeeAvailability(row);
    } catch (error) {
        console.error(`Error fetching availability ${id}:`, error);
        if (error instanceof NotFoundError) throw error;
        throw new Error("Failed to retrieve availability entry.");
    }
}

// Input type for creating a new availability entry (omit generated fields)
type CreateAvailabilityInput = Omit<EmployeeAvailability, 'id' | 'created_at' | 'updated_at'>;

/**
 * Adds a new availability entry for an employee.
 * @param data - The availability data.
 * @param db - Optional Database instance.
 */
export async function addAvailability(
    data: CreateAvailabilityInput,
    db: Database = globalDb
): Promise<EmployeeAvailability> {
    const { employee_id, day_of_week, hour, availability_type, start_date, end_date, is_recurring } = data;

    // Basic validation
    if (day_of_week < 0 || day_of_week > 6) throw new Error("Invalid day_of_week (must be 0-6).");
    if (hour < 0 || hour > 23) throw new Error("Invalid hour (must be 0-23).");
    // TODO: Validate employee_id exists in employees table?

    const is_recurring_int = is_recurring ? 1 : 0;
    const safe_start_date = start_date ?? null;
    const safe_end_date = end_date ?? null;

    const sql = `
        INSERT INTO employee_availabilities
          (employee_id, day_of_week, hour, availability_type, start_date, end_date, is_recurring, created_at, updated_at)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));`;

    try {
        db.transaction(() => {
            const stmt = db.prepare(sql);
            stmt.run(
                employee_id,
                day_of_week,
                hour,
                availability_type,
                safe_start_date,
                safe_end_date,
                is_recurring_int
            );
        })();
        const idQuery = db.query("SELECT last_insert_rowid() as id;");
        const result = idQuery.get() as { id: number | bigint };
        const lastId = result?.id;
        if (!lastId) throw new Error("Failed to get ID after insert.");
        
        return getAvailabilityById(Number(lastId), db);

    } catch (error) {
        console.error("Error adding availability:", error);
        // TODO: Catch potential foreign key constraint errors
        throw new Error("Failed to add availability entry.");
    }
}

// Input type for updating availability (partial, omit id/generated)
type UpdateAvailabilityInput = Partial<Omit<EmployeeAvailability, 'id' | 'employee_id' | 'created_at' | 'updated_at'>>;

/**
 * Updates an existing availability entry.
 * @param id - The ID of the availability entry to update.
 * @param data - The fields to update.
 * @param db - Optional Database instance.
 */
export async function updateAvailability(
    id: number,
    data: UpdateAvailabilityInput,
    db: Database = globalDb
): Promise<EmployeeAvailability> {
    await getAvailabilityById(id, db); // Check existence using db

    const updates: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
        if (value === undefined) continue;
        if (key === 'is_recurring') updates[key] = value ? 1 : 0;
        else if (key === 'start_date' || key === 'end_date') updates[key] = value ?? null;
        else if (key === 'day_of_week' && (typeof value !== 'number' || value < 0 || value > 6)) throw new Error("Invalid day_of_week.");
        else if (key === 'hour' && (typeof value !== 'number' || value < 0 || value > 23)) throw new Error("Invalid hour.");
        else updates[key] = value;
    }

    if (Object.keys(updates).length === 0) {
        return getAvailabilityById(id, db); // Use db
    }

    updates.updated_at = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
    const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(", ");
    const values = Object.values(updates);

    const sql = `UPDATE employee_availabilities SET ${setClauses} WHERE id = ?;`;

    try {
        const stmt = db.prepare(sql); // Use db
        stmt.run(...values, id);
        return getAvailabilityById(id, db); // Use db
    } catch (error) {
        console.error(`Error updating availability ${id}:`, error);
        throw new Error("Failed to update availability entry.");
    }
}

/**
 * Deletes an availability entry by its ID.
 * @param id - The ID of the availability entry to delete.
 * @param db - Optional Database instance.
 */
export async function deleteAvailability(
    id: number,
    db: Database = globalDb
): Promise<{ success: boolean }> {
    await getAvailabilityById(id, db); // Check existence using db
    const sql = "DELETE FROM employee_availabilities WHERE id = ?;";
    try {
        const stmt = db.prepare(sql); // Use db
        const info = stmt.run(id);
        if (info.changes === 0) throw new Error(`Delete failed unexpectedly for availability ${id}.`);
        return { success: true };
    } catch (error) {
        console.error(`Error deleting availability ${id}:`, error);
        if (error instanceof NotFoundError) throw error; 
        throw new Error("Failed to delete availability.");
    }
}

/**
 * Retrieves all availability entries relevant within a given date range.
 * @param startDate - The start date of the range (YYYY-MM-DD).
 * @param endDate - The end date of the range (YYYY-MM-DD).
 * @param db - Optional Database instance.
 */
export async function getAvailabilitiesInRange(
    startDate: string, 
    endDate: string,
    db: Database = globalDb
): Promise<EmployeeAvailability[]> {
    // Corrected SQL to handle date ranges and recurring entries
    const sql = `
        SELECT *
        FROM employee_availabilities
        WHERE
            -- Include recurring entries
            is_recurring = 1
            OR
            -- Include non-recurring entries that overlap with the date range
            (is_recurring = 0 AND start_date IS NOT NULL AND (
                (start_date <= ?1 AND (end_date IS NULL OR end_date >= ?1)) OR -- Starts before/in range, ends in/after range
                (start_date >= ?1 AND start_date <= ?2) -- Starts within the range
            ))
        ORDER BY employee_id, day_of_week, hour;
    `;
    try {
        const query = db.query(sql); // Use db
        // Pass date parameters twice for the OR condition
        const rows = query.all(endDate, startDate, startDate, endDate) as any[]; 
        return rows.map(mapRowToEmployeeAvailability);
    } catch (error) {
        console.error(`Error fetching availabilities in range ${startDate} - ${endDate}:`, error);
        throw new Error("Failed to retrieve availabilities in range.");
    }
} 