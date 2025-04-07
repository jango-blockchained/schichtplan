import { NotFoundError } from "elysia";
import { Database } from "bun:sqlite";
import { default as globalDb } from "../db";
import type {
    Settings,
    OpeningDays, SpecialHours, AvailabilityTypeDefinition,
    EmployeeTypeDefinition, ShiftTypeDefinition, AbsenceTypeDefinition,
    PdfLayoutPresets, ActionsDemoData, SchedulingAdvanced,
    SettingKey
} from '../db/schema';
import { isSettingKey } from "../db/schema"; // Need value import for isSettingKey

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
 * Retrieves the application settings (singleton).
 * Throws NotFoundError if settings are not found.
 * @param db - Optional Database instance for dependency injection.
 */
export async function getSettings(db: Database = globalDb): Promise<Settings> {
    console.log("Attempting to fetch settings...");
    const sql = "SELECT * FROM settings WHERE id = ?;";
    try {
        // Assuming db.query(...).get() might be async or requires await
        const query = db.query(sql);
        // Use Promise.resolve() or check Bun SQLite docs if .get() is sync
        const row: any = await Promise.resolve(query.get(1)); 
        if (!row) {
            console.error("Settings row not found (id=1).");
            throw new NotFoundError("Settings not found (id=1). Database might not be initialized correctly.");
        }
        console.log("Settings fetched successfully.");
        return mapRowToSettings(row);
    } catch (error) {
        console.error("Error fetching settings:", error);
        if (error instanceof NotFoundError) throw error;
        throw new Error("Failed to retrieve settings.");
    }
}

/**
 * Updates the application settings (singleton, id=1).
 * Only updates fields present in the input object.
 * @param updates - An object containing settings fields to update.
 * @param db - Optional Database instance for dependency injection.
 * @returns The updated Settings object.
 */
export async function updateSettings(updates: Partial<Settings>, db: Database = globalDb): Promise<Settings> {
    const settingsId = 1;

    let currentSettings: Settings;
    try {
        currentSettings = await getSettings(db);
    } catch (error) {
        if (error instanceof NotFoundError) {
            throw new NotFoundError(`Settings not found (id=${settingsId}) for update.`);
        }
        throw new Error(`Failed to fetch current settings before update: ${error instanceof Error ? error.message : String(error)}`);
    }

    const setClauses: string[] = [];
    const values: any[] = [];

    // Iterate over keys in the input 'updates' object
    for (const key in updates) {
        // Exclude non-updatable fields and prototype properties
        if (!Object.prototype.hasOwnProperty.call(updates, key) || key === 'id' || key === 'created_at' || key === 'updated_at') {
            continue;
        }
        
        // Assume the key is valid if it exists in the Partial<Settings> input
        // TypeScript should provide safety here.
        let value = updates[key as keyof Settings]; // Use type assertion

        // Check if it corresponds to a known JSON field based on current settings type
        // (or maintain a predefined list of JSON field names)
         const isJsonField = [
             'opening_days', 'special_hours', 'scheduling_advanced', 'pdf_layout_presets',
             'availability_types', 'employee_types', 'shift_types', 'absence_types',
             'actions_demo_data'
         ].includes(key);

        if (isJsonField && value !== null && typeof value === 'object') {
            try {
                value = JSON.stringify(value);
            } catch (jsonError) {
                 console.error(`Failed to stringify JSON for key ${key}:`, jsonError);
                 throw new Error(`Invalid JSON format provided for key ${key}.`);
            }
        } else if (isJsonField && value === null) {
            value = null; // Explicitly allow setting JSON to NULL
        } else if (isJsonField && typeof value !== 'string' && value !== null) {
             // This case should ideally be caught by TypeScript, but add runtime check
             throw new Error(`Invalid type for JSON field ${key}: expected object, array, string, or null.`);
        }
        
        setClauses.push(`${key} = ?`);
        values.push(value);
    }

    if (setClauses.length === 0) { 
        console.warn("No valid fields provided for settings update after filtering.");
        return currentSettings; 
    }

    // Add updated_at timestamp
    setClauses.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");

    const sql = `UPDATE settings SET ${setClauses.join(", ")} WHERE id = ?`;
    values.push(settingsId);

    try {
        console.log(`Attempting to update settings for id=${settingsId} with keys: ${Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at').join(', ')}`);
        const stmt = db.prepare(sql);
        const info = await Promise.resolve(stmt.run(...values)); 

        if (info.changes === 0) {
            console.error(`Settings update attempt for id=${settingsId} affected 0 rows.`);
            throw new NotFoundError(`Settings update failed: Row with id=${settingsId} became unavailable.`);
        }
        console.log(`Settings update successful for id=${settingsId}. Changes: ${info.changes}`);
        return await getSettings(db);
    } catch (error) {
        console.error("Error during database update operation:", error);
        if (error instanceof NotFoundError) throw error; 
        throw new Error(`Failed to update settings in database: ${error instanceof Error ? error.message : String(error)}`);
    }
}