import db from "../db";
import { SQLQueryBindings } from "bun:sqlite";

// Define the structure for ShiftPattern
export interface ShiftPattern {
    id: number;
    name: string;
    shift_template_ids: number[]; // Array of ShiftTemplate IDs
    created_at: string;
    updated_at: string;
}

// Input type for creating
export interface CreateShiftPatternInput {
    name: string;
    shift_template_ids: number[]; // Expect an array of numbers
}

// Input type for updating
export interface UpdateShiftPatternInput {
    name?: string;
    shift_template_ids?: number[]; // Allow updating the list
}

// Helper to map DB row, parsing JSON string for shift_template_ids
function mapRowToShiftPattern(row: any): ShiftPattern | null {
    if (!row) return null;
    try {
        return {
            id: row.id,
            name: row.name,
            // Parse the JSON string back into an array
            shift_template_ids: JSON.parse(row.shift_template_ids || '[]'),
            created_at: row.created_at,
            updated_at: row.updated_at,
        };
    } catch (error) {
        console.error(`Error parsing shift_template_ids for pattern id ${row.id}:`, error);
        // Return pattern with empty array or handle error differently
        return {
             id: row.id,
             name: row.name,
             shift_template_ids: [],
             created_at: row.created_at,
             updated_at: row.updated_at,
         };
    }
}

// --- Service Functions ---

export async function getAllShiftPatterns(): Promise<ShiftPattern[]> {
    const query = db.query("SELECT * FROM shift_patterns ORDER BY name ASC;");
    const rows = query.all() as any[];
    return rows.map(row => mapRowToShiftPattern(row)).filter(p => p !== null) as ShiftPattern[];
}

export async function getShiftPatternById(id: number): Promise<ShiftPattern | null> {
    const query = db.query("SELECT * FROM shift_patterns WHERE id = ?;");
    const row = query.get(id) as any;
    return mapRowToShiftPattern(row);
}

export async function createShiftPattern(data: CreateShiftPatternInput): Promise<ShiftPattern> {
    // Validate input data (basic check)
     if (!data.name || !Array.isArray(data.shift_template_ids)) {
        throw new Error("Invalid input data for creating shift pattern.");
    }

    const sql = `
        INSERT INTO shift_patterns (name, shift_template_ids)
        VALUES (?, ?);
    `;
    // Stringify the array for storage
    const shiftTemplateIdsJson = JSON.stringify(data.shift_template_ids);
    const params: SQLQueryBindings[] = [data.name, shiftTemplateIdsJson];

    try {
        let lastId: number | bigint | undefined;
        db.transaction(() => {
            const insertStmt = db.prepare(sql);
            insertStmt.run(...params);
            // Type assertion for safety
            const result = db.query("SELECT last_insert_rowid() as id;").get() as { id?: number | bigint }; 
            lastId = result?.id;
        })();

        if (lastId === undefined || lastId === null) {
            throw new Error("Failed to get last insert ID after creating shift pattern.");
        }

        const newRecord = await getShiftPatternById(Number(lastId));
        if (!newRecord) {
            throw new Error("Failed to retrieve newly created shift pattern.");
        }
        return newRecord;
    } catch (error: any) {
        console.error("Error creating shift pattern:", error);
         if (error.message?.includes('UNIQUE constraint failed: shift_patterns.name')) {
            throw new Error(`Shift pattern name '${data.name}' already exists.`);
         }
        // Consider checking for FK violations if shift_template_ids were validated against shift_templates table
        throw new Error("Database error during shift pattern creation.");
    }
}

export async function updateShiftPattern(id: number, data: UpdateShiftPatternInput): Promise<ShiftPattern | null> {
    const fields = Object.keys(data) as (keyof UpdateShiftPatternInput)[];
    if (fields.length === 0) {
        return getShiftPatternById(id); // No changes provided
    }

    const setClauses = fields.map(field => `${field} = ?`);
    setClauses.push("updated_at = datetime('now')");

    const sql = `
        UPDATE shift_patterns
        SET ${setClauses.join(', ')}
        WHERE id = ?;
    `;

    // Map values, stringifying shift_template_ids if present
    const params = fields.map(field => {
        const value = data[field];
        if (field === 'shift_template_ids' && Array.isArray(value)) {
            return JSON.stringify(value);
        }
        return value;
    }) as SQLQueryBindings[];
    params.push(id);

    try {
        const updateStmt = db.prepare(sql);
        const result = updateStmt.run(...params);

        if (result.changes === 0) {
            const exists = await getShiftPatternById(id);
            if (!exists) {
                throw new Error(`Shift pattern with id ${id} not found for update.`);
            }
             return exists; // No change made, return existing
        }

        return await getShiftPatternById(id); // Fetch updated record
    } catch (error: any) {
        console.error(`Error updating shift pattern ${id}:`, error);
        if (error.message?.includes('UNIQUE constraint failed: shift_patterns.name') && data.name) {
            throw new Error(`Shift pattern name '${data.name}' already exists.`);
        }
         if (error.message?.includes('not found for update')) {
            throw error; // Re-throw specific error
        }
        // Consider FK checks if validating IDs
        throw new Error("Database error during shift pattern update.");
    }
}

export async function deleteShiftPattern(id: number): Promise<boolean> {
    const sql = "DELETE FROM shift_patterns WHERE id = ?;";
    try {
        const deleteStmt = db.prepare(sql);
        const result = deleteStmt.run(id);
        return result.changes > 0; // Return true if a row was deleted
    } catch (error: any) {
        console.error(`Error deleting shift pattern ${id}:`, error);
        throw new Error("Database error during shift pattern deletion.");
    }
} 