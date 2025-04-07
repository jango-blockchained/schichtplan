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
 * Retrieves all coverage entries from the database.
 * TODO: Add filtering by date range if necessary (depends on how coverage is used).
 */
export async function getAllCoverage(): Promise<Coverage[]> {
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
 * Retrieves a single coverage entry by ID.
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

// Type for the input data to bulkUpdateCoverage - id can be optional
type BulkCoverageInput = Omit<Coverage, 'id' | 'created_at' | 'updated_at'> & { id?: number };

/**
 * Updates coverage entries in bulk.
 * Deletes existing coverage for the days present in the input data
 * and inserts the new entries within a transaction.
 * @param coverageData - An array of Coverage-like objects representing the new desired state.
 */
export async function bulkUpdateCoverage(coverageData: BulkCoverageInput[]): Promise<BulkCoverageInput[]> {
    // Use transaction for atomicity
    const transaction = db.transaction((entries: BulkCoverageInput[]) => {
        // 1. Determine affected day indices
        const affectedDays = [...new Set(entries.map(entry => entry.day_index))];
        if (affectedDays.length === 0) {
            console.log("bulkUpdateCoverage called with empty data, no changes made.");
            return []; // Nothing to do
        }

        // 2. Delete existing coverage for affected days
        // Ensure the placeholder count matches the number of affected days
        const placeholders = affectedDays.map(() => '?').join(',');
        const deleteSql = `DELETE FROM coverage WHERE day_index IN (${placeholders});`;
        const deleteStmt = db.prepare(deleteSql);
        try {
            console.log(`Deleting existing coverage for days: ${affectedDays.join(', ')}`);
            // Ensure affectedDays is treated as array of numbers for the run method
            deleteStmt.run(...affectedDays as number[]); 
        } catch (delError) {
            console.error("Error deleting existing coverage:", delError);
            throw new Error("Failed to clear existing coverage before update."); // Causes transaction rollback
        }

        // 3. Prepare INSERT statement (corrected column names based on schema.ts if necessary)
        // Assuming column names in schema.ts match the Coverage interface keys used below.
        const insertSql = `
            INSERT INTO coverage (
                day_index, start_time, end_time, min_employees, max_employees,
                employee_types, allowed_employee_groups, requires_keyholder,
                keyholder_before_minutes, keyholder_after_minutes,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'));`;
        const insertStmt = db.prepare(insertSql);

        // 4. Insert new entries
        for (const entry of entries) {
            try {
                // Map input type to database values
                const requires_keyholder_int = entry.requires_keyholder ? 1 : 0;
                // Ensure arrays are stringified, handle null/undefined cases gracefully
                const employee_types_json = JSON.stringify(entry.employee_types ?? []); 
                const allowed_groups_json = entry.allowed_employee_groups ? JSON.stringify(entry.allowed_employee_groups) : null;

                insertStmt.run(
                    entry.day_index,
                    entry.start_time,
                    entry.end_time,
                    entry.min_employees,
                    entry.max_employees,
                    employee_types_json,
                    allowed_groups_json, 
                    requires_keyholder_int,
                    entry.keyholder_before_minutes ?? null,
                    entry.keyholder_after_minutes ?? null
                );
            } catch (insError) {
                console.error("Error inserting coverage entry:", insError, "Entry:", entry);
                throw new Error("Failed to insert new coverage entry during bulk update."); // Causes transaction rollback
            }
        }

        // 5. Transaction commits automatically if no error is thrown
        console.log(`Successfully inserted ${entries.length} coverage entries for days: ${affectedDays.join(', ')}`);
        // Return the input data as confirmation.
        return entries; 
    });

    try {
        // Execute the transaction
        return transaction(coverageData);
    } catch (error) {
        console.error("Bulk coverage update transaction failed:", error);
        // Ensure a generic error is thrown if the transaction itself fails
        throw new Error("Bulk coverage update failed.");
    }
} 