import db from "../db";
import { type EmployeeAvailability, AvailabilityType } from "../db/schema";
import { NotFoundError } from "elysia";

// Helper to map a raw database row to the EmployeeAvailability interface
function mapRowToEmployeeAvailability(row: any): EmployeeAvailability {
    if (!row) {
        throw new NotFoundError("EmployeeAvailability row not found.");
    }
    return {
        ...row,
        // Ensure boolean conversion
        is_recurring: Boolean(row.is_recurring),
        // Ensure correct enum type (assuming it's stored as string)
        availability_type: row.availability_type as AvailabilityType,
        // Keep dates as strings (ISO format)
    };
}

/**
 * Retrieves all availability entries for a specific employee.
 * @param employeeId - The ID of the employee.
 */
export async function getAvailabilitiesForEmployee(employeeId: number): Promise<EmployeeAvailability[]> {
    try {
        const query = db.query("SELECT * FROM employee_availability WHERE employee_id = ? ORDER BY day_of_week, hour;");
        const rows = query.all(employeeId) as any[];
        // Check if employee exists (implicitly, if rows are returned or not)
        // A more robust check might involve querying the employee table first
        return rows.map(mapRowToEmployeeAvailability);
    } catch (error) {
        console.error(`Error fetching availability for employee ${employeeId}:`, error);
        throw new Error("Failed to retrieve employee availability.");
    }
}

/**
 * Retrieves a single availability entry by its ID.
 * @param id - The ID of the availability entry.
 */
export async function getAvailabilityById(id: number): Promise<EmployeeAvailability> {
    try {
        const query = db.query("SELECT * FROM employee_availability WHERE id = ?;");
        const row = query.get(id) as any;
        if (!row) {
            throw new NotFoundError(`EmployeeAvailability with id ${id} not found.`);
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
 */
export async function addAvailability(data: CreateAvailabilityInput): Promise<EmployeeAvailability> {
    const { employee_id, day_of_week, hour, availability_type, start_date, end_date, is_recurring } = data;

    // Basic validation (more complex validation might be needed)
    if (day_of_week < 0 || day_of_week > 6) {
        throw new Error("Invalid day_of_week (must be 0-6).");
    }
    if (hour < 0 || hour > 23) {
        throw new Error("Invalid hour (must be 0-23).");
    }

    const is_recurring_int = is_recurring ? 1 : 0;
    const safe_start_date = start_date ?? null;
    const safe_end_date = end_date ?? null;

    const sql = `
        INSERT INTO employee_availability
          (employee_id, day_of_week, hour, availability_type, start_date, end_date, is_recurring, created_at, updated_at)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id;`;

    try {
        // TODO: Add check to ensure employee_id exists before inserting
        const stmt = db.prepare(sql);
        const result = stmt.get(
            employee_id,
            day_of_week,
            hour,
            availability_type,
            safe_start_date,
            safe_end_date,
            is_recurring_int
        ) as { id: number };

        if (!result || !result.id) {
            throw new Error("Failed to add availability, no ID returned.");
        }
        return getAvailabilityById(result.id);
    } catch (error) {
        console.error("Error adding availability:", error);
        // Catch potential foreign key constraint errors if employee_id is invalid
        throw new Error("Failed to add availability entry.");
    }
}

// Input type for updating availability (partial, omit id/generated)
type UpdateAvailabilityInput = Partial<Omit<EmployeeAvailability, 'id' | 'employee_id' | 'created_at' | 'updated_at'>>;

/**
 * Updates an existing availability entry.
 * @param id - The ID of the availability entry to update.
 * @param data - The fields to update.
 */
export async function updateAvailability(id: number, data: UpdateAvailabilityInput): Promise<EmployeeAvailability> {
    // Check if exists first
    await getAvailabilityById(id); // Throws NotFoundError if not found

    const updates: Record<string, any> = {};

    // Prepare updates, handling specific conversions
    for (const [key, value] of Object.entries(data)) {
        if (value === undefined) continue; // Skip undefined fields

        if (key === 'is_recurring') {
            updates[key] = value ? 1 : 0;
        } else if (key === 'start_date' || key === 'end_date') {
            updates[key] = value ?? null; // Ensure null if explicitly set
        } else if (key === 'day_of_week' && (value < 0 || value > 6)) {
            throw new Error("Invalid day_of_week (must be 0-6).");
        } else if (key === 'hour' && (value < 0 || value > 23)) {
            throw new Error("Invalid hour (must be 0-23).");
        } else {
            updates[key] = value;
        }
    }

    if (Object.keys(updates).length === 0) {
        return getAvailabilityById(id); // No changes provided
    }

    // Build the SQL query dynamically
    updates.updated_at = "CURRENT_TIMESTAMP"; // Always update timestamp
    const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(", ");
    const values = Object.values(updates);

    const sql = `UPDATE employee_availability SET ${setClauses} WHERE id = ?;`;

    try {
        const stmt = db.prepare(sql);
        stmt.run(...values, id);

        // Fetch and return the updated entry
        return getAvailabilityById(id);
    } catch (error) {
        console.error(`Error updating availability ${id}:`, error);
        throw new Error("Failed to update availability entry.");
    }
}

/**
 * Deletes an availability entry by its ID.
 * @param id - The ID of the availability entry to delete.
 */
export async function deleteAvailability(id: number): Promise<{ success: boolean }> {
    // Check if exists first
    await getAvailabilityById(id); // Throws NotFoundError if not found

    const sql = "DELETE FROM employee_availability WHERE id = ?;";
    try {
        const stmt = db.prepare(sql);
        stmt.run(id);
        return { success: true };
    } catch (error) {
        console.error(`Error deleting availability ${id}:`, error);
        throw new Error("Failed to delete availability entry.");
    }
} 