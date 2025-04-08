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

// Helper function to get keys of the Settings interface (excluding id and timestamps)
// This is a workaround as we can't directly get keys from an interface at runtime easily.
// Use a sample object or define the keys explicitly.
function getValidSettingKeys(): Set<SettingKey> {
    // Define the keys based on the Settings interface, excluding generated ones
    return new Set<SettingKey>([
        'store_name', 'store_address', 'store_contact', 'timezone', 'language', 'date_format', 'time_format',
        'store_opening', 'store_closing', 'opening_days', 'special_hours', 'keyholder_before_minutes',
        'keyholder_after_minutes', 'require_keyholder', 'scheduling_resource_type', 'default_shift_duration',
        'min_break_duration', 'max_daily_hours', 'max_weekly_hours', 'min_rest_between_shifts',
        'scheduling_period_weeks', 'auto_schedule_preferences', 'min_employees_per_shift',
        'max_employees_per_shift', 'allow_dynamic_shift_adjustment', 'scheduling_advanced', 'theme',
        'primary_color', 'secondary_color', 'accent_color', 'background_color', 'surface_color', 'text_color',
        'dark_theme_primary_color', 'dark_theme_secondary_color', 'dark_theme_accent_color',
        'dark_theme_background_color', 'dark_theme_surface_color', 'dark_theme_text_color', 'show_sunday',
        'show_weekdays', 'start_of_week', 'email_notifications', 'schedule_published_notify',
        'shift_changes_notify', 'time_off_requests_notify', 'page_size', 'orientation', 'margin_top',
        'margin_right', 'margin_bottom', 'margin_left', 'table_header_bg_color', 'table_border_color',
        'table_text_color', 'table_header_text_color', 'font_family', 'font_size', 'header_font_size',
        'show_employee_id', 'show_position', 'show_breaks', 'show_total_hours', 'pdf_layout_presets',
        'availability_types', 'employee_types', 'shift_types', 'absence_types', 'actions_demo_data'
    ]);
}

// Define which SettingKeys correspond to JSON fields that MUST NOT be null
const nonNullableJsonKeys = new Set<SettingKey>([
    'opening_days', 'special_hours', 'scheduling_advanced',
    'availability_types', 'employee_types', 'shift_types', 'absence_types'
    // pdf_layout_presets and actions_demo_data ARE nullable
]);

/**
 * Updates the application settings (singleton, id=1).
 * Only updates fields present in the input object.
 * @param updates - An object containing settings fields to update.
 * @param db - Optional Database instance for dependency injection.
 * @returns The updated Settings object.
 */
export async function updateSettings(updates: Partial<Settings>, db: Database = globalDb): Promise<Settings> {
    const settingsId = 1;
    const validKeys = getValidSettingKeys();

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
        // Check if the key is a valid SettingKey and is own property
        if (!Object.prototype.hasOwnProperty.call(updates, key) || !validKeys.has(key as SettingKey)) {
            console.warn(`Skipping invalid or non-updatable settings key: ${key}`);
            continue;
        }
        
        const settingKey = key as SettingKey;
        let value = updates[settingKey];

        // Check if it corresponds to a known JSON field
         const isJsonField = [
             'opening_days', 'special_hours', 'scheduling_advanced', 'pdf_layout_presets',
             'availability_types', 'employee_types', 'shift_types', 'absence_types',
             'actions_demo_data'
         ].includes(settingKey);

        // Prevent setting non-nullable JSON fields to null
        if (isJsonField && value === null && nonNullableJsonKeys.has(settingKey)) {
             console.error(`Attempted to set non-nullable JSON field '${settingKey}' to null. Skipping update for this field.`);
             // Optionally throw an error instead of skipping:
             // throw new Error(`Field '${settingKey}' cannot be set to null.`);
             continue; // Skip this field
        }

        if (isJsonField && value !== null && typeof value === 'object') {
            try {
                value = JSON.stringify(value);
            } catch (jsonError) {
                 console.error(`Failed to stringify JSON for key ${settingKey}:`, jsonError);
                 throw new Error(`Invalid JSON format provided for key ${settingKey}.`);
            }
        } else if (isJsonField && value === null) {
            value = null; // Allow setting nullable JSON fields (like pdf_layout_presets) to NULL
        } else if (isJsonField && typeof value !== 'string' && value !== null) {
             // Should be caught by TS, but runtime check for safety
             throw new Error(`Invalid type for JSON field ${settingKey}: expected object, array, or null.`);
        } else if (typeof value === 'boolean') {
             // Convert boolean to integer for SQLite
             value = value ? 1 : 0;
        }
        
        setClauses.push(`${settingKey} = ?`);
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
        console.log(`Attempting to update settings for id=${settingsId} with keys: ${setClauses.filter(c => !c.startsWith('updated_at')).map(c => c.split(' ')[0]).join(', ')}`);
        const stmt = db.prepare(sql);
        // Use Promise.resolve if stmt.run is synchronous in bun:sqlite
        const info = await Promise.resolve(stmt.run(...values)); 

        // Check if any rows were actually changed
        // Note: bun:sqlite's run() might return void or an object { changes: number }
        // Adjust based on actual return type if needed. Assuming it might return void or similar.
        // We'll rely on fetching the settings again to confirm the update implicitly.
        // Original code checked info.changes, let's keep that if bun:sqlite supports it
        // Assuming info is { changes: number }
        if (typeof info?.changes === 'number' && info.changes === 0) {
             // This might happen if the values provided are the same as existing ones.
             // It's not necessarily an error, but good to note.
             console.warn(`Settings update attempt for id=${settingsId} affected 0 rows (values might be unchanged).`);
        } else if (typeof info?.changes !== 'number'){
             console.warn("Could not verify number of changes from stmt.run()");
        }
        
        console.log(`Settings update executed for id=${settingsId}.`);
        // Fetch settings again to return the potentially updated object
        return await getSettings(db);
    } catch (error) {
        console.error("Error during database update operation:", error);
        // Don't need to check for NotFoundError here as we fetched before update
        throw new Error(`Failed to update settings in database: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Retrieves all settings.
 * @param db - Optional Database instance.
 */
export async function getAllSettings(db: Database = globalDb): Promise<Settings[]> {
    const sql = "SELECT * FROM settings ORDER BY setting_key;";
    try {
        const query = db.query(sql); // Use db
        const rows = query.all() as any[];
        return rows.map(mapRowToSettings);
    } catch (error) {
        console.error("Error fetching all settings:", error);
        throw new Error("Failed to retrieve settings.");
    }
}

/**
 * Retrieves a setting by its key.
 * @param key - The setting key.
 * @param db - Optional Database instance.
 */
export async function getSettingByKey(key: string, db: Database = globalDb): Promise<Settings | null> {
    const sql = "SELECT * FROM settings WHERE setting_key = ?;";
    try {
        const query = db.query(sql); // Use db
        const row = query.get(key) as any;
        return row ? mapRowToSettings(row) : null;
    } catch (error) {
        console.error(`Error fetching setting by key ${key}:`, error);
        throw new Error("Failed to retrieve setting by key.");
    }
}

/**
 * Updates a setting or creates it if it doesn't exist (upsert).
 * @param key - The setting key.
 * @param value - The setting value.
 * @param db - Optional Database instance.
 */
export async function upsertSetting(key: string, value: string, db: Database = globalDb): Promise<Settings> {
    const sql = `
        INSERT INTO settings (setting_key, setting_value, created_at, updated_at)
        VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(setting_key) DO UPDATE SET
            setting_value = excluded.setting_value,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
    `;
    try {
        const stmt = db.prepare(sql); // Use db
        stmt.run(key, value);

        // Fetch the potentially updated/inserted row to return it
        const result = await getSettingByKey(key, db); // Use db
        if (!result) {
            // This should ideally not happen with upsert but handle defensively
            throw new Error("Failed to retrieve setting after upsert.");
        }
        return result;
    } catch (error) {
        console.error(`Error upserting setting ${key}:`, error);
        throw new Error("Failed to upsert setting.");
    }
}

// --- Absence Types --- 

/**
 * Retrieves all absence types.
 * @param db - Optional Database instance.
 */
export async function getAllAbsenceTypes(db: Database = globalDb): Promise<AbsenceTypeDefinition[]> {
    // Placeholder: return empty array or throw error
    console.warn("getAllAbsenceTypes not implemented");
    return []; 
}

/**
 * Retrieves an absence type by its ID.
 * @param id - The ID of the absence type.
 * @param db - Optional Database instance.
 */
export async function getAbsenceTypeById(id: string | number, db: Database = globalDb): Promise<AbsenceTypeDefinition> {
    // Placeholder: throw error
    console.warn(`getAbsenceTypeById (${id}) not implemented`);
    throw new NotFoundError(`Absence type with ID ${id} not found (Not Implemented).`);
}

// Input type for creating an absence type (omit generated fields)
// Align with CreateAbsenceTypeSchema from routes/settings.ts
type CreateAbsenceTypeInput = {
    name: string;
    is_paid: boolean;
    // color and type are optional or handled differently based on schema/db
};

/**
 * Adds a new absence type.
 * @param data - The absence type data (name, is_paid).
 * @param db - Optional Database instance.
 */
export async function addAbsenceType(data: CreateAbsenceTypeInput, db: Database = globalDb): Promise<AbsenceTypeDefinition> {
    // Placeholder: throw error
    console.warn("addAbsenceType not implemented");
    // Need to map data to the full AbsenceTypeDefinition structure before inserting
    // For now, just throw the error
    throw new Error("Add absence type not implemented.");
}

// Input type for updating absence type (partial, omit id/generated)
// Use the imported type and Omit/Partial
type UpdateAbsenceTypeInput = Partial<Omit<AbsenceTypeDefinition, 'id' | 'created_at' | 'updated_at'> | CreateAbsenceTypeInput>; // Allow partial update with create fields

/**
 * Updates an existing absence type.
 * @param id - The ID of the absence type to update.
 * @param data - The fields to update.
 * @param db - Optional Database instance.
 */
export async function updateAbsenceType(id: string | number, data: UpdateAbsenceTypeInput, db: Database = globalDb): Promise<AbsenceTypeDefinition> {
    // Placeholder: throw error
    console.warn(`updateAbsenceType (${id}) not implemented`);
    throw new Error(`Update absence type ${id} not implemented.`);
}

/**
 * Deletes an absence type by its ID.
 * @param id - The ID of the absence type to delete.
 * @param db - Optional Database instance.
 */
export async function deleteAbsenceType(id: string | number, db: Database = globalDb): Promise<{ success: boolean }> {
    // Placeholder: throw error
    console.warn(`deleteAbsenceType (${id}) not implemented`);
    throw new Error(`Delete absence type ${id} not implemented.`);
}

// --- Table Management --- 

/**
 * Retrieves a list of user-manageable table names from the database.
 * Excludes internal SQLite tables and the settings table.
 * @param db - Optional Database instance.
 */
export async function getDatabaseTables(db: Database = globalDb): Promise<string[]> {
    const internalTables = [
        'sqlite_sequence', // SQLite internal sequence tracking
        'drizzle__migrations', // Drizzle internal migration tracking
        'settings' // Exclude the main settings table from wiping
        // Add any other tables that should NOT be wipeable here
    ];
    
    // Query to get all table names, excluding sqlite internal ones
    const sql = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';";
    
    try {
        const query = db.query(sql);
        // Use Promise.resolve() if .all() is sync in bun:sqlite
        const rows = await Promise.resolve(query.all()) as { name: string }[];
        
        // Filter out the internal/protected tables
        const tables = rows
            .map(row => row.name)
            .filter(name => !internalTables.includes(name));
            
        return tables;
    } catch (error) {
        console.error("Error fetching database table names:", error);
        throw new Error("Failed to retrieve database table names.");
    }
}

/**
 * Deletes all rows from the specified tables.
 * Use with caution!
 * @param tablesToWipe - An array of table names to wipe.
 * @param db - Optional Database instance.
 * @returns A promise resolving when the operation is complete.
 */
export async function wipeTablesService(tablesToWipe: string[], db: Database = globalDb): Promise<void> {
    if (!Array.isArray(tablesToWipe) || tablesToWipe.length === 0) {
        throw new Error("No tables specified for wiping.");
    }

    // Sanitize table names (basic example - prevent SQL injection if names were dynamic)
    const validTables = await getDatabaseTables(db); // Get list of wipeable tables
    const sanitizedTables = tablesToWipe.filter(table => 
        /^[a-zA-Z0-9_]+$/.test(table) && validTables.includes(table)
    );

    if (sanitizedTables.length === 0) {
        console.warn("No valid or allowed tables found to wipe after filtering.");
        return; // Or throw an error?
    }

    console.warn(`Attempting to WIPE data from tables: ${sanitizedTables.join(", ")}`);

    // Execute DELETE statements in a transaction
    const transaction = db.transaction(() => {
        for (const table of sanitizedTables) {
            try {
                const deleteSql = `DELETE FROM ${table};`;
                db.run(deleteSql, []); // Pass empty array for bindings
                console.log(`Successfully wiped table: ${table}`);
                 // Optionally reset auto-increment counter if applicable (SQLite specific)
                 if (table !== 'sqlite_sequence') { // Don't delete the sequence table itself
                    try {
                        const resetSeqSql = `DELETE FROM sqlite_sequence WHERE name = ?;`;
                        db.run(resetSeqSql, [table]); // Pass table name as binding
                        console.log(`Reset sequence for table: ${table}`);
                    } catch (seqError) {
                         console.warn(`Could not reset sequence for table ${table}:`, seqError);
                    }
                 }
            } catch (error) {
                console.error(`Error wiping table ${table}:`, error);
                // IMPORTANT: Bun SQLite transactions might not automatically roll back.
                // Consider manual rollback or ensuring atomicity if partial wipes are critical.
                throw new Error(`Failed to wipe table ${table}: ${error instanceof Error ? error.message : String(error)}`); 
            }
        }
    });

    try {
        // Use Promise.resolve() if transaction is synchronous
        await Promise.resolve(transaction());
        console.log(`Successfully wiped tables: ${sanitizedTables.join(", ")}`);
    } catch (error) {
         // Error already thrown within the transaction loop, rethrow if needed
         console.error("Transaction failed during table wipe:", error);
         throw error;
    }
}