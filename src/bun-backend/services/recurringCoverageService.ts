// src/bun-backend/services/recurringCoverageService.ts
import db from "../db"; // Import the initialized DB connection
import { SQLQueryBindings } from "bun:sqlite"; // Import type for bindings
// Potentially import Employee and ShiftTemplate types if needed for joins/return types
// import { Employee } from "./employeesService";
// import { ShiftTemplate } from "./shiftTemplatesService"; // Assuming this exists

// Define the structure for RecurringCoverage based on the schema
// NOTE: Using INTEGER for ID as SQLite typically uses autoincrementing integers
export interface RecurringCoverage {
    id: number;
    shift_template_id: number; // Assuming FKs are numbers
    employee_id: number | null; // Assuming FKs are numbers
    recurrence_rule: string;
    start_date: string; // Store dates as ISO 8601 strings (TEXT in SQLite)
    end_date: string | null;
    start_time: string; // Store time as "HH:MM" string
    end_time: string;
    notes: string | null;
    created_at: string;
    updated_at: string;

    // Optional: Include joined data if fetching together
    // shift_template?: ShiftTemplate;
    // employee?: Employee;
}

// Input type for creating (omit generated fields like id, created_at, updated_at)
export interface CreateRecurringCoverageInput {
    shift_template_id: number;
    employee_id?: number | null; // Optional or nullable
    recurrence_rule: string;
    start_date: string; // Expect ISO 8601 string
    end_date?: string | null; // Expect ISO 8601 string
    start_time: string; // Expect "HH:MM"
    end_time: string; // Expect "HH:MM"
    notes?: string | null;
}

// Input type for updating (all fields optional)
export interface UpdateRecurringCoverageInput {
    shift_template_id?: number;
    employee_id?: number | null;
    recurrence_rule?: string;
    start_date?: string;
    end_date?: string | null;
    start_time?: string;
    end_time?: string;
    notes?: string | null;
}

// Helper function to map raw DB row to RecurringCoverage interface
// TODO: Implement mapping logic, handling potential nulls and type conversions
function mapRowToRecurringCoverage(row: any): RecurringCoverage {
     if (!row) return null as any; // Handle case where row might be null

     // Basic mapping - refine as needed for type safety and null handling
     return {
        id: row.id,
        shift_template_id: row.shift_template_id,
        employee_id: row.employee_id, // SQLite returns null directly
        recurrence_rule: row.recurrence_rule,
        start_date: row.start_date,
        end_date: row.end_date,
        start_time: row.start_time,
        end_time: row.end_time,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
     };
}


// --- Service Functions ---

export async function getAllRecurringCoverages(): Promise<RecurringCoverage[]> {
    // TODO: Add JOINs if needed to fetch related employee/shiftTemplate data
    const query = db.query("SELECT * FROM recurring_coverage ORDER BY start_date ASC;");
    const rows = query.all() as any[];
    return rows.map(mapRowToRecurringCoverage);
}

export async function getRecurringCoverageById(id: number): Promise<RecurringCoverage | null> {
     // TODO: Add JOINs if needed
    const query = db.query("SELECT * FROM recurring_coverage WHERE id = ?;");
    const row = query.get(id) as any;
    return row ? mapRowToRecurringCoverage(row) : null;
}

export async function createRecurringCoverage(data: CreateRecurringCoverageInput): Promise<RecurringCoverage> {
    const sql = `
        INSERT INTO recurring_coverage (
            shift_template_id, employee_id, recurrence_rule, start_date, end_date,
            start_time, end_time, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `;
    const params: SQLQueryBindings[] = [
        data.shift_template_id,
        data.employee_id ?? null, // Handle undefined/null
        data.recurrence_rule,
        data.start_date, // Assume validated ISO string
        data.end_date ?? null, // Handle undefined/null
        data.start_time, // Assume validated HH:MM
        data.end_time,   // Assume validated HH:MM
        data.notes ?? null,
    ];

     try {
         let lastId: number | bigint | undefined;
         // Use transaction for insert + getting last ID safely
          db.transaction(() => {
             const insertStmt = db.prepare(sql);
             insertStmt.run(...params);
             // Add type assertion to clarify expected return type
             const result = db.query("SELECT last_insert_rowid() as id;").get() as { id?: number | bigint };
             lastId = result?.id;
         })(); // Immediately invoke

         if (lastId === undefined || lastId === null) {
             throw new Error("Failed to get last insert ID after creating recurring coverage.");
         }

         const newRecord = await getRecurringCoverageById(Number(lastId));
         if (!newRecord) {
             throw new Error("Failed to retrieve newly created recurring coverage.");
         }
         return newRecord;

     } catch (error: any) {
         console.error("Error creating recurring coverage:", error);
         // TODO: Add specific error handling (e.g., FOREIGN KEY constraint)
         if (error.message?.includes('FOREIGN KEY constraint failed')) {
            throw new Error(`Invalid shift_template_id or employee_id provided.`);
         }
         throw new Error("Database error during recurring coverage creation.");
     }
}

export async function updateRecurringCoverage(id: number, data: UpdateRecurringCoverageInput): Promise<RecurringCoverage | null> {
    const fields = Object.keys(data) as (keyof UpdateRecurringCoverageInput)[];
    if (fields.length === 0) {
        // Nothing to update, maybe return existing record or throw error?
        return getRecurringCoverageById(id);
    }

    // Dynamically build SET clause
    const setClauses = fields.map(field => `${field} = ?`);
    // Add updated_at timestamp automatically
    setClauses.push("updated_at = datetime('now')");

    const sql = `
        UPDATE recurring_coverage
        SET ${setClauses.join(', ')}
        WHERE id = ?;
    `;

    // Map field names to values, handling potential nulls
    const paramsWithPotentialUndefined: (SQLQueryBindings | undefined)[] = fields.map(field => {
        const value = data[field];
         // Special handling for nullable fields being explicitly set to null
         if ((field === 'employee_id' || field === 'end_date' || field === 'notes') && value === null) {
             return null;
         }
         // Return the value directly; undefined values are implicitly handled
         // because `fields` comes from Object.keys(data)
         return value as SQLQueryBindings; // Assert type here, undefined shouldn't occur
    });

    // Filter out any potential undefined values (though unlikely with current logic)
    const params = paramsWithPotentialUndefined.filter(p => p !== undefined);

    params.push(id); // Add the id for the WHERE clause

    try {
        const updateStmt = db.prepare(sql);
        const result = updateStmt.run(...params); // Use run for UPDATE

        if (result.changes === 0) {
             // Check if the record actually existed before attempting update
            const exists = await getRecurringCoverageById(id);
            if (!exists) {
                 throw new Error(`Recurring coverage with id ${id} not found for update.`);
            } else {
                 // Update was valid but resulted in no changes (e.g., same data)
                 console.log(`Update for recurring coverage ${id} resulted in 0 changes.`);
                 return exists; // Return existing record
            }
        }

        // Fetch and return the updated record
        return await getRecurringCoverageById(id);

    } catch (error: any) {
        console.error(`Error updating recurring coverage ${id}:`, error);
        // TODO: Add specific error handling
        if (error.message?.includes('FOREIGN KEY constraint failed')) {
            throw new Error(`Invalid shift_template_id or employee_id provided during update.`);
        }
         if (error.message?.includes('not found for update')) {
            throw error; // Re-throw the specific "not found" error
        }
        throw new Error("Database error during recurring coverage update.");
    }
}


export async function deleteRecurringCoverage(id: number): Promise<boolean> {
    const sql = "DELETE FROM recurring_coverage WHERE id = ?;";
    try {
        const deleteStmt = db.prepare(sql);
        const result = deleteStmt.run(id);

        if (result.changes === 0) {
            // Record was not found to delete
            return false;
        }
        return true; // Deletion successful

    } catch (error: any) {
        console.error(`Error deleting recurring coverage ${id}:`, error);
        // TODO: Add specific error handling (e.g., restricted delete due to FKs?)
        throw new Error("Database error during recurring coverage deletion.");
    }
} 