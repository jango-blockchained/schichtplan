// src/bun-backend/services/recurringCoverageService.ts
import db from "../db"; // Import the initialized DB connection
import { type RecurringCoverage, EmployeeGroup } from '../db/schema'; // Import type
import { NotFoundError } from 'elysia';
// Potentially import Employee and ShiftTemplate types if needed for joins/return types
// import { Employee } from "./employeesService";
// import { ShiftTemplate } from "./shiftTemplatesService"; // Assuming this exists

// --- Input type definitions ---
// Input type for creating
type CreateRecurringCoverageInput = Omit<RecurringCoverage, 'id' | 'created_at' | 'updated_at'>;

// Input type for updating
type UpdateRecurringCoverageInput = Partial<Omit<RecurringCoverage, 'id' | 'created_at' | 'updated_at'>>;

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

// Helper to map database row to RecurringCoverage interface
function mapRowToRecurringCoverage(row: any): RecurringCoverage {
    if (!row) {
        throw new NotFoundError('RecurringCoverage row is undefined in mapRowToRecurringCoverage');
    }
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        days: safeJsonParseArray<number>(row.days, []).sort((a,b)=> a-b), // Parse and sort days
        start_date: row.start_date,
        end_date: row.end_date,
        start_time: row.start_time,
        end_time: row.end_time,
        min_employees: row.min_employees,
        max_employees: row.max_employees,
        allowed_employee_groups: safeJsonParseArray<EmployeeGroup>(row.allowed_employee_groups, []),
        requires_keyholder: Boolean(row.requires_keyholder),
        is_active: Boolean(row.is_active),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

// --- Service Functions ---

/**
 * Retrieves all recurring coverage entries from the database.
 */
export async function getAllRecurringCoverage(): Promise<RecurringCoverage[]> {
    try {
        const query = db.query<any, []>("SELECT * FROM recurring_coverage ORDER BY name;");
        const rows = query.all();
        return rows.map(mapRowToRecurringCoverage);
    } catch (error) {
        console.error("Error fetching all recurring coverage entries:", error);
        throw new Error("Failed to retrieve recurring coverage entries.");
    }
}

/**
 * Retrieves a single recurring coverage entry by its ID.
 */
export async function getRecurringCoverageById(id: number): Promise<RecurringCoverage> {
    try {
        const query = db.query<any, [number]>("SELECT * FROM recurring_coverage WHERE id = ?;");
        const row = query.get(id);

        if (!row) {
            throw new NotFoundError(`RecurringCoverage with id ${id} not found.`);
        }
        return mapRowToRecurringCoverage(row);
    } catch (error) {
        console.error(`Error fetching recurring coverage entry with id ${id}:`, error);
         if (error instanceof NotFoundError) {
             throw error;
         }
        throw new Error(`Failed to retrieve recurring coverage entry ${id}.`);
    }
}

/**
 * Creates a new recurring coverage entry.
 */
export async function createRecurringCoverage(data: CreateRecurringCoverageInput): Promise<RecurringCoverage> {
    const {
        name, description, days, start_date, end_date,
        start_time, end_time, min_employees, max_employees,
        allowed_employee_groups, requires_keyholder, is_active
    } = data;

    // Prepare data for DB insertion
    const days_json = JSON.stringify(days ?? []);
    const allowed_groups_json = allowed_employee_groups ? JSON.stringify(allowed_employee_groups) : null;
    const requires_keyholder_int = requires_keyholder ? 1 : 0;
    const is_active_int = is_active ? 1 : 0;

    const sql = `
        INSERT INTO recurring_coverage (
            name, description, days, start_date, end_date, start_time, end_time,
            min_employees, max_employees, allowed_employee_groups, requires_keyholder, is_active,
            created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        RETURNING id;`;

    try {
        const stmt = db.prepare(sql);
        const result = stmt.get(
            name,
            description ?? null,
            days_json,
            start_date ?? null,
            end_date ?? null,
            start_time,
            end_time,
            min_employees,
            max_employees,
            allowed_groups_json,
            requires_keyholder_int,
            is_active_int
        ) as { id: number };

        if (!result || !result.id) {
            throw new Error("Failed to create recurring coverage, no ID returned.");
        }
        console.log(`Recurring coverage created with ID: ${result.id}`);
        return getRecurringCoverageById(result.id); // Fetch the full new record
    } catch (error) {
        console.error("Error creating recurring coverage:", error);
        throw new Error("Failed to create recurring coverage in database.");
    }
}

/**
 * Updates an existing recurring coverage entry.
 */
export async function updateRecurringCoverage(id: number, data: UpdateRecurringCoverageInput): Promise<RecurringCoverage> {
    // Ensure the entry exists first
    await getRecurringCoverageById(id);

    const updates: Record<string, any> = {};

    // Map provided data to database format
    for (const [key, value] of Object.entries(data)) {
        if (value === undefined) continue;

        switch (key as keyof UpdateRecurringCoverageInput) {
            case 'days':
            case 'allowed_employee_groups':
                updates[key] = value === null ? null : JSON.stringify(value);
                break;
            case 'requires_keyholder':
            case 'is_active':
                updates[key] = value ? 1 : 0;
                break;
            case 'description':
            case 'start_date':
            case 'end_date':
                 updates[key] = value; // Handles null assignment correctly
                 break;
            // Add other specific fields if needed
            default:
                 // Directly use other fields like name, start_time, end_time, min/max_employees
                 updates[key] = value;
        }
    }

    if (Object.keys(updates).length === 0) {
        console.log(`No valid fields provided to update recurring coverage ${id}.`);
        return getRecurringCoverageById(id); // Return existing if no changes
    }

    // Build the SQL query dynamically
    updates.updated_at = "datetime('now')"; // Use SQLite function
    const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(", ");
    // Filter values to match the order of setClauses, excluding the direct function call
    const values = Object.keys(updates)
                         .filter(key => key !== 'updated_at')
                         .map(key => updates[key]);

    // Correctly handle the updated_at function call in SQL
    const sql = `UPDATE recurring_coverage SET ${setClauses.replace("updated_at = ?", "updated_at = datetime('now')")} WHERE id = ?;`;

    try {
        const stmt = db.prepare(sql);
        const info = stmt.run(...values, id);

        if (info.changes === 0) {
            console.warn(`RecurringCoverage update for id=${id} affected 0 rows. Record might have been deleted or data was identical.`);
            // Re-fetch to confirm current state (will throw if deleted)
            return getRecurringCoverageById(id);
        }

        console.log(`Recurring coverage ${id} updated successfully.`);
        return getRecurringCoverageById(id); // Return the updated record
    } catch (error) {
        console.error(`Error updating recurring coverage ${id}:`, error);
        throw new Error("Failed to update recurring coverage in database.");
    }
}

/**
 * Deletes a recurring coverage entry by its ID.
 */
export async function deleteRecurringCoverage(id: number): Promise<{ success: boolean }> {
    // Check existence first
    await getRecurringCoverageById(id);

    const sql = "DELETE FROM recurring_coverage WHERE id = ?;";
    try {
        const stmt = db.prepare(sql);
        const result = stmt.run(id);

        if (result.changes === 0) {
            console.warn(`Delete operation for RecurringCoverage id=${id} affected 0 rows.`);
            throw new NotFoundError(`RecurringCoverage with id ${id} likely deleted concurrently.`);
        }

        console.log(`Recurring coverage ${id} deleted successfully.`);
        return { success: true };
    } catch (error) {
        if (error instanceof NotFoundError) throw error;
        console.error(`Error deleting recurring coverage ${id}:`, error);
        throw new Error("Failed to delete recurring coverage.");
    }
} 