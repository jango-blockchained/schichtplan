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

// Helper to map a raw database row to the ShiftTemplate interface
function mapRowToShiftTemplate(row: any): ShiftTemplate {
    if (!row) {
        throw new NotFoundError("ShiftTemplate row not found.");
    }
    return {
        ...row,
        duration_hours: calculateDurationHours(row.start_time, row.end_time), // Recalculate on read is safer
        requires_break: Boolean(row.requires_break), // Convert 0/1 to boolean
        active_days: safeJsonParse<ActiveDays>(row.active_days, {}), // Parse JSON
        // shift_type is assumed to be stored correctly as TEXT enum value
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
type CreateShiftTemplateInput = Omit<ShiftTemplate, 'id' | 'duration_hours' | 'created_at' | 'updated_at'>;

/**
 * Creates a new shift template.
 * @param data - The data for the new shift template.
 */
export async function createShiftTemplate(data: CreateShiftTemplateInput): Promise<ShiftTemplate> {
    const { start_time, end_time, requires_break, shift_type, shift_type_id, active_days } = data;

    // Calculate derived fields
    const duration_hours = calculateDurationHours(start_time, end_time);
    // const determinedShiftType = determineShiftType(start_time, end_time); // Use determined type?
    const requires_break_int = requires_break ? 1 : 0;
    const active_days_json = JSON.stringify(active_days);
    // Ensure shift_type_id is null if undefined or null
    const safe_shift_type_id = shift_type_id ?? null;

    const sql = `
        INSERT INTO shift_templates
          (start_time, end_time, duration_hours, requires_break, shift_type, shift_type_id, active_days, created_at, updated_at)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id;`;

    try {
        const stmt = db.prepare(sql);
        // Pass safe_shift_type_id which is guaranteed to be string or null
        const result = stmt.get(start_time, end_time, duration_hours, requires_break_int, shift_type, safe_shift_type_id, active_days_json) as { id: number };

        if (!result || !result.id) {
            throw new Error("Failed to create shift template, no ID returned.");
        }
        // Fetch the newly created template to return the full object
        return getShiftTemplateById(result.id);
    } catch (error) {
        console.error("Error creating shift template:", error);
        throw new Error("Failed to create shift template.");
    }
}

// Define input type for updating (all fields optional, except id is required via param)
type UpdateShiftTemplateInput = Partial<Omit<ShiftTemplate, 'id' | 'duration_hours' | 'created_at' | 'updated_at'>>;

/**
 * Updates an existing shift template.
 * @param id - The ID of the shift template to update.
 * @param data - An object containing the fields to update.
 */
export async function updateShiftTemplate(id: number, data: UpdateShiftTemplateInput): Promise<ShiftTemplate> {
    // Fetch existing to calculate duration if times change
    const existing = await getShiftTemplateById(id); // Throws NotFoundError if not found

    const updates: Record<string, any> = {};
    let requiresDurationRecalc = false;

    // Prepare updates, handling specific conversions
    for (const [key, value] of Object.entries(data)) {
        if (value === undefined) continue; // Skip undefined fields

        if (key === 'active_days') {
            updates[key] = JSON.stringify(value);
        } else if (key === 'requires_break') {
            updates[key] = value ? 1 : 0;
        } else if (key === 'start_time' || key === 'end_time') {
            updates[key] = value;
            requiresDurationRecalc = true;
        } else {
            updates[key] = value;
        }
    }

    if (Object.keys(updates).length === 0) {
        return existing; // No changes provided
    }

    // Recalculate duration if needed
    if (requiresDurationRecalc) {
        const newStartTime = updates.start_time ?? existing.start_time;
        const newEndTime = updates.end_time ?? existing.end_time;
        updates.duration_hours = calculateDurationHours(newStartTime, newEndTime);
        // Optionally redetermine shift_type here as well
        // updates.shift_type = determineShiftType(newStartTime, newEndTime);
    }

    // Build the SQL query dynamically
    updates.updated_at = "CURRENT_TIMESTAMP"; // Always update timestamp
    const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(", ");
    const values = Object.values(updates);

    const sql = `UPDATE shift_templates SET ${setClauses} WHERE id = ?;`;

    try {
        const stmt = db.prepare(sql);
        stmt.run(...values, id);

        // Fetch and return the updated template
        return getShiftTemplateById(id);
    } catch (error) {
        console.error(`Error updating shift template ${id}:`, error);
        throw new Error("Failed to update shift template.");
    }
}

/**
 * Deletes a shift template by its ID.
 * @param id - The ID of the shift template to delete.
 */
export async function deleteShiftTemplate(id: number): Promise<{ success: boolean }> {
    // Check if exists first
    await getShiftTemplateById(id); // Throws NotFoundError if not found

    const sql = "DELETE FROM shift_templates WHERE id = ?;";
    try {
        const stmt = db.prepare(sql);
        const result = stmt.run(id);
        // bun:sqlite run() result type might not have changes, check docs
        // For now, assume success if no error and existed before
        return { success: true };
    } catch (error) {
        console.error(`Error deleting shift template ${id}:`, error);
        throw new Error("Failed to delete shift template.");
    }
} 