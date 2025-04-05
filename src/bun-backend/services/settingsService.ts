import db from "../db";
import type {
    Settings,
    OpeningDays, SpecialHours, AvailabilityTypeDefinition,
    EmployeeTypeDefinition, ShiftTypeDefinition, AbsenceTypeDefinition,
    PdfLayoutPresets, ActionsDemoData, SchedulingAdvanced
} from "../db/schema";
import { NotFoundError } from "elysia";

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

// Helper to convert DB row (with 0/1 for booleans and JSON strings) to Settings interface
function mapRowToSettings(row: any): Settings {
    if (!row) {
        // This should ideally not happen if settings are initialized
        throw new NotFoundError("Settings not found in database.");
    }
    return {
        ...row,
        // Convert integers back to booleans
        require_keyholder: Boolean(row.require_keyholder),
        auto_schedule_preferences: Boolean(row.auto_schedule_preferences),
        allow_dynamic_shift_adjustment: Boolean(row.allow_dynamic_shift_adjustment),
        show_sunday: Boolean(row.show_sunday),
        show_weekdays: Boolean(row.show_weekdays),
        email_notifications: Boolean(row.email_notifications),
        schedule_published_notify: Boolean(row.schedule_published_notify),
        shift_changes_notify: Boolean(row.shift_changes_notify),
        time_off_requests_notify: Boolean(row.time_off_requests_notify),
        show_employee_id: Boolean(row.show_employee_id),
        show_position: Boolean(row.show_position),
        show_breaks: Boolean(row.show_breaks),
        show_total_hours: Boolean(row.show_total_hours),
        // Parse JSON strings into objects/arrays
        opening_days: safeJsonParse<OpeningDays>(row.opening_days, {}),
        special_hours: safeJsonParse<SpecialHours>(row.special_hours, {}),
        scheduling_advanced: safeJsonParse<SchedulingAdvanced>(row.scheduling_advanced, {}),
        pdf_layout_presets: safeJsonParse<PdfLayoutPresets | null>(row.pdf_layout_presets, null),
        availability_types: safeJsonParse<AvailabilityTypeDefinition[]>(row.availability_types, []),
        employee_types: safeJsonParse<EmployeeTypeDefinition[]>(row.employee_types, []),
        shift_types: safeJsonParse<ShiftTypeDefinition[]>(row.shift_types, []),
        absence_types: safeJsonParse<AbsenceTypeDefinition[]>(row.absence_types, []),
        actions_demo_data: safeJsonParse<ActionsDemoData | null>(row.actions_demo_data, null),
    };
}

// Helper to convert Settings interface to DB row format (0/1 for booleans, JSON strings)
function mapSettingsToDbRow(settings: Partial<Settings>): Record<string, any> {
    const dbRow: Record<string, any> = { ...settings };

    // Convert boolean fields to integers (0 or 1)
    const booleanFields: (keyof Settings)[] = [
        'require_keyholder', 'auto_schedule_preferences', 'allow_dynamic_shift_adjustment',
        'show_sunday', 'show_weekdays', 'email_notifications', 'schedule_published_notify',
        'shift_changes_notify', 'time_off_requests_notify', 'show_employee_id',
        'show_position', 'show_breaks', 'show_total_hours'
    ];
    booleanFields.forEach(field => {
        if (settings[field] !== undefined && settings[field] !== null) {
            dbRow[field] = settings[field] ? 1 : 0;
        }
    });

    // Convert JSON fields to strings
    const jsonFields: (keyof Settings)[] = [
        'opening_days', 'special_hours', 'scheduling_advanced', 'pdf_layout_presets',
        'availability_types', 'employee_types', 'shift_types', 'absence_types',
        'actions_demo_data'
    ];
    jsonFields.forEach(field => {
        if (settings[field] !== undefined) {
            dbRow[field] = settings[field] === null ? null : JSON.stringify(settings[field]);
        }
    });

    // Remove id if present, as we usually update based on a fixed ID (e.g., 1)
    delete dbRow.id;
    // Remove timestamps if present, DB should handle defaults/updates
    delete dbRow.created_at;
    delete dbRow.updated_at;

    return dbRow;
}

/**
 * Retrieves the application settings.
 * Assumes settings are stored in a single row with id = 1.
 */
export async function getSettings(): Promise<Settings> {
    try {
        // Use prepared statement for safety, though id=1 is static
        const query = db.query("SELECT * FROM settings WHERE id = ?");
        const result = query.get(1); // Get the single row with id = 1

        if (!result) {
            throw new NotFoundError("Settings not found (id=1). Database might not be initialized correctly.");
        }
        return mapRowToSettings(result);
    } catch (error) {
        console.error("Error fetching settings:", error);
        // Re-throw specific errors or a generic server error
        if (error instanceof NotFoundError) {
            throw error;
        }
        throw new Error("Failed to retrieve settings from database.");
    }
}

/**
 * Updates the application settings.
 * Assumes settings are stored in a single row with id = 1.
 * @param updatedSettings - An object containing the settings fields to update.
 */
export async function updateSettings(updatedSettings: Partial<Omit<Settings, 'id' | 'created_at' | 'updated_at'>>): Promise<Settings> {
    const settingsId = 1; // Assuming settings are always row with id=1
    const dbRow = mapSettingsToDbRow(updatedSettings);

    // Filter out undefined values which should not be updated
    const validUpdates = Object.entries(dbRow).filter(([_, value]) => value !== undefined);

    if (validUpdates.length === 0) {
        // If no valid fields to update, just return current settings
        return getSettings();
    }

    const setClauses = validUpdates.map(([key, _]) => `${key} = ?`).join(", ");
    const values = validUpdates.map(([_, value]) => value);

    // Add updated_at timestamp manually or rely on DB trigger if configured
    const updateTimestampClause = ", updated_at = CURRENT_TIMESTAMP"; // Or datetime('now') for SQLite

    const sql = `UPDATE settings SET ${setClauses}${updateTimestampClause} WHERE id = ?`;

    try {
        // Use prepared statement
        const stmt = db.prepare(sql);
        stmt.run(...values, settingsId);

        // Fetch and return the updated settings
        return getSettings();
    } catch (error) {
        console.error("Error updating settings:", error);
        throw new Error("Failed to update settings in database.");
    }
} 