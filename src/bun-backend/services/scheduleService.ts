import db from "../db";
import { Schedule, Employee, ShiftTemplate, ScheduleVersionMeta, ScheduleStatus } from "../db/schema"; // Import relevant interfaces
import { SQLQueryBindings } from "bun:sqlite";

// Corrected imports based on actual filenames
import { getAllEmployees, getEmployeeById } from './employeesService.js';
import { getAllShiftTemplates } from './shiftTemplateService.js';
import { getAllCoverage } from './coverageService.js';
import { getAllRecurringCoverage } from './recurringCoverageService.js';
import { getAvailabilitiesInRange } from './employeeAvailabilityService.js';
import { getAbsencesInRange } from './absenceService.js';

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

// --- Schedule Generation Logic --- 
export async function generateSchedule(startDate: string, endDate: string /*, options? */): Promise<any> {
    console.log(`Initiating schedule generation from ${startDate} to ${endDate}...`);

    try {
        // 1. Fetch necessary data
        console.log("Fetching input data for generation...");

        const employees = await getAllEmployees({ status: 'active' });
        const shiftTemplates = await getAllShiftTemplates();
        const coverages = await getAllCoverage();
        const recurringCoverages = await getAllRecurringCoverage();
        const availabilities = await getAvailabilitiesInRange(startDate, endDate);
        const absences = await getAbsencesInRange(startDate, endDate);

        console.log(`Data fetched: ${employees.length} employees, ${shiftTemplates.length} templates, ${coverages.length} coverage rules, ${recurringCoverages.length} recurring patterns, ${availabilities.length} availabilities, ${absences.length} absences.`);

        // 2. Preprocess data 
        console.log("Preprocessing data...");
        
        // 2.1 Create date range array for the schedule period
        const dates: string[] = [];
        let currentDate = new Date(startDate);
        const lastDate = new Date(endDate);
        
        while (currentDate <= lastDate) {
            dates.push(currentDate.toISOString().split('T')[0]); // YYYY-MM-DD format
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // 2.2 Pre-process availabilities by employee and date
        const availabilityMap = new Map<number, Map<string, Map<number, string>>>();
        
        for (const availability of availabilities) {
            // Create nested maps if they don't exist
            if (!availabilityMap.has(availability.employee_id)) {
                availabilityMap.set(availability.employee_id, new Map<string, Map<number, string>>());
            }
            
            // Process recurring or date-specific availabilities
            if (availability.is_recurring) {
                // For recurring availabilities, apply to all relevant dates in the range
                for (const date of dates) {
                    const dayOfWeek = new Date(date).getDay(); // 0-6 (Sun-Sat)
                    const adjustedDayOfWeek = (dayOfWeek + 6) % 7; // Convert to 0-6 (Mon-Sun)
                    
                    if (adjustedDayOfWeek === availability.day_of_week) {
                        if (!availabilityMap.get(availability.employee_id)!.has(date)) {
                            availabilityMap.get(availability.employee_id)!.set(date, new Map<number, string>());
                        }
                        availabilityMap.get(availability.employee_id)!.get(date)!.set(
                            availability.hour, 
                            availability.availability_type
                        );
                    }
                }
            } else if (
                availability.start_date && 
                availability.end_date && 
                new Date(availability.start_date) <= lastDate && 
                new Date(availability.end_date) >= new Date(startDate)
            ) {
                // For non-recurring, date-specific availabilities
                let specificStartDate = new Date(Math.max(
                    new Date(availability.start_date).getTime(), 
                    new Date(startDate).getTime()
                ));
                let specificEndDate = new Date(Math.min(
                    new Date(availability.end_date).getTime(), 
                    lastDate.getTime()
                ));
                
                while (specificStartDate <= specificEndDate) {
                    const date = specificStartDate.toISOString().split('T')[0];
                    const dayOfWeek = specificStartDate.getDay();
                    const adjustedDayOfWeek = (dayOfWeek + 6) % 7; // Convert to 0-6 (Mon-Sun)
                    
                    if (adjustedDayOfWeek === availability.day_of_week) {
                        if (!availabilityMap.get(availability.employee_id)!.has(date)) {
                            availabilityMap.get(availability.employee_id)!.set(date, new Map<number, string>());
                        }
                        availabilityMap.get(availability.employee_id)!.get(date)!.set(
                            availability.hour, 
                            availability.availability_type
                        );
                    }
                    
                    specificStartDate.setDate(specificStartDate.getDate() + 1);
                }
            }
        }
        
        // 2.3 Pre-process absences for easy lookup
        const absenceMap = new Map<number, Set<string>>();
        
        for (const absence of absences) {
            if (!absenceMap.has(absence.employee_id)) {
                absenceMap.set(absence.employee_id, new Set<string>());
            }
            
            let absenceStartDate = new Date(absence.start_date);
            const absenceEndDate = new Date(absence.end_date);
            
            while (absenceStartDate <= absenceEndDate) {
                const dateStr = absenceStartDate.toISOString().split('T')[0];
                absenceMap.get(absence.employee_id)!.add(dateStr);
                absenceStartDate.setDate(absenceStartDate.getDate() + 1);
            }
        }
        
        // 2.4 Process coverage requirements
        // Start with regular coverage rules
        const coverageRequirements = new Map<string, Array<{
            dayIndex: number;
            start: string;
            end: string;
            minEmployees: number;
            maxEmployees: number;
            requiresKeyholder: boolean;
        }>>();
        
        // Initialize for all dates
        for (const date of dates) {
            coverageRequirements.set(date, []);
        }
        
        // Process fixed coverage rules
        for (const coverage of coverages) {
            const dayIndex = coverage.day_index;
            
            for (const date of dates) {
                const dateDayIndex = (new Date(date).getDay() + 6) % 7;
                
                if (dateDayIndex === dayIndex) {
                    coverageRequirements.get(date)!.push({
                        dayIndex,
                        start: coverage.start_time,
                        end: coverage.end_time,
                        minEmployees: coverage.min_employees,
                        maxEmployees: coverage.max_employees,
                        requiresKeyholder: coverage.requires_keyholder
                    });
                }
            }
        }
        
        // Process recurring coverage rules
        for (const recurring of recurringCoverages) {
            if (!recurring.is_active) continue;
            
            // Check if the recurring rule applies to this date range
            const isInDateRange = 
                (!recurring.start_date || new Date(recurring.start_date) <= lastDate) &&
                (!recurring.end_date || new Date(recurring.end_date) >= new Date(startDate));
                
            if (isInDateRange) {
                for (const date of dates) {
                    const dateDayIndex = (new Date(date).getDay() + 6) % 7;
                    
                    if (recurring.days.includes(dateDayIndex)) {
                        coverageRequirements.get(date)!.push({
                            dayIndex: dateDayIndex,
                            start: recurring.start_time,
                            end: recurring.end_time,
                            minEmployees: recurring.min_employees,
                            maxEmployees: recurring.max_employees,
                            requiresKeyholder: recurring.requires_keyholder
                        });
                    }
                }
            }
        }

        // 3. Core Scheduling Algorithm
        console.log("Running core scheduling algorithm...");
        
        // Create a result array to hold all generated assignments
        const generatedEntries: Array<{
            employee_id: number;
            shift_id: number | null;
            date: string;
            version: number;
            status: ScheduleStatus;
            notes?: string | null;
        }> = [];
        
        // Get next available version number
        const nextVersion = ((await getScheduleVersions()).at(0)?.version ?? 0) + 1;
        
        // Process each date in the schedule
        for (const date of dates) {
            console.log(`Generating schedule for ${date}...`);
            
            const dayRequirements = coverageRequirements.get(date) || [];
            
            // Skip if no coverage is needed for this day
            if (dayRequirements.length === 0) {
                console.log(`No coverage requirements for ${date}, skipping.`);
                continue;
            }
            
            // Group employees by availability for this day
            // For now, simple algorithm:
            // 1. Sort requirements by start time
            // 2. For each requirement, assign available employees up to min requirements
            // 3. Prioritize employees who are key holders when needed
            dayRequirements.sort((a, b) => 
                a.start.localeCompare(b.start) || a.end.localeCompare(b.end)
            );
            
            // Track which employees were assigned for this day to avoid double-booking
            const assignedEmployees = new Set<number>();
            
            for (const requirement of dayRequirements) {
                // Find eligible employees (not absent, available at this time)
                const eligibleEmployees = employees.filter(employee => {
                    // Skip if already assigned today
                    if (assignedEmployees.has(employee.id)) return false;
                    
                    // Skip if absent
                    if (absenceMap.has(employee.id) && absenceMap.get(employee.id)!.has(date)) {
                        return false;
                    }
                    
                    // Check if keyholder is required and employee is not qualified
                    if (requirement.requiresKeyholder && !employee.is_keyholder) {
                        return false;
                    }
                    
                    // TODO: Add more sophisticated availability checking based on requirementStart/End hours
                    // For now, simplistic: employee is eligible if not absent and not already assigned
                    
                    return true;
                });
                
                // Sort by key holder status if required (key holders first)
                if (requirement.requiresKeyholder) {
                    eligibleEmployees.sort((a, b) => 
                        Number(b.is_keyholder) - Number(a.is_keyholder)
                    );
                }
                
                // Find appropriate shift template that matches the requirement hours
                const matchingShiftTemplate = shiftTemplates.find(template => 
                    template.start_time.startsWith(requirement.start) && 
                    template.end_time.startsWith(requirement.end)
                );
                
                // Assign up to minimum required employees
                const employeesToAssign = eligibleEmployees.slice(0, requirement.minEmployees);
                
                for (const employee of employeesToAssign) {
                    generatedEntries.push({
                        employee_id: employee.id,
                        shift_id: matchingShiftTemplate?.id || null,
                        date: date,
                        version: nextVersion,
                        status: ScheduleStatus.DRAFT,
                        notes: null
                    });
                    
                    // Mark as assigned to avoid double-booking
                    assignedEmployees.add(employee.id);
                }
            }
        }

        // 4. Save the generated schedule
        console.log(`Saving generated schedule as version ${nextVersion}...`);
        
        // 4.1 Create the version metadata entry
        const versionMetaSQL = `
            INSERT INTO schedule_version_meta 
            (version, status, date_range_start, date_range_end, notes) 
            VALUES (?, ?, ?, ?, ?)
        `;
        
        db.run(
            versionMetaSQL, 
            [
                nextVersion, 
                ScheduleStatus.DRAFT, 
                startDate, 
                endDate, 
                "Auto-generated schedule"
            ]
        );
        
        // 4.2 Insert all the schedule entries
        if (generatedEntries.length > 0) {
            const batchSize = 100; // Process in batches to avoid too many parameters
            
            for (let i = 0; i < generatedEntries.length; i += batchSize) {
                const batch = generatedEntries.slice(i, i + batchSize);
                
                let placeholders: string[] = [];
                let values: any[] = [];
                
                batch.forEach(entry => {
                    placeholders.push('(?, ?, ?, ?, ?)');
                    values.push(
                        entry.employee_id,
                        entry.shift_id,
                        entry.date,
                        entry.version,
                        entry.status
                    );
                });
                
                const scheduleSql = `
                    INSERT INTO schedules
                    (employee_id, shift_id, date, version, status)
                    VALUES ${placeholders.join(', ')}
                `;
                
                db.run(scheduleSql, values);
            }
        }
        
        console.log(`Schedule Version ${nextVersion} generated and saved with ${generatedEntries.length} entries.`);

        return { 
            newVersion: nextVersion, 
            status: "DRAFT",
            entryCount: generatedEntries.length 
        };

    } catch (error: any) {
        console.error("Schedule generation failed:", error);
        throw new Error(`Schedule generation failed: ${error.message}`);
    }
}


// --- Placeholder for createNewVersion, updateScheduleEntry etc. --- 

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

export async function createNewScheduleVersion(data: CreateVersionRequest): Promise<CreateVersionResponse> {
  console.log("Creating new schedule version with data:", data);
  
  // Basic Input Validation
  if (!data.start_date || !data.end_date) {
    throw new Error("Start date and end date are required to create a new version.");
  }
  
  // Validate date format and range
  const startDate = new Date(data.start_date);
  const endDate = new Date(data.end_date);
  
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error("Invalid date format. Dates must be in YYYY-MM-DD format.");
  }
  
  if (startDate > endDate) {
    throw new Error("Start date must be before end date.");
  }
  
  try {
    // Fetch the latest version to determine the next one
    const versions = await getScheduleVersions();
    const latestVersion = versions.length > 0 ? versions[0].version : 0;
    const newVersionNumber = latestVersion + 1;

    console.log(`Assigning new version number: ${newVersionNumber}`);

    // If baseVersion specified, check that it exists
    if (data.base_version) {
      const baseVersionExists = versions.some(v => v.version === data.base_version);
      if (!baseVersionExists) {
        throw new Error(`Base version ${data.base_version} does not exist.`);
      }
    }

    // Insert new version metadata
    const insertSql = `
      INSERT INTO schedule_version_meta (
        version, 
        date_range_start, 
        date_range_end, 
        base_version, 
        notes, 
        status, 
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    `;
    
    db.run(
      insertSql, 
      [newVersionNumber, 
      data.start_date, 
      data.end_date, 
      data.base_version ?? null, 
      data.notes ?? null, 
      ScheduleStatus.DRAFT]
    );

    console.log(`Created schedule version metadata for version ${newVersionNumber}.`);

    // Copy entries from base version if specified
    if (data.base_version) {
      console.log(`Copying entries from base version ${data.base_version}...`);
      
      // Get date range of base version to determine which entries to copy
      const baseVersionMeta = versions.find(v => v.version === data.base_version);
      
      if (!baseVersionMeta) {
        throw new Error(`Failed to retrieve metadata for base version ${data.base_version}.`);
      }
      
      // Calculate date difference for shifting entries
      const baseStartDate = new Date(baseVersionMeta.date_range_start);
      const targetStartDate = new Date(data.start_date);
      const daysDifference = Math.round(
        (targetStartDate.getTime() - baseStartDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      console.log(`Date shift: ${daysDifference} days from base schedule`);
      
      // Copy and shift entries
      if (daysDifference === 0) {
        // Direct copy if no date shift
        const copySql = `
          INSERT INTO schedules (
            employee_id, shift_id, date, version,
            break_start, break_end, notes, shift_type,
            availability_type, status, created_at, updated_at
          )
          SELECT 
            employee_id, shift_id, date, ?,
            break_start, break_end, notes, shift_type,
            availability_type, 'DRAFT', 
            strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
            strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          FROM schedules
          WHERE version = ?
        `;
        
        db.run(copySql, [newVersionNumber, data.base_version]);
      } else {
        // Copy with date shift - slightly more complex
        const baseEntries = await db.query(`
          SELECT * FROM schedules WHERE version = ?
        `).all(data.base_version) as any[];
        
        // Process in batches to avoid too many parameters
        const batchSize = 100;
        
        for (let i = 0; i < baseEntries.length; i += batchSize) {
          const batch = baseEntries.slice(i, i + batchSize);
          
          if (batch.length === 0) break;
          
          const placeholders: string[] = [];
          const values: any[] = [];
          
          batch.forEach(entry => {
            // Calculate shifted date
            const entryDate = new Date(entry.date);
            entryDate.setDate(entryDate.getDate() + daysDifference);
            const shiftedDate = entryDate.toISOString().split('T')[0];
            
            placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            values.push(
              entry.employee_id,
              entry.shift_id,
              shiftedDate, // Shifted date
              newVersionNumber,
              entry.break_start,
              entry.break_end,
              entry.notes,
              entry.shift_type,
              entry.availability_type,
              ScheduleStatus.DRAFT,
              new Date().toISOString(), // created_at
              new Date().toISOString()  // updated_at
            );
          });
          
          const shiftedCopySql = `
            INSERT INTO schedules (
              employee_id, shift_id, date, version,
              break_start, break_end, notes, shift_type,
              availability_type, status, created_at, updated_at
            ) VALUES ${placeholders.join(', ')}
          `;
          
          db.run(shiftedCopySql, ...values);
        }
      }
      
      // Count the copied entries
      const entryCount = await db.query(`
        SELECT COUNT(*) as count FROM schedules WHERE version = ?
      `).get(newVersionNumber) as { count: number } | undefined;
      
      console.log(`Copied ${entryCount?.count || 0} entries to the new version.`);
    }

    return {
      new_version: newVersionNumber,
      status: "DRAFT_CREATED",
    };

  } catch (error: any) {
    console.error("Failed to create new schedule version:", error);
    throw new Error(`Failed to create new schedule version: ${error.message}`);
  }
} 