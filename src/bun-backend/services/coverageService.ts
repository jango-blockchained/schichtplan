import globalDb from "../db"; // Default instance
import { Database } from "bun:sqlite"; // Type
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
        throw new NotFoundError("Coverage row not found during mapping.");
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
export async function getAllCoverage(
    db: Database = globalDb as Database
): Promise<Coverage[]> {
    if (!db) {
        throw new Error("Database instance is required");
    }
    try {
        // Get the records, ordered by day and time for predictability
        const query = db.query("SELECT * FROM coverage ORDER BY day_index, start_time;");
        const rows = query.all() as any[];
        
        // Return empty array if no records
        if (!rows || rows.length === 0) {
            return [];
        }
        
        return rows.map(mapRowToCoverage);
    } catch (error) {
        console.error("Error fetching all coverage entries:", error);
        throw new Error("Failed to retrieve coverage entries.");
    }
}

/**
 * Retrieves a single coverage entry by ID.
 */
export async function getCoverageById(
    id: number,
    db: Database = globalDb as Database
): Promise<Coverage> {
    if (!db) {
        throw new Error("Database instance is required");
    }
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
export async function createCoverage(
    data: CreateCoverageInput,
    db: Database = globalDb as Database
): Promise<Coverage> {
    if (!db) {
        throw new Error("Database instance is required");
    }
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
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
        return getCoverageById(result.id, db);
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
export async function updateCoverage(
    id: number,
    data: UpdateCoverageInput,
    db: Database = globalDb as Database
): Promise<Coverage> {
    if (!db) {
        throw new Error("Database instance is required");
    }
    await getCoverageById(id, db); // Check existence

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
        return getCoverageById(id, db);
    }

    updates.updated_at = "datetime('now')";
    const setClausesArr = Object.keys(updates)
        .filter(key => key !== 'updated_at')
        .map(key => `${key} = ?`);
    setClausesArr.push("updated_at = datetime('now')");
    
    const setClauses = setClausesArr.join(", ");
    const values = Object.values(updates).filter(v => v !== "datetime('now')");

    const sql = `UPDATE coverage SET ${setClauses} WHERE id = ?;`;

    try {
        const stmt = db.prepare(sql);
        stmt.run(...values, id);
        return getCoverageById(id, db);
    } catch (error) {
        console.error(`Error updating coverage entry ${id}:`, error);
        throw new Error("Failed to update coverage entry.");
    }
}

/**
 * Deletes a coverage entry by its ID.
 * @param id - The ID of the coverage entry to delete.
 */
export async function deleteCoverage(
    id: number,
    db: Database = globalDb as Database
): Promise<{ success: boolean }> {
    if (!db) {
        throw new Error("Database instance is required");
    }
    await getCoverageById(id, db); // Check existence

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
export async function bulkUpdateCoverage(
    coverageData: BulkCoverageInput[],
    db: Database = globalDb as Database
): Promise<Coverage[]> {
    if (!db) {
        throw new Error("Database instance is required");
    }
    try {
        // Safeguard: if no data provided, return empty array
        if (!coverageData || coverageData.length === 0) {
            console.log("bulkUpdateCoverage called with empty data, no changes made.");
            return [];
        }

        // First, identify which days we're updating
        const dayIndices = [...new Set(coverageData.map(item => item.day_index))];
        console.log(`Deleting existing coverage for days: ${dayIndices.join(', ')}`);

        // Start a transaction
        db.transaction(() => {
            // Delete existing entries for the affected days
            for (const dayIndex of dayIndices) {
                const deleteStmt = db.prepare("DELETE FROM coverage WHERE day_index = ?");
                deleteStmt.run(dayIndex);
            }

            // Insert the new entries
            const sql = `
                INSERT INTO coverage (
                    day_index, start_time, end_time, min_employees, max_employees,
                    employee_types, allowed_employee_groups, requires_keyholder,
                    keyholder_before_minutes, keyholder_after_minutes,
                    created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `;
            const insertStmt = db.prepare(sql);

            for (const item of coverageData) {
                const requires_keyholder_int = item.requires_keyholder ? 1 : 0;
                const employee_types_json = JSON.stringify(item.employee_types ?? []);
                const allowed_groups_json = item.allowed_employee_groups 
                    ? JSON.stringify(item.allowed_employee_groups) 
                    : null;

                insertStmt.run(
                    item.day_index,
                    item.start_time,
                    item.end_time,
                    item.min_employees ?? 1,
                    item.max_employees ?? 3,
                    employee_types_json,
                    allowed_groups_json,
                    requires_keyholder_int,
                    item.keyholder_before_minutes ?? null,
                    item.keyholder_after_minutes ?? null
                );
            }
        })();

        console.log(`Successfully inserted ${coverageData.length} coverage entries for days: ${dayIndices.join(', ')}`);
        
        // Return all coverage entries for the affected days
        const result: Coverage[] = [];
        
        for (const dayIndex of dayIndices) {
            const query = db.query("SELECT * FROM coverage WHERE day_index = ?");
            const rows = query.all(dayIndex) as any[];
            
            if (rows && rows.length > 0) {
                rows.forEach(row => {
                    result.push(mapRowToCoverage(row));
                });
            }
        }
        
        return result;
    } catch (error) {
        console.error("Error in bulkUpdateCoverage:", error);
        throw new Error("Failed to update coverage entries in bulk.");
    }
}

export async function getCoverageForDay(
    dayIndex: number,
    db: Database = globalDb as Database
): Promise<Coverage[]> {
    if (!db) {
        throw new Error("Database instance is required");
    }
    try {
        const query = db.query("SELECT * FROM coverage WHERE day_index = ? ORDER BY start_time;");
        const rows = query.all(dayIndex) as any[];
        
        // Convert rows to array if it isn't already
        const resultsArray = Array.isArray(rows) ? rows : [];
        
        return resultsArray.map(mapRowToCoverage);
    } catch (error) {
        console.error(`Error fetching coverage entries for day ${dayIndex}:`, error);
        throw new Error(`Failed to retrieve coverage entries for day ${dayIndex}.`);
    }
}

export async function deleteCoverageEntry(
    id: number,
    db: Database = globalDb as Database
): Promise<boolean> {
    if (!db) {
        throw new Error("Database instance is required");
    }
    try {
        // Check if entry exists first
        const checkQuery = db.query("SELECT id FROM coverage WHERE id = ?;");
        const exists = checkQuery.get(id);
        
        if (!exists) {
            throw new NotFoundError(`Coverage entry with id ${id} not found.`);
        }
        
        const query = db.query("DELETE FROM coverage WHERE id = ?;");
        query.run(id);
        
        return true;
    } catch (error) {
        console.error(`Error deleting coverage entry ${id}:`, error);
        if (error instanceof NotFoundError) throw error;
        throw new Error(`Failed to delete coverage entry ${id}.`);
    }
} 