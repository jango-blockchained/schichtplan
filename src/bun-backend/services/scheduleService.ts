import db from "../db";
import { Schedule, Employee, ShiftTemplate, ScheduleVersionMeta, ScheduleStatus } from "../db/schema"; // Import relevant interfaces
import { SQLQueryBindings } from "bun:sqlite";

// Define a type for the combined schedule entry data
// This includes fields from Schedule, Employee (name), and ShiftTemplate (times)
interface ScheduleEntry extends Schedule {
    employee_name?: string;
    shift_start?: string | null;
    shift_end?: string | null;
    shift_duration_hours?: number | null; // Name matches ShiftTemplate field
    shift_shift_type_id?: string | null; // Use distinct name to avoid clash with Schedule.shift_type
}

// Function to map the raw database row (with joins) to the ScheduleEntry interface
function mapRowToScheduleEntry(row: any): ScheduleEntry {
    if (!row) {
        throw new Error("Invalid row data provided to mapRowToScheduleEntry.");
    }

    const entry: ScheduleEntry = {
        // Fields from schedules table
        id: row.s_id, // Use alias from query
        employee_id: row.s_employee_id,
        shift_id: row.s_shift_id ?? null,
        date: row.s_date,
        version: row.s_version,
        break_start: row.s_break_start ?? null,
        break_end: row.s_break_end ?? null,
        notes: row.s_notes ?? null,
        shift_type: row.s_shift_type ?? null, // Keep original schedule shift_type if needed
        availability_type: row.s_availability_type ?? null,
        status: row.s_status,
        created_at: row.s_created_at,
        updated_at: row.s_updated_at,

        // Fields from employees table (joined)
        employee_name: (row.e_first_name && row.e_last_name) ? `${row.e_first_name} ${row.e_last_name}` : undefined,

        // Fields from shift_templates table (joined)
        shift_start: row.st_start_time ?? null,
        shift_end: row.st_end_time ?? null,
        shift_duration_hours: row.st_duration_hours ?? null,
        shift_shift_type_id: row.st_shift_type_id ?? null, // Use alias/distinct name
    };
    return entry;
}


export async function getScheduleByVersion(version: number): Promise<ScheduleEntry[]> {
    // Basic validation
    if (isNaN(version) || version <= 0) {
        throw new Error("Invalid schedule version number provided.");
    }

    const sql = `
        SELECT
            s.id as s_id,
            s.employee_id as s_employee_id,
            s.shift_id as s_shift_id,
            s.date as s_date,
            s.version as s_version,
            s.break_start as s_break_start,
            s.break_end as s_break_end,
            s.notes as s_notes,
            s.shift_type as s_shift_type,
            s.availability_type as s_availability_type,
            s.status as s_status,
            s.created_at as s_created_at,
            s.updated_at as s_updated_at,
            e.first_name as e_first_name,
            e.last_name as e_last_name,
            st.start_time as st_start_time,
            st.end_time as st_end_time,
            st.duration_hours as st_duration_hours,
            st.shift_type_id as st_shift_type_id
        FROM schedules s
        JOIN employees e ON s.employee_id = e.id
        LEFT JOIN shift_templates st ON s.shift_id = st.id -- LEFT JOIN in case shift_id is null
        WHERE s.version = ?
        ORDER BY s.date, e.last_name, e.first_name, st.start_time;
    `;

    try {
        console.log(`Fetching schedule entries for version ${version}...`);
        const query = db.query(sql);
        const rows = query.all(version) as any[];

        console.log(`Found ${rows.length} schedule entries for version ${version}.`);

        const scheduleEntries = rows.map(mapRowToScheduleEntry);
        return scheduleEntries;

    } catch (error) {
        console.error(`Error fetching schedule for version ${version}:`, error);
        throw new Error("Failed to retrieve schedule from database.");
    }
}

// Function to map the raw database row to the ScheduleVersionMeta interface
function mapRowToScheduleVersionMeta(row: any): ScheduleVersionMeta {
    if (!row) {
        throw new Error("Invalid row data provided to mapRowToScheduleVersionMeta.");
    }

    // Basic validation for status enum
    const status = Object.values(ScheduleStatus).includes(row.status)
                   ? row.status
                   : ScheduleStatus.DRAFT; // Default to DRAFT if invalid

    const meta: ScheduleVersionMeta = {
        version: row.version,
        created_at: row.created_at,
        created_by: row.created_by ?? null,
        updated_at: row.updated_at ?? null,
        updated_by: row.updated_by ?? null,
        status: status,
        date_range_start: row.date_range_start,
        date_range_end: row.date_range_end,
        base_version: row.base_version ?? null,
        notes: row.notes ?? null,
    };
    return meta;
}

export async function getScheduleVersions(): Promise<ScheduleVersionMeta[]> {
    const sql = `
        SELECT * FROM schedule_version_meta
        ORDER BY version DESC;
    `;

    try {
        console.log("Fetching all schedule version metadata...");
        const query = db.query(sql);
        const rows = query.all() as any[];

        console.log(`Found ${rows.length} schedule versions.`);

        const versions = rows.map(mapRowToScheduleVersionMeta);
        return versions;

    } catch (error) {
        console.error("Error fetching schedule versions:", error);
        throw new Error("Failed to retrieve schedule versions from database.");
    }
}

// --- Placeholder for createNewVersion, updateScheduleEntry etc. --- 