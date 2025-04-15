import { getDb } from "../db";
import { Database } from "bun:sqlite";
import { randomUUID } from 'node:crypto';
import { format, addDays, eachDayOfInterval, getDay, parseISO } from 'date-fns';
import { faker } from '@faker-js/faker';

// Import necessary services
import { getAllEmployees } from "./employeesService";
import { getSettings, wipeTablesService, getDatabaseTables } from "./settingsService";
import {
    AbsenceTypeDefinition,
    Settings,
    AvailabilityTypeDefinition,
    EmployeeTypeDefinition,
    ShiftTypeDefinition
} from "../db/schema"; // Import types
import logger from '../logger'; // Import logger

interface DemoDataResponse {
    message: string;
    status: string;
}

// Helper function to get a random element from an array
function getRandomElement<T>(arr: T[]): T | undefined {
    if (!arr || arr.length === 0) return undefined;
    return arr[Math.floor(Math.random() * arr.length)];
}

// Helper function for random integer within range
function getRandomInt(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates comprehensive demo data in a specific order.
 * Wipes previous demo-related data first.
 *
 * @param db - Optional Database instance.
 * @returns A promise resolving to a DemoDataResponse object.
 */
export async function generateOptimizedDemoDataService(
    db: Database | null = getDb()
): Promise<DemoDataResponse> {
    logger.info("Initiating comprehensive demo data generation...");

    if (!db) {
        throw new Error("Database connection is required for generating demo data");
    }

    try {
        // 1. Wipe existing demo-related data
        // Ensure all relevant tables are included
        const tablesToWipe = [
            'absences',
            'employee_availabilities',
            'schedules',
            'schedule_version_meta',
            'coverage',
            'recurring_coverage',
            'shift_templates',
            'employees' // Wipe employees last due to FK constraints
        ];
        logger.info(`Wiping tables: ${tablesToWipe.join(', ')}`);
        // Validate tables before wiping
        const validTables = await getDatabaseTables(db);
        const finalTablesToWipe = tablesToWipe.filter(t => validTables.includes(t));
        if (finalTablesToWipe.length > 0) {
            await wipeTablesService(finalTablesToWipe, db);
        } else {
            logger.warn("No valid tables found to wipe.");
        }

        // 2. Fetch Settings (needed for types)
        logger.info("Fetching settings...");
        const settings = await getSettings(db);
        const employeeTypes: EmployeeTypeDefinition[] = settings.employee_types || [];
        const shiftTypes: ShiftTypeDefinition[] = settings.shift_types || [];
        const absenceTypes: AbsenceTypeDefinition[] = settings.absence_types || [];
        const availabilityTypes: AvailabilityTypeDefinition[] = settings.availability_types || [];

        if (employeeTypes.length === 0) {
             logger.warn("Employee types not defined in settings. Using placeholders.")
             // Add fallback types if needed, or throw error
        }
        if (shiftTypes.length === 0) logger.warn("Shift types not defined in settings.");
        if (absenceTypes.length === 0) logger.warn("Absence types not defined in settings.");
        if (availabilityTypes.length === 0) logger.warn("Availability types not defined in settings.");

        // Use actual opening days from settings
        const actualOpeningDays = settings.opening_days || {}; // Default to empty if undefined
        const openDayIndices = Object.entries(actualOpeningDays)
            .filter(([, isOpen]) => isOpen)
            .map(([dayIndex]) => parseInt(dayIndex, 10)); // Get numerical indices [1, 2, 3, 4, 5, 6]

        logger.info("Actual open day indices from settings:", openDayIndices);

        // 3. Generate Employees (30 total, specific distribution, standard hours)
        logger.info("Generating 30 demo employees with type distribution and standard hours...");
        const employeeInsertSql = `INSERT INTO employees (employee_id, first_name, last_name, employee_group, contracted_hours, is_keyholder, is_active, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
        const employeeStmt = db.prepare(employeeInsertSql);
        const employeesToInsert: any[][] = [];
        const firstNames = ["Alex", "Jamie", "Chris", "Max", "Lea", "Nico", "Sam", "Kim", "Ben", "Mia", "Jan", "Tina", "Leo", "Sara", "Tom", "Finn", "Lina", "Luca", "Emil", "Ida", "Paul", "Clara", "Noah", "Anna", "Felix", "Lara", "Luis", "Marie", "Jona", "Ella"];
        const lastNames = ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann", "Bauer", "Koch", "Richter", "Klein", "Wolf"];
        const usedEmails = new Set<string>();
        let calculatedTotalHours = 0; // Still calculate for logging purposes

        const tlType = employeeTypes.find(t => t.id === 'TL');
        const vzType = employeeTypes.find(t => t.id === 'VZ');
        const tzType = employeeTypes.find(t => t.id === 'TZ');
        const gfbType = employeeTypes.find(t => t.id === 'GFB');

        // Calculate how many employees should be keyholders (70% of total)
        const totalEmployees = 30;
        const targetKeyholders = Math.ceil(totalEmployees * 0.7); // 70% of employees
        let remainingKeyholders = targetKeyholders;

        // Assign types and standard hours
        for (let i = 1; i <= totalEmployees; i++) {
            const empId = String(i).padStart(3, '0');
            let assignedType: EmployeeTypeDefinition | undefined;
            let standardHours = 0;

            if (i === 1) { // Assign TL
                assignedType = tlType;
                standardHours = assignedType?.max_hours ?? 40;
            } else if (i <= 3) { // Assign VZ (2 employees)
                assignedType = vzType;
                standardHours = assignedType?.max_hours ?? 40;
            } else if (i <= 7) { // Assign GfB (4 employees)
                assignedType = gfbType;
                standardHours = assignedType?.max_hours ?? 12;
            } else { // Assign TZ (23 employees)
                assignedType = tzType;
                // Assign varying TZ hours for more realism
                standardHours = getRandomInt(assignedType?.min_hours ?? 15, assignedType?.max_hours ?? 25); 
            }
            calculatedTotalHours += standardHours;
            
            const firstName = getRandomElement(firstNames) || 'Demo';
            const lastName = getRandomElement(lastNames) || `User${empId}`;
            const group = assignedType?.id || 'TZ'; 
            let dbGroup = group.toUpperCase();
            if (!['TL', 'VZ', 'TZ', 'GFB'].includes(dbGroup)) {
                logger.warn(`Generated invalid group ID '${group}' -> '${dbGroup}' for employee ${empId}. Defaulting to 'TZ'.`);
                dbGroup = 'TZ';
            }

            // Determine if this employee should be a keyholder
            let isKeyholder = 0;
            if (remainingKeyholders > 0 && (dbGroup === 'TL' || Math.random() < (remainingKeyholders / (totalEmployees - i + 1)))) {
                isKeyholder = 1;
                remainingKeyholders--;
            }

            const isActive = 1;
            let email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${empId}@example.com`;
            while (usedEmails.has(email)) {
                email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${empId}_${getRandomInt(1,99)}@example.com`;
            }
            usedEmails.add(email);

            employeesToInsert.push([
                empId,
                firstName,
                lastName,
                dbGroup,
                standardHours,
                isKeyholder,
                isActive,
                email
            ]);
        }

        // Bulk insert employees
        db.transaction((emps) => {
            for (const emp of emps) employeeStmt.run(...emp);
            logger.info(`Inserted ${emps.length} demo employees. Calculated Total Contracted Hours: ${calculatedTotalHours.toFixed(2)}h (NOTE: 170h cap applies during schedule generation, not here)`);
        })(employeesToInsert);

        // Fetch newly inserted employees to get their DB IDs
        const generatedEmployees = await getAllEmployees({ status: 'active' }, db);
        if (generatedEmployees.length === 0) throw new Error("Failed to generate or fetch employees.");

        // 4. Generate Shift Templates
        logger.info("Generating demo shift templates...");
        const templateInsertSql = `INSERT INTO shift_templates (start_time, end_time, duration_hours, requires_break, shift_type, shift_type_id, active_days) VALUES (?, ?, ?, ?, ?, ?, ?);`;
        const templateStmt = db.prepare(templateInsertSql);

        // Generate active_days JSON dynamically based on settings
        const activeDaysJson = JSON.stringify(
            Array.from({ length: 7 }, (_, i) => i).reduce((acc, dayIndex) => {
                acc[dayIndex.toString()] = openDayIndices.includes(dayIndex);
                return acc;
            }, {} as { [key: string]: boolean })
        );
        logger.debug("Generated active_days JSON for templates:", activeDaysJson);

        const templatesToInsert: any[][] = [
             // Early Shift (Active based on settings)
             ['08:00', '16:30', 8.0, 1, 'EARLY', shiftTypes.find(st => st.id === 'early')?.id || 'early', activeDaysJson],
             // Mid Shift (Active based on settings)
             ['11:00', '19:30', 8.0, 1, 'MIDDLE', shiftTypes.find(st => st.id === 'middle')?.id || 'middle', activeDaysJson],
             // Late Shift (Active based on settings)
             ['13:30', '22:00', 8.0, 1, 'LATE', shiftTypes.find(st => st.id === 'late')?.id || 'late', activeDaysJson]
        ];
        // Bulk insert templates
        db.transaction((temps) => {
            for (const temp of temps) templateStmt.run(...temp);
            logger.info(`Inserted ${temps.length} demo shift templates.`);
        })(templatesToInsert);

        // 5. Generate Coverage
        logger.info("Generating demo coverage requirements...");
        const coverageInsertSql = `INSERT INTO coverage (day_index, start_time, end_time, min_employees, max_employees, requires_keyholder) VALUES (?, ?, ?, ?, ?, ?);`;
        const coverageStmt = db.prepare(coverageInsertSql);
        
        // Get store hours from settings
        const storeOpening = settings.store_opening || "09:00";
        const storeClosing = settings.store_closing || "20:00";
        
        const coveragesToInsert: any[][] = [];
        
        // Generate coverage blocks ONLY for open days
        openDayIndices.forEach(day => {
            // Morning block (store opening to mid-morning)
            coveragesToInsert.push([
                day,
                storeOpening,
                "12:00",
                day === 5 || day === 6 ? 3 : 2, // More staff on Saturday and Friday mornings
                day === 5 || day === 6 ? 4 : 3,
                1 // Requires keyholder for opening
            ]);
            
            // Mid-day block
            coveragesToInsert.push([
                day,
                "12:00",
                "16:00",
                day === 5 || day === 6 ? 3 : 2,
                day === 5 || day === 6 ? 4 : 3,
                0 // No keyholder required during mid-day
            ]);
            
            // Evening block (late afternoon to closing)
            coveragesToInsert.push([
                day,
                "16:00",
                storeClosing,
                day === 5 || day === 6 ? 2 : 1,
                day === 5 || day === 6 ? 3 : 2,
                1 // Requires keyholder for closing
            ]);
        });

        // Bulk insert coverage
        db.transaction((covers) => {
            for (const cover of covers) coverageStmt.run(...cover);
            logger.info(`Inserted ${covers.length} demo coverage blocks.`);
        })(coveragesToInsert);
         // TODO: Generate recurring_coverage examples?

        // 6. Generate Absences (using generated employees)
        logger.info("Generating demo absences...");
        const absenceInsertSql = `INSERT INTO absences (employee_id, absence_type_id, start_date, end_date, note) VALUES (?, ?, ?, ?, ?);`;
        const absenceStmt = db.prepare(absenceInsertSql);
        const today = new Date();
        const absencesToInsert: any[][] = [];

        generatedEmployees.forEach(emp => {
            if (Math.random() < 0.25) { // ~25% chance
                const randomAbsenceType = getRandomElement(absenceTypes);
                if (!randomAbsenceType) return;
                const startDateOffset = getRandomInt(5, 90);
                const absenceStartDate = addDays(today, startDateOffset);
                const duration = getRandomInt(1, randomAbsenceType.id === 'vacation' ? 10 : 5);
                const absenceEndDate = addDays(absenceStartDate, duration - 1);
                absencesToInsert.push([
                    emp.id,
                    randomAbsenceType.id,
                    format(absenceStartDate, 'yyyy-MM-dd'),
                    format(absenceEndDate, 'yyyy-MM-dd'),
                    `Demo Absence (${randomAbsenceType.name})`
                ]);
            }
        });
        db.transaction((absences) => {
            for (const absence of absences) absenceStmt.run(...absence);
            logger.info(`Inserted ${absences.length} demo absences.`);
        })(absencesToInsert);

        // 7. Generate Availabilities (using generated employees and refined logic)
        logger.info("Generating demo availabilities with refined logic...");
        const availabilityInsertSql = `INSERT INTO employee_availabilities (employee_id, day_of_week, hour, availability_type, is_recurring, is_available) VALUES (?, ?, ?, ?, ?, ?)`;
        const availabilityStmt = db.prepare(availabilityInsertSql);
        let availabilitiesToInsert: any[][] = [];

        // Get Availability Types from settings
        const availableType = availabilityTypes.find(t => t.id === 'AVAILABLE') || { id: 'AVAILABLE', name: 'Available' };
        const unavailableType = availabilityTypes.find(t => t.id === 'UNAVAILABLE') || { id: 'UNAVAILABLE', name: 'Unavailable' };
        const preferredType = availabilityTypes.find(t => t.id === 'PREFERRED') || { id: 'PREFERRED', name: 'Preferred' };
        const fixedType = availabilityTypes.find(t => t.id === 'FIXED') || { id: 'FIXED', name: 'Fixed' };

        // Convert store hours to numbers
        const [openingHour] = (settings.store_opening || "09:00").split(':').map(Number);
        const [closingHour] = (settings.store_closing || "20:00").split(':').map(Number);
        const storeHourCount = closingHour - openingHour;

        // Sort openDayIndices based on start_of_week for consistent distribution
        const startOfWeekSetting = settings.start_of_week ?? 1; // 0=Sun, 1=Mon
        const sortedOpenDayIndices = [...openDayIndices].sort((a, b) => {
             const displayA = startOfWeekSetting === 1 ? (a + 6) % 7 : a;
             const displayB = startOfWeekSetting === 1 ? (b + 6) % 7 : b;
             return displayA - displayB;
        });
        const numberOfOpenDays = sortedOpenDayIndices.length;

        generatedEmployees.forEach(emp => {
            let weeklyAvailableHoursGoal = 0;
            let availabilityStrategy = 'default'; // default, fixed, preference, random_blocks
            let dailyAvailabilityMap = new Map<number, { start: number, end: number, type: string }>();

            // Determine strategy and goal based on group and contracted hours
            if (emp.employee_group === 'VZ' || emp.employee_group === 'TL') {
                availabilityStrategy = 'fixed';
                weeklyAvailableHoursGoal = emp.contracted_hours;
            } else { // TZ or GFB
                availabilityStrategy = Math.random() < 0.3 ? 'preference' : 'random_blocks';
                // Aim for slightly more available hours than contracted for flexibility
                weeklyAvailableHoursGoal = Math.max(emp.contracted_hours * 1.25, emp.contracted_hours + 4);
                // Cap availability goal for GFB to avoid excessive availability
                if (emp.employee_group === 'GFB') {
                    weeklyAvailableHoursGoal = Math.min(weeklyAvailableHoursGoal, 20); 
                }
            }
            
            // Ensure goal doesn't exceed total possible open hours
            weeklyAvailableHoursGoal = Math.min(weeklyAvailableHoursGoal, storeHourCount * numberOfOpenDays);

            let hoursAssigned = 0;

            if (availabilityStrategy === 'fixed') {
                const hoursPerDay = Math.ceil(weeklyAvailableHoursGoal / Math.max(1, numberOfOpenDays));
                let daysAssigned = 0;
                for (const dayIndex of sortedOpenDayIndices) {
                    if (hoursAssigned >= weeklyAvailableHoursGoal) break;
                    
                    const dailyHoursToAssign = Math.min(hoursPerDay, storeHourCount, weeklyAvailableHoursGoal - hoursAssigned);
                    if (dailyHoursToAssign <= 0) continue;
                    
                    // Slightly randomize start time but keep it continuous
                    let startHour = openingHour + getRandomInt(0, Math.max(0, storeHourCount - dailyHoursToAssign));
                    let endHour = startHour + dailyHoursToAssign;

                    // Keyholder consideration (simple version: adjust start/end)
                    if (emp.is_keyholder) {
                        if (daysAssigned % 2 === 0) { // Simulate opening shifts
                            startHour = openingHour;
                            endHour = Math.min(startHour + dailyHoursToAssign, closingHour);
                        } else { // Simulate closing shifts
                            endHour = closingHour;
                            startHour = Math.max(openingHour, endHour - dailyHoursToAssign);
                        }
                    }
                    
                    dailyAvailabilityMap.set(dayIndex, { start: startHour, end: endHour, type: fixedType.id });
                    hoursAssigned += (endHour - startHour);
                    daysAssigned++;
                }
            } else if (availabilityStrategy === 'preference') {
                const preferredStart = Math.random() < 0.5 ? openingHour : Math.max(openingHour, closingHour - 5); // Morning or late afternoon preference
                const preferredEnd = preferredStart === openingHour ? Math.min(openingHour + 5, closingHour) : closingHour;
                let assignedOnPreferredDays = 0;

                // Try to assign hours on preferred days first
                const preferredDays = sortedOpenDayIndices.sort(() => 0.5 - Math.random()).slice(0, Math.ceil(numberOfOpenDays * 0.6)); // Prefer ~60% of days

                for (const dayIndex of preferredDays) {
                     if (hoursAssigned >= weeklyAvailableHoursGoal) break;
                     const start = preferredStart;
                     const end = preferredEnd;
                     const duration = end - start;
                     if (duration <= 0) continue;

                     dailyAvailabilityMap.set(dayIndex, { start, end, type: preferredType.id });
                     hoursAssigned += duration;
                     assignedOnPreferredDays++;
                }
                 // Assign remaining hours on other days if needed
                 for (const dayIndex of sortedOpenDayIndices) {
                     if (dailyAvailabilityMap.has(dayIndex) || hoursAssigned >= weeklyAvailableHoursGoal) continue;
                     const remainingHoursNeeded = weeklyAvailableHoursGoal - hoursAssigned;
                     const blockDuration = Math.min(getRandomInt(Math.min(4, remainingHoursNeeded), Math.min(8, storeHourCount, remainingHoursNeeded)), storeHourCount);
                     if (blockDuration <= 0) continue;
                     const startHour = openingHour + getRandomInt(0, Math.max(0, storeHourCount - blockDuration));
                     const endHour = startHour + blockDuration;
                     dailyAvailabilityMap.set(dayIndex, { start: startHour, end: endHour, type: availableType.id });
                     hoursAssigned += blockDuration;
                 }

            } else { // random_blocks strategy
                let daysAttempted = 0;
                while (hoursAssigned < weeklyAvailableHoursGoal && daysAttempted < numberOfOpenDays * 2) { // Add safety break
                    const dayIndex = getRandomElement(sortedOpenDayIndices) ?? sortedOpenDayIndices[0];
                    if (dailyAvailabilityMap.has(dayIndex)) {
                        daysAttempted++;
                        continue; // Don't overwrite existing block for simplicity
                    }
                    
                    const remainingHoursNeeded = weeklyAvailableHoursGoal - hoursAssigned;
                    const blockDuration = Math.min(getRandomInt(Math.min(3, remainingHoursNeeded), Math.min(6, storeHourCount, remainingHoursNeeded)), storeHourCount);
                    if (blockDuration <= 0) {
                        daysAttempted++;
                        continue;
                    }

                    const startHour = openingHour + getRandomInt(0, Math.max(0, storeHourCount - blockDuration));
                    const endHour = startHour + blockDuration;

                    dailyAvailabilityMap.set(dayIndex, { start: startHour, end: endHour, type: availableType.id });
                    hoursAssigned += blockDuration;
                    daysAttempted++;
                }
            }

            // Now, populate availabilitiesToInsert based on the dailyAvailabilityMap
            for (let day = 0; day < 7; day++) {
                if (!openDayIndices.includes(day)) continue; // Skip closed days

                const dailyBlock = dailyAvailabilityMap.get(day);
                for (let hour = openingHour; hour < closingHour; hour++) {
                    let isAvailable = 0;
                    let availabilityTypeName = unavailableType.id;

                    if (dailyBlock && hour >= dailyBlock.start && hour < dailyBlock.end) {
                        isAvailable = 1;
                        availabilityTypeName = dailyBlock.type;
                    } 
                    // All other hours on open days remain unavailable implicitly by not adding them as available
                    
                    availabilitiesToInsert.push([
                        emp.id,
                        day, // Use backend day index (0-6)
                        hour,
                        availabilityTypeName,
                        1, // is_recurring
                        isAvailable // is_available flag
                    ]);
                }
            }
        });

        // Pre-delete existing availabilities for affected employees *outside* the insert transaction
        const employeeIdsToDelete = [...new Set(availabilitiesToInsert.map(ins => ins[0]))];
        if (employeeIdsToDelete.length > 0) {
            const deleteSql = `DELETE FROM employee_availabilities WHERE employee_id IN (${employeeIdsToDelete.map(() => '?').join(',')})`;
            try {
                db.prepare(deleteSql).run(...employeeIdsToDelete);
                logger.info(`Pre-deleted old availabilities for ${employeeIdsToDelete.length} employees.`);
            } catch (delError) {
                logger.error("Error pre-deleting old availabilities:", delError);
                // Decide if this is critical - maybe the inserts will handle conflicts or it's acceptable to fail here?
                throw delError; // Re-throw to prevent potentially inconsistent state
            }
        }

        // Bulk insert availabilities within a transaction
        const insertTx = db.transaction((inserts: any[][]) => {
            // Delete old availabilities for these employees first to prevent duplicates/conflicts
            // const employeeIds = [...new Set(inserts.map(ins => ins[0]))];
            // if (employeeIds.length > 0) {
            //      const deleteSql = `DELETE FROM employee_availabilities WHERE employee_id IN (${employeeIds.map(() => '?').join(',')})`;
            //      try {
            //         db.prepare(deleteSql).run(...employeeIds);
            //         console.log(`Deleted old availabilities for ${employeeIds.length} employees.`);
            //      } catch (delError) {
            //         console.error("Error deleting old availabilities:", delError);
            //         throw delError; // Rethrow to abort transaction
            //      }
            // }
            
            // Insert new availabilities
            for (const availability of inserts) {
                try {
                    availabilityStmt.run(...availability);
                } catch (insertError) {
                    logger.error("Error inserting availability:", availability, insertError);
                    // Decide whether to throw and abort or just log and continue
                    // throw insertError; 
                }
            }
        });
        
        try {
            insertTx(availabilitiesToInsert);
            logger.info(`Inserted/Updated ${availabilitiesToInsert.length} availability records with refined logic.`);
        } catch (txError) {
             logger.error("Transaction failed during availability insertion:", txError);
             // Handle transaction failure if needed
             throw txError; // Rethrow if the entire process should fail
        }

        // 8. Generate Schedules (Placeholder/Skipped)
        logger.warn("Skipping demo schedule generation - requires complex algorithm implementation.");

        logger.info("Comprehensive demo data generation process finished.");

        return {
            message: "Comprehensive demo data generated successfully.",
            status: "COMPLETED",
        };

    } catch (error: any) {
        logger.error("Demo data generation failed:", error);
        // Consider adding more specific error handling or cleanup
        throw new Error(`Demo data generation failed: ${error.message}`);
    }
}

export async function generateDemoData(db: Database | null, settings: Settings) {
    if (!db) {
        db = getDb();
        if (!db) { 
            throw new Error('Database connection is required for generating demo data');
        }
    }
    
    // Wipe existing data
    const validTables = await getDatabaseTables(db);
    if (validTables.length > 0) {
        await wipeTablesService(validTables, db);
    }

    // ... rest of the function ...
} 