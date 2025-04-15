import { getDb } from "../db";
import { type ShiftPattern, type ActiveDays } from "../db/schema"; // Import types
import { NotFoundError } from "elysia";

// Initialize the database instance
const db = getDb();

// Input type definitions using imported types
type CreateShiftPatternInput = Omit<ShiftPattern, 'id' | 'created_at' | 'updated_at'>;
type UpdateShiftPatternInput = Partial<Omit<ShiftPattern, 'id' | 'created_at' | 'updated_at'>
> ;

// --- Helper functions ---
// Helper to safely parse JSON array columns
function safeJsonParseArray<T>(jsonString: string | null | undefined, defaultValue: T[]): T[] {
    if (!jsonString) return defaultValue;
    try {
        const parsed = JSON.parse(jsonString);
        return Array.isArray(parsed) ? parsed : defaultValue;
    } catch (e) {
        console.error("Failed to parse JSON array:", e, "String:", jsonString);
        return defaultValue;
    }
}

// Helper to safely parse JSON object columns
function safeJsonParseObject<T>(jsonString: string | null | undefined, defaultValue: T): T {
    if (!jsonString) return defaultValue;
    try {
        return JSON.parse(jsonString) as T;
    } catch (e) {
        console.error("Failed to parse JSON object:", e, "String:", jsonString);
        return defaultValue;
    }
}

// Helper to map database row to ShiftPattern interface
function mapRowToShiftPattern(row: any): ShiftPattern {
    if (!row) {
        throw new NotFoundError('ShiftPattern row is undefined in mapRowToShiftPattern');
    }
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        shifts: safeJsonParseArray<number>(row.shifts, []), // Array of ShiftTemplate IDs
        active_days: safeJsonParseObject<ActiveDays>(row.active_days, {}),
        is_active: Boolean(row.is_active),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

// --- Service Functions ---

/**
 * Retrieves all shift patterns from the database.
 */
export async function getAllShiftPatterns(): Promise<ShiftPattern[]> {
    try {
        const query = db.query<any, []>("SELECT * FROM shift_patterns ORDER BY name;");
        const rows = query.all();
        return rows.map(mapRowToShiftPattern);
    } catch (error) {
        console.error("Error fetching all shift patterns:", error);
        throw new Error("Failed to retrieve shift patterns.");
    }
}

/**
 * Retrieves a single shift pattern by its ID.
 */
export async function getShiftPatternById(id: number): Promise<ShiftPattern> {
    try {
        const query = db.query<any, [number]>("SELECT * FROM shift_patterns WHERE id = ?;");
        const row = query.get(id);

        if (!row) {
            throw new NotFoundError(`ShiftPattern with id ${id} not found.`);
        }
        return mapRowToShiftPattern(row);
    } catch (error) {
        console.error(`Error fetching shift pattern with id ${id}:`, error);
         if (error instanceof NotFoundError) {
             throw error;
         }
        throw new Error(`Failed to retrieve shift pattern ${id}.`);
    }
}

/**
 * Creates a new shift pattern.
 */
export async function createShiftPattern(data: CreateShiftPatternInput): Promise<ShiftPattern> {
    const { name, description, shifts, active_days, is_active } = data;

    // Prepare data for DB
    const shifts_json = JSON.stringify(shifts ?? []);
    const active_days_json = JSON.stringify(active_days ?? {});
    const is_active_int = is_active ? 1 : 0;

    const sql = `
        INSERT INTO shift_patterns (
            name, description, shifts, active_days, is_active,
            created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        RETURNING id;`;

    try {
        const stmt = db.prepare(sql);
        const result = stmt.get(
            name,
            description ?? null,
            shifts_json,
            active_days_json,
            is_active_int
        ) as { id: number };

        if (!result || !result.id) {
            throw new Error("Failed to create shift pattern, no ID returned.");
        }
        console.log(`Shift pattern created with ID: ${result.id}`);
        return getShiftPatternById(result.id);
    } catch (error: any) {
        console.error("Error creating shift pattern:", error);
        if (error.message?.includes('UNIQUE constraint failed')) {
            throw new Error(`Shift pattern name '${name}' already exists.`);
        }
        throw new Error("Failed to create shift pattern in database.");
    }
}

/**
 * Updates an existing shift pattern.
 */
export async function updateShiftPattern(id: number, data: UpdateShiftPatternInput): Promise<ShiftPattern> {
    // Ensure existence
    await getShiftPatternById(id);

    const updates: Record<string, any> = {};

    // Map input data to DB format
    for (const [key, value] of Object.entries(data)) {
        if (value === undefined) continue;

        switch (key as keyof UpdateShiftPatternInput) {
            case 'shifts':
            case 'active_days':
                updates[key] = JSON.stringify(value ?? (key === 'shifts' ? [] : {}));
                break;
            case 'is_active':
                updates[key] = value ? 1 : 0;
                break;
            default:
                 updates[key] = value;
        }
    }

    if (Object.keys(updates).length === 0) {
        console.log(`No valid fields provided to update shift pattern ${id}.`);
        return getShiftPatternById(id);
    }

    // Build query
    updates.updated_at = "datetime('now')";
    const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(", ");
    const values = Object.keys(updates)
                         .filter(key => key !== 'updated_at')
                         .map(key => updates[key]);

    const sql = `UPDATE shift_patterns SET ${setClauses.replace("updated_at = ?", "updated_at = datetime('now')")} WHERE id = ?;`;

    try {
        const stmt = db.prepare(sql);
        const info = stmt.run(...values, id);

        if (info.changes === 0) {
             console.warn(`ShiftPattern update for id=${id} affected 0 rows.`);
            return getShiftPatternById(id);
        }

        console.log(`Shift pattern ${id} updated successfully.`);
        return getShiftPatternById(id);
    } catch (error: any) {
        console.error(`Error updating shift pattern ${id}:`, error);
        if (error.message?.includes('UNIQUE constraint failed') && data.name) {
            throw new Error(`Shift pattern name '${data.name}' already exists.`);
        }
        throw new Error("Failed to update shift pattern in database.");
    }
}

/**
 * Deletes a shift pattern by its ID.
 */
export async function deleteShiftPattern(id: number): Promise<{ success: boolean }> {
    // Check existence
    await getShiftPatternById(id);

    const sql = "DELETE FROM shift_patterns WHERE id = ?;";
    try {
        const stmt = db.prepare(sql);
        const result = stmt.run(id);

        if (result.changes === 0) {
             console.warn(`Delete operation for ShiftPattern id=${id} affected 0 rows.`);
            throw new NotFoundError(`ShiftPattern with id ${id} likely deleted concurrently.`);
        }

        console.log(`Shift pattern ${id} deleted successfully.`);
        return { success: true };
    } catch (error) {
        if (error instanceof NotFoundError) throw error;
        console.error(`Error deleting shift pattern ${id}:`, error);
        throw new Error("Failed to delete shift pattern.");
    }
} 