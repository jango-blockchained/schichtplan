import { getDb } from "../db";
import { Schedule, Employee, ShiftTemplate, ScheduleVersionMeta, ScheduleStatus, AvailabilityType } from "../db/schema"; // Import relevant interfaces
import { SQLQueryBindings, Database } from "bun:sqlite";
import { scheduleLogger } from "../logger"; // Import the specialized schedule logger

// Corrected imports based on actual filenames
import { getAllEmployees, getEmployeeById } from './employeesService.js';
import { getAllShiftTemplates } from './shiftTemplateService.js';
import { getAllCoverage } from './coverageService.js';
import { getAllRecurringCoverage } from './recurringCoverageService.js';
import { getAvailabilitiesInRange } from './employeeAvailabilityService.js';
import { getAbsencesInRange } from './absenceService.js';

// Import scheduler modules
import { generateScheduleAssignments, SchedulerConfiguration } from '../scheduler/assignment.js';
import { AIScoringConfig, DEFAULT_AI_CONFIG } from '../scheduler/aiScoring.js';
import { parseISO, format, eachDayOfInterval, differenceInMinutes, addMinutes } from 'date-fns';

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


export async function getScheduleByVersion(version: number, dbInstance?: Database): Promise<ScheduleEntry[]> {
    // Get database instance
    const db = dbInstance || getDb();
    
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
        scheduleLogger.info(`Fetching schedule entries for version ${version}...`);
        const query = db.query(sql);
        const rows = query.all(version) as any[];

        scheduleLogger.info(`Found ${rows.length} schedule entries for version ${version}.`);

        const scheduleEntries = rows.map(mapRowToScheduleEntry);
        return scheduleEntries;

    } catch (error) {
        scheduleLogger.error({ err: error }, `Error fetching schedule for version ${version}`);
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

export async function getScheduleVersions(startDate?: string, endDate?: string, dbInstance?: Database): Promise<ScheduleVersionMeta[]> {
    // Get database instance
    const db = dbInstance || getDb();
    
    let sql = `
        SELECT * FROM schedule_version_meta
    `;
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (startDate) {
        conditions.push("date_range_end >= ?");
        params.push(startDate);
    }
    if (endDate) {
        conditions.push("date_range_start <= ?");
        params.push(endDate);
    }

    if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(" AND ")}`;
    }
    
    sql += ` ORDER BY version DESC;`;

    try {
        scheduleLogger.info(`Fetching schedule version metadata${startDate || endDate ? ` between ${startDate || ''} and ${endDate || ''}` : '...'}`);
        scheduleLogger.debug("Executing SQL:", sql, "with params:", params);
        
        const query = db.query(sql);
        const rows = query.all(...params) as any[];

        scheduleLogger.info(`Found ${rows.length} schedule versions.`);

        const versions = rows.map(mapRowToScheduleVersionMeta);
        return versions;

    } catch (error) {
        scheduleLogger.error("Error fetching schedule versions:", error);
        throw new Error("Failed to retrieve schedule versions from database.");
    }
}

// --- Schedule Generation Logic --- 
export async function generateSchedule(
    startDate: string, 
    endDate: string, 
    createEmptySchedules: boolean = false,
    version?: number,
    dbInstance?: Database,
    options?: {
        schedulerConfig?: Partial<SchedulerConfiguration>;
        aiConfig?: Partial<AIScoringConfig>;
    }
): Promise<any> {
    // Get database instance
    const db = dbInstance || getDb();
    
    scheduleLogger.info(`Initiating AI-powered schedule generation from ${startDate} to ${endDate}...`);

    try {
        // 1. Create new version if not provided
        let scheduleVersion = version;
        if (!scheduleVersion) {
            const versionResult = await createNewScheduleVersion({
                start_date: startDate,
                end_date: endDate,
                notes: "AI-generated schedule"
            }, db);
            scheduleVersion = versionResult.new_version;
            scheduleLogger.info(`Created new schedule version: ${scheduleVersion}`);
        }

        // 2. Fetch necessary data
        scheduleLogger.info("Fetching input data for generation...");

        const employees = await getAllEmployees({ status: 'active' }, db);
        const shiftTemplates = await getAllShiftTemplates(db);
        const coverages = await getAllCoverage(db);
        const recurringCoverages = await getAllRecurringCoverage(db);
        const availabilities = await getAvailabilitiesInRange(startDate, endDate, db);
        const absences = await getAbsencesInRange(startDate, endDate, db);

        scheduleLogger.info(`Data fetched: ${employees.length} employees, ${shiftTemplates.length} templates, ${coverages.length} coverage rules, ${recurringCoverages.length} recurring patterns, ${availabilities.length} availabilities, ${absences.length} absences.`);

        // 3. Generate expanded coverage requirements (15-minute slots)
        const expandedCoverage: any[] = [];
        const slotCandidatesMap = new Map();
        const dailyOperatingHours = new Map();
        
        // Get all dates in range
        const dates = eachDayOfInterval({ 
            start: parseISO(startDate), 
            end: parseISO(endDate) 
        });

        // For each date, expand coverage requirements into 15-minute slots
        for (const date of dates) {
            const dateStr = format(date, 'yyyy-MM-dd');
            
            // Find applicable coverage rules for this date
            const applicableCoverages = [...coverages, ...recurringCoverages].filter(cov => {
                // TODO: Implement proper coverage date checking logic
                return true; // Placeholder - apply all coverages for now
            });

            // Set default operating hours (TODO: get from settings/coverage)
            dailyOperatingHours.set(dateStr, {
                open: { hours: 8, minutes: 0 },
                close: { hours: 20, minutes: 0 }
            });

            // Create 15-minute slots for the day (8:00 to 20:00 for now)
            const dayStart = new Date(date);
            dayStart.setHours(8, 0, 0, 0);
            const dayEnd = new Date(date);
            dayEnd.setHours(20, 0, 0, 0);

            let slotTime = dayStart;
            while (slotTime < dayEnd) {
                const slotEnd = addMinutes(slotTime, 15);
                const slotId = slotTime.toISOString();
                
                // Determine min/max employees needed for this slot
                // TODO: Calculate from coverage rules
                const requiredSlot = {
                    id: slotId,
                    startTime: new Date(slotTime),
                    endTime: slotEnd,
                    minEmployees: 2, // Placeholder
                    maxEmployees: 4, // Placeholder
                };
                
                expandedCoverage.push(requiredSlot);

                // Determine available candidates for this slot
                const candidates = employees
                    .filter(emp => {
                        // Check availability - need to check day_of_week and hour
                        const slotDayOfWeek = slotTime.getDay();
                        const slotHour = slotTime.getHours();
                        
                        const isAvailable = availabilities.some(avail => 
                            avail.employee_id === emp.id &&
                            avail.day_of_week === slotDayOfWeek &&
                            avail.hour === slotHour &&
                            avail.availability_type !== AvailabilityType.UNAVAILABLE
                        );
                        
                        // Check absence
                        const isAbsent = absences.some(absence =>
                            absence.employee_id === emp.id &&
                            parseISO(absence.start_date) <= slotTime &&
                            parseISO(absence.end_date) >= slotTime
                        );
                        
                        return isAvailable && !isAbsent;
                    })
                    .map(emp => ({ employeeId: emp.id.toString() }));

                slotCandidatesMap.set(slotId, candidates);
                
                slotTime = slotEnd;
            }
        }

        scheduleLogger.info(`Generated ${expandedCoverage.length} time slots for scheduling`);

        // 4. Prepare employee data for scheduler
        const schedulerEmployees = employees.map(emp => ({
            id: emp.id.toString(),
            name: `${emp.first_name} ${emp.last_name}`,
            qualifications: [], // TODO: Load from database
            unavailability: absences
                .filter(a => a.employee_id === emp.id)
                .map(a => ({
                    start: parseISO(a.start_date),
                    end: parseISO(a.end_date)
                })),
            maxHoursPerWeek: emp.contracted_hours, // Use contracted_hours instead
            isKeyholderQualified: emp.can_be_keyholder || false,
            preferences: {
                dayPreferences: [],
                timePreferences: []
            }
        }));

        // 5. Configure scheduler
        const schedulerConfig: SchedulerConfiguration = {
            minShiftMinutes: 120,        // 2 hours
            maxShiftMinutes: 600,        // 10 hours
            slotIntervalMinutes: 15,
            maxConsecutiveDays: 6,
            defaultMinRestPeriodMinutes: 11 * 60, // 11 hours
            defaultMaxDailyMinutes: 8 * 60,      // 8 hours
            defaultAbsoluteMaxDailyMinutes: 10 * 60, // 10 hours
            breakThresholdMinutes: 6 * 60, // 6 hours
            breakDurationMinutes: 30,      // 30 minutes
            enforceKeyholderRule: true,
            openingLeadTimeMinutes: 5,
            closingLagTimeMinutes: 15,
            ...options?.schedulerConfig
        };

        // 6. Run AI-powered scheduler
        scheduleLogger.info("Running AI-powered schedule optimization...");
        
        const scheduleResult = await generateScheduleAssignments(
            expandedCoverage,
            slotCandidatesMap,
            schedulerEmployees,
            dailyOperatingHours,
            schedulerConfig,
            options?.aiConfig ? { ...DEFAULT_AI_CONFIG, ...options.aiConfig } : undefined,
            db
        );

        scheduleLogger.info(`AI Scheduler completed: ${scheduleResult.assignments.length} shifts assigned, ${scheduleResult.unfilledSlots.length} unfilled slots`);

        // 7. Save assignments to database
        if (scheduleResult.assignments.length > 0) {
            scheduleLogger.info("Saving schedule assignments to database...");
            
            const insertStmt = db.prepare(`
                INSERT INTO schedules (
                    employee_id, shift_id, date, version,
                    break_start, break_end, notes, shift_type, 
                    availability_type, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `);

            // Find appropriate shift templates for assignments
            const shiftTemplateMap = new Map();
            for (const template of shiftTemplates) {
                const key = `${template.start_time}-${template.end_time}`;
                shiftTemplateMap.set(key, template.id);
            }

            let savedCount = 0;
            for (const assignment of scheduleResult.assignments) {
                try {
                    // Find matching shift template
                    const startTime = format(assignment.startTime, 'HH:mm:ss');
                    const endTime = format(assignment.endTime, 'HH:mm:ss');
                    const templateKey = `${startTime}-${endTime}`;
                    let shiftTemplateId = shiftTemplateMap.get(templateKey);

                    // If no exact match, create a custom shift entry (null shift_id)
                    if (!shiftTemplateId) {
                        scheduleLogger.debug(`No template found for ${templateKey}, creating custom shift`);
                        shiftTemplateId = null;
                    }

                    // Calculate break times if applicable
                    let breakStart = null;
                    let breakEnd = null;
                    if (assignment.breakDurationMinutes) {
                        // Place break in the middle of the shift
                        const shiftMiddle = new Date(
                            assignment.startTime.getTime() + 
                            (assignment.durationMinutes / 2) * 60 * 1000
                        );
                        breakStart = format(shiftMiddle, 'HH:mm:ss');
                        breakEnd = format(
                            addMinutes(shiftMiddle, assignment.breakDurationMinutes),
                            'HH:mm:ss'
                        );
                    }

                    insertStmt.run(
                        parseInt(assignment.employeeId), // Convert string back to number for DB
                        shiftTemplateId,
                        format(assignment.startTime, 'yyyy-MM-dd'),
                        scheduleVersion,
                        breakStart,
                        breakEnd,
                        'AI-generated',
                        'work', // shift_type
                        null, // availability_type
                        ScheduleStatus.DRAFT
                    );
                    savedCount++;
                } catch (error) {
                    scheduleLogger.error(`Error saving assignment for employee ${assignment.employeeId}:`, error);
                }
            }

            scheduleLogger.info(`Saved ${savedCount} schedule assignments to database`);
        }

        // 8. Create empty schedules if requested
        if (createEmptySchedules) {
            scheduleLogger.info("Creating empty schedule entries for all employees...");
            
            const emptyStmt = db.prepare(`
                INSERT INTO schedules (
                    employee_id, shift_id, date, version,
                    shift_type, availability_type, status, 
                    created_at, updated_at
                ) VALUES (?, NULL, ?, ?, 'off', NULL, ?, datetime('now'), datetime('now'))
            `);

            let emptyCount = 0;
            for (const date of dates) {
                const dateStr = format(date, 'yyyy-MM-dd');
                
                // Check which employees already have assignments for this date
                const assignedEmployees = new Set(
                    scheduleResult.assignments
                        .filter(a => format(a.startTime, 'yyyy-MM-dd') === dateStr)
                        .map(a => a.employeeId)
                );

                // Create empty entries for unassigned employees
                for (const employee of employees) {
                    if (!assignedEmployees.has(employee.id.toString())) {
                        try {
                            emptyStmt.run(
                                employee.id.toString(),
                                dateStr,
                                scheduleVersion,
                                ScheduleStatus.DRAFT
                            );
                            emptyCount++;
                        } catch (error) {
                            scheduleLogger.debug(`Skipping empty entry for ${employee.id} on ${dateStr}:`, error);
                        }
                    }
                }
            }

            scheduleLogger.info(`Created ${emptyCount} empty schedule entries`);
        }

        // 9. Prepare response
        const response = {
            status: "SUCCESS",
            message: "AI-powered schedule generation completed",
            version: scheduleVersion,
            dates: [startDate, endDate],
            counts: {
                employees: employees.length,
                assignments: scheduleResult.assignments.length,
                unfilledSlots: scheduleResult.unfilledSlots.length,
                warnings: scheduleResult.warnings.length,
            },
            warnings: scheduleResult.warnings,
            logs: [
                {
                    timestamp: new Date().toISOString(),
                    level: "info",
                    message: `Generated ${scheduleResult.assignments.length} shift assignments`,
                },
                {
                    timestamp: new Date().toISOString(),
                    level: scheduleResult.unfilledSlots.length > 0 ? "warning" : "info",
                    message: `${scheduleResult.unfilledSlots.length} time slots could not be filled`,
                },
            ],
            // Include assignments for debugging/review
            schedules: scheduleResult.assignments.map(a => ({
                employee_id: a.employeeId,
                shift_id: null, // Will be set when matched to template
                date: format(a.startTime, 'yyyy-MM-dd'),
                start_time: format(a.startTime, 'HH:mm:ss'),
                end_time: format(a.endTime, 'HH:mm:ss'),
                duration_hours: a.durationMinutes / 60,
                break_duration_minutes: a.breakDurationMinutes,
            })),
        };

        return response;
    } catch (error) {
        scheduleLogger.error("Error in AI schedule generation:", error);
        throw new Error(`AI schedule generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

interface CreateVersionRequest {
  start_date: string;
  end_date: string;
  base_version?: number;
  notes?: string;
}

interface CreateVersionResponse {
  new_version: number;
  status: string; // e.g., "DRAFT_CREATED"
}

export async function createNewScheduleVersion(data: CreateVersionRequest, dbInstance?: Database): Promise<CreateVersionResponse> {
    // Get database instance
    const db = dbInstance || getDb();
    
    const { start_date, end_date, base_version, notes } = data;

    // Input validation
    if (!start_date || !end_date) {
        throw new Error("Start date and end date are required.");
    }
    
    // Validate date format and range
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error("Invalid date format. Dates must be in YYYY-MM-DD format.");
    }
    
    if (startDate > endDate) {
        throw new Error("Start date must be before end date.");
    }

    // Get next version number
    let nextVersion = 1; // Default first version
    try {
        const versionQuery = db.query("SELECT MAX(version) as max_version FROM schedule_version_meta");
        const result = versionQuery.get() as { max_version: number };
        if (result && result.max_version) {
            nextVersion = result.max_version + 1;
        }
    } catch (error) {
        scheduleLogger.error("Error determining next version number:", error);
        throw new Error("Failed to create new schedule version.");
    }

    // Insert the new version metadata
    try {
        const insertSql = `
            INSERT INTO schedule_version_meta (
                version, 
                status, 
                date_range_start, 
                date_range_end, 
                base_version,
                notes, 
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'));
        `;
        const stmt = db.prepare(insertSql);
        stmt.run(
            nextVersion,
            ScheduleStatus.DRAFT, // Always start as draft
            start_date,
            end_date,
            base_version || null,
            notes || null
        );

        scheduleLogger.info(`Created new schedule version ${nextVersion} for period ${start_date} to ${end_date}`);

        // If we have a base version, copy its entries to this new version
        if (base_version) {
            scheduleLogger.info(`Copying entries from base version ${base_version} to new version ${nextVersion}...`);
            
            const copySql = `
                INSERT INTO schedules (
                    employee_id, shift_id, date, version, 
                    break_start, break_end, notes, shift_type, availability_type, status,
                    created_at, updated_at
                )
                SELECT 
                    employee_id, shift_id, date, ?, 
                    break_start, break_end, notes, shift_type, availability_type, ?,
                    datetime('now'), datetime('now')
                FROM schedules
                WHERE version = ?;
            `;
            const copyStmt = db.prepare(copySql);
            const copyResult = copyStmt.run(
                nextVersion, 
                ScheduleStatus.DRAFT, // Set all copied entries to draft
                base_version
            );
            
            scheduleLogger.info(`Copied ${copyResult.changes} schedule entries from version ${base_version} to ${nextVersion}.`);
        }

        return {
            new_version: nextVersion,
            status: base_version ? "DRAFT_COPIED" : "DRAFT_CREATED"
        };
    } catch (error) {
        scheduleLogger.error("Error creating new schedule version:", error);
        throw new Error("Failed to create new schedule version in database.");
    }
} 