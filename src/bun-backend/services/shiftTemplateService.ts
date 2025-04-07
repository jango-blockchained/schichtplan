import db from "../db";
// Import ShiftType as a value, not just a type
import { type ShiftTemplate, type ActiveDays, ShiftType } from "../db/schema";
import { NotFoundError } from "elysia";
// Import getSettings if needed to determine shift_type dynamically
// import { getSettings } from "./settingsService";

// Helper to safely parse JSON columns, returning default if null/invalid
function safeJsonParse<T>(jsonString: string | null | undefined, defaultValue: T): T {
    if (!jsonString) return defaultValue;
    try {
        return JSON.parse(jsonString) as T;
    } catch (e) {
        console.error("Failed to parse JSON:", e, "String:", jsonString);
        return defaultValue;
    }
}

// Helper to calculate duration in hours between two HH:MM times
function calculateDurationHours(startTime: string, endTime: string): number {
    try {
        const [startH, startM] = startTime.split(":").map(Number);
        const [endH, endM] = endTime.split(":").map(Number);

        const startDate = new Date(0, 0, 0, startH, startM);
        let endDate = new Date(0, 0, 0, endH, endM);

        // Handle overnight shifts (e.g., 22:00 - 06:00)
        if (endDate <= startDate) {
            endDate.setDate(endDate.getDate() + 1);
        }

        const durationMillis = endDate.getTime() - startDate.getTime();
        const durationHours = durationMillis / (1000 * 60 * 60);
        return Math.round(durationHours * 100) / 100; // Round to 2 decimal places
    } catch (e) {
        console.error("Error calculating duration:", e);
        return 0; // Default or throw error?
    }
}

// Helper: Placeholder for determining shift type based on time and settings
// In a real implementation, this would fetch settings and compare times
function determineShiftType(startTime: string, endTime: string): ShiftType {
    // TODO: Implement logic using getSettings() -> settings.shift_types
    const [startH] = startTime.split(":").map(Number);
    if (startH < 10) return ShiftType.EARLY; // Use enum member
    if (startH >= 18) return ShiftType.LATE;   // Use enum member
    return ShiftType.MIDDLE; // Use enum member
}

// Helper to parse the active_days JSON string
function parseActiveDays(jsonString: string | null | undefined): ActiveDays {
    if (!jsonString) return {};
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.error("Failed to parse active_days JSON:", e);
        return {};
    }
}

// Helper to map a raw database row to the ShiftTemplate interface
function mapRowToShiftTemplate(row: any): ShiftTemplate {
    if (!row) {
        throw new NotFoundError("ShiftTemplate row not found.");
    }
    return {
        id: row.id,
        start_time: row.start_time,
        end_time: row.end_time,
        duration_hours: row.duration_hours,
        requires_break: Boolean(row.requires_break),
        shift_type: row.shift_type,
        shift_type_id: row.shift_type_id,
        active_days: parseActiveDays(row.active_days),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

/**
 * Retrieves all shift templates.
 */
export async function getAllShiftTemplates(): Promise<ShiftTemplate[]> {
    try {
        const query = db.query("SELECT * FROM shift_templates ORDER BY start_time;");
        const rows = query.all() as any[];
        return rows.map(mapRowToShiftTemplate);
    } catch (error) {
        console.error("Error fetching all shift templates:", error);
        throw new Error("Failed to retrieve shift templates.");
    }
}

/**
 * Retrieves a single shift template by its ID.
 * @param id - The ID of the shift template.
 */
export async function getShiftTemplateById(id: number): Promise<ShiftTemplate> {
    try {
        const query = db.query("SELECT * FROM shift_templates WHERE id = ?;");
        const row = query.get(id) as any;
        if (!row) {
            throw new NotFoundError(`ShiftTemplate with id ${id} not found.`);
        }
        return mapRowToShiftTemplate(row);
    } catch (error) {
        console.error(`Error fetching shift template ${id}:`, error);
        if (error instanceof NotFoundError) throw error;
        throw new Error("Failed to retrieve shift template.");
    }
}

// Define input type for creating a new ShiftTemplate (omit calculated/generated fields)
// Base input from API might not include shift_type, but service adds it
// Use Omit to exclude computed/db-generated fields
type CreateShiftTemplateInput = Omit<ShiftTemplate, 'id' | 'duration_hours' | 'created_at' | 'updated_at'>;

/**
 * Creates a new shift template.
 * @param data - The data for the new shift template.
 */
export async function createShiftTemplate(data: CreateShiftTemplateInput): Promise<ShiftTemplate> {
    const { start_time, end_time, requires_break, shift_type, shift_type_id, active_days } = data;

    // Calculate derived fields
    const duration_hours = calculateDurationHours(start_time, end_time);
    // Use provided shift_type, or determine if needed (using placeholder for now)
    const final_shift_type = shift_type || determineShiftType(start_time, end_time);
    const requires_break_int = requires_break ? 1 : 0;
    const active_days_json = JSON.stringify(active_days);
    // Ensure shift_type_id is null if undefined or null
    const safe_shift_type_id = shift_type_id ?? null;

    const sql = `
        INSERT INTO shift_templates
          (start_time, end_time, duration_hours, requires_break, shift_type, shift_type_id, active_days, created_at, updated_at)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        RETURNING id;`; // Use datetime('now') for SQLite standard timestamp

    try {
        const stmt = db.prepare(sql);
        // Pass safe_shift_type_id which is guaranteed to be string or null
        const result = stmt.get(start_time, end_time, duration_hours, requires_break_int, final_shift_type, safe_shift_type_id, active_days_json) as { id: number };

        if (!result || !result.id) {
            throw new Error("Failed to create shift template, no ID returned.");
        }
        console.log(`Shift template created with ID: ${result.id}`);
        // Fetch the newly created template to return the full object
        return getShiftTemplateById(result.id);
    } catch (error) {
        console.error("Error creating shift template:", error);
        // TODO: Add more specific error handling (e.g., UNIQUE constraint violation?)
        throw new Error("Failed to create shift template in database.");
    }
}

// Define input type for updating (all fields optional, except id is required via param)
// Use Partial and Omit
type UpdateShiftTemplateInput = Partial<Omit<ShiftTemplate, 'id' | 'duration_hours' | 'created_at' | 'updated_at'> & { shift_type_id?: string | null }>; // Explicitly allow null for shift_type_id update

/**
 * Updates an existing shift template.
 * @param id - The ID of the shift template to update.
 * @param data - An object containing the fields to update.
 */
export async function updateShiftTemplate(id: number, data: UpdateShiftTemplateInput): Promise<ShiftTemplate> {
    // Fetch existing to calculate duration if times change and ensure it exists
    const existing = await getShiftTemplateById(id); // Throws NotFoundError if not found

    const updates: Record<string, any> = {};
    let requiresDurationRecalc = false;

    // Prepare updates, handling specific conversions
    for (const [key, value] of Object.entries(data)) {
        if (value === undefined) continue; // Skip undefined fields

        // Use a switch for clarity and type safety
        switch (key as keyof UpdateShiftTemplateInput) {
            case 'active_days':
                updates[key] = JSON.stringify(value);
                break;
            case 'requires_break':
                updates[key] = value ? 1 : 0;
                break;
            case 'start_time':
            case 'end_time':
                updates[key] = value;
                requiresDurationRecalc = true;
                break;
            case 'shift_type_id':
                 // Ensure null is passed correctly if intended
                 updates[key] = value === null ? null : value;
                 break;
            // Add other fields that need specific handling (like shift_type if determined)
            default:
                // Directly assign other valid fields
                if (key in existing && key !== 'id' && key !== 'created_at' && key !== 'updated_at' && key !== 'duration_hours') {
                     updates[key] = value;
                }
        }
    }

    if (Object.keys(updates).length === 0) {
        console.log(`No valid fields provided to update shift template ${id}.`);
        return existing; // No changes provided
    }

    // Recalculate duration if needed
    if (requiresDurationRecalc) {
        const newStartTime = updates.start_time ?? existing.start_time;
        const newEndTime = updates.end_time ?? existing.end_time;
        updates.duration_hours = calculateDurationHours(newStartTime, newEndTime);
        // Optionally redetermine shift_type here as well, if it's purely derived
        // updates.shift_type = determineShiftType(newStartTime, newEndTime);
        // If shift_type can also be manually set, ensure it's included if present in `data`
        if ('shift_type' in data && data.shift_type !== undefined) {
            updates.shift_type = data.shift_type;
        }
    }

    // Build the SQL query dynamically
    updates.updated_at = "datetime('now')"; // Use SQLite function
    const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(", ");
    // Filter values to match the order of setClauses, excluding the direct function call for updated_at
    const values = Object.keys(updates)
                         .filter(key => key !== 'updated_at')
                         .map(key => updates[key]);

    // Correctly handle the updated_at function call in SQL
    const sql = `UPDATE shift_templates SET ${setClauses.replace("updated_at = ?", "updated_at = datetime('now')")} WHERE id = ?;`;

    try {
        console.log(`Executing SQL: ${sql} with values:`, [...values, id]);
        const stmt = db.prepare(sql);
        const info = stmt.run(...values, id);

        if (info.changes === 0) {
            // Although we checked existence earlier, the update might fail concurrently
            console.warn(`ShiftTemplate update for id=${id} affected 0 rows.`);
            // Re-fetch to confirm state, it might have been deleted just before update
             return getShiftTemplateById(id); // This will throw NotFound if it was deleted
        }

        console.log(`Shift template ${id} updated successfully.`);
        // Fetch and return the updated template
        return getShiftTemplateById(id);
    } catch (error) {
        console.error(`Error updating shift template ${id}:`, error);
        throw new Error("Failed to update shift template in database.");
    }
}

/**
 * Deletes a shift template by its ID.
 * @param id - The ID of the shift template to delete.
 */
export async function deleteShiftTemplate(id: number): Promise<{ success: boolean }> {
    // Check if exists first - this provides a clearer 404 if it doesn't exist
    await getShiftTemplateById(id); // Throws NotFoundError if not found

    const sql = "DELETE FROM shift_templates WHERE id = ?;";
    try {
        const stmt = db.prepare(sql);
        const result = stmt.run(id);

        if (result.changes === 0) {
            // Should not happen if getShiftTemplateById succeeded, but indicates concurrent deletion
            console.warn(`Delete operation for ShiftTemplate id=${id} affected 0 rows.`);
             throw new NotFoundError(`ShiftTemplate with id ${id} likely deleted concurrently.`);
        }

        console.log(`Shift template ${id} deleted successfully.`);
        return { success: true };
    } catch (error) {
         if (error instanceof NotFoundError) throw error; // Re-throw NotFoundError from getShiftTemplateById
        console.error(`Error deleting shift template ${id}:`, error);
        throw new Error("Failed to delete shift template.");
    }
} 