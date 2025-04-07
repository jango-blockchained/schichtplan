import db from "../db";
import { type Coverage, EmployeeGroup } from "../db/schema";
import { NotFoundError } from "elysia";

// Helper to safely parse JSON arrays, returning default if null/invalid
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

// Helper to map a raw database row to the Coverage interface
function mapRowToCoverage(row: any): Coverage {
    if (!row) {
        throw new NotFoundError("Coverage row not found.");
    }
    return {
        ...row,
        requires_keyholder: Boolean(row.requires_keyholder),
        // Parse JSON fields
        employee_types: safeJsonParseArray<EmployeeGroup>(row.employee_types, []),
        allowed_employee_groups: safeJsonParseArray<EmployeeGroup>(row.allowed_employee_groups, []),
        // Ensure numeric types (though SQLite might handle this)
        day_index: Number(row.day_index),
        min_employees: Number(row.min_employees),
        max_employees: Number(row.max_employees),
    } as Coverage;
}

/**
 * Retrieves all coverage entries.
 */
export async function getAllCoverageEntries(): Promise<Coverage[]> {
    try {
        // Order by day and time for predictability
        const query = db.query("SELECT * FROM coverage ORDER BY day_index, start_time;");
        const rows = query.all() as any[];
        return rows.map(mapRowToCoverage);
    } catch (error) {
        console.error("Error fetching all coverage entries:", error);
        throw new Error("Failed to retrieve coverage entries.");
    }
}

/**
 * Retrieves a single coverage entry by its ID.
 * @param id - The ID of the coverage entry.
 */
export async function getCoverageById(id: number): Promise<Coverage> {
    try {
        const query = db.query("SELECT * FROM coverage WHERE id = ?;");
        const row = query.get(id) as any;
        if (!row) {
            throw new NotFoundError(`Coverage entry with id ${id} not found.`);
        }
        return mapRowToCoverage(row);
    } catch (error) {
        console.error(`Error fetching coverage entry ${id}:`, error);
        if (error instanceof NotFoundError) throw error;
        throw new Error("Failed to retrieve coverage entry.");
    }
}

// Input type for creating a new coverage entry
type CreateCoverageInput = Omit<Coverage, 'id' | 'created_at' | 'updated_at'>;

/**
 * Creates a new coverage entry.
 * @param data - The coverage data.
 */
export async function createCoverage(data: CreateCoverageInput): Promise<Coverage> {
    const {
        day_index,
        start_time,
        end_time,
        min_employees,
        max_employees,
        employee_types,
        allowed_employee_groups,
        requires_keyholder,
        keyholder_before_minutes,
        keyholder_after_minutes,
    } = data;

    // Basic validation
    if (day_index < 0 || day_index > 6) throw new Error("Invalid day_index (0-6).");
    // Add time validation?

    const requires_keyholder_int = requires_keyholder ? 1 : 0;
    const employee_types_json = JSON.stringify(employee_types ?? []);
    const allowed_groups_json = allowed_employee_groups ? JSON.stringify(allowed_employee_groups) : null;

    const sql = `
        INSERT INTO coverage (
            day_index, start_time, end_time, min_employees, max_employees,
            employee_types, allowed_employee_groups, requires_keyholder,
            keyholder_before_minutes, keyholder_after_minutes,
            created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id;`;

    try {
        const stmt = db.prepare(sql);
        const result = stmt.get(
            day_index,
            start_time,
            end_time,
            min_employees,
            max_employees,
            employee_types_json,
            allowed_groups_json,
            requires_keyholder_int,
            keyholder_before_minutes ?? null,
            keyholder_after_minutes ?? null
        ) as { id: number };

        if (!result || !result.id) {
            throw new Error("Failed to create coverage entry, no ID returned.");
        }
        return getCoverageById(result.id);
    } catch (error) {
        console.error("Error creating coverage entry:", error);
        throw new Error("Failed to create coverage entry.");
    }
}

// Input type for updating coverage (partial)
type UpdateCoverageInput = Partial<Omit<Coverage, 'id' | 'created_at' | 'updated_at'>>;

/**
 * Updates an existing coverage entry.
 * @param id - The ID of the coverage entry to update.
 * @param data - The fields to update.
 */
export async function updateCoverage(id: number, data: UpdateCoverageInput): Promise<Coverage> {
    await getCoverageById(id); // Check existence

    const updates: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
        if (value === undefined) continue;

        if (key === 'requires_keyholder') {
            updates[key] = value ? 1 : 0;
        } else if (key === 'employee_types') {
            updates[key] = JSON.stringify(value ?? []);
        } else if (key === 'allowed_employee_groups') {
            updates[key] = value ? JSON.stringify(value) : null;
        } else if (key === 'keyholder_before_minutes' || key === 'keyholder_after_minutes') {
            updates[key] = value ?? null;
        } else if (key === 'day_index' && (typeof value !== 'number' || value < 0 || value > 6)) {
             throw new Error("Invalid day_index (must be number 0-6).");
        } else {
            updates[key] = value;
        }
    }

    if (Object.keys(updates).length === 0) {
        return getCoverageById(id);
    }

    updates.updated_at = "CURRENT_TIMESTAMP";
    const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(", ");
    const values = Object.values(updates);

    const sql = `UPDATE coverage SET ${setClauses} WHERE id = ?;`;

    try {
        const stmt = db.prepare(sql);
        stmt.run(...values, id);
        return getCoverageById(id);
    } catch (error) {
        console.error(`Error updating coverage entry ${id}:`, error);
        throw new Error("Failed to update coverage entry.");
    }
}

/**
 * Deletes a coverage entry by its ID.
 * @param id - The ID of the coverage entry to delete.
 */
export async function deleteCoverage(id: number): Promise<{ success: boolean }> {
    await getCoverageById(id); // Check existence

    const sql = "DELETE FROM coverage WHERE id = ?;";
    try {
        const stmt = db.prepare(sql);
        stmt.run(id);
        return { success: true };
    } catch (error) {
        console.error(`Error deleting coverage entry ${id}:`, error);
        throw new Error("Failed to delete coverage entry.");
    }
} 