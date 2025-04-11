import { default as globalDb } from "../db";
import { Database } from "bun:sqlite";
import { randomUUID } from 'node:crypto';
import { format, addDays, eachDayOfInterval, getDay, parseISO } from 'date-fns';

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
export async function generateOptimizedDemoDataService(db: Database | null = globalDb): Promise<DemoDataResponse> {
    console.log("Initiating comprehensive demo data generation...");

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
        console.log(`Wiping tables: ${tablesToWipe.join(', ')}`);
        // Validate tables before wiping
        const validTables = await getDatabaseTables(db);
        const finalTablesToWipe = tablesToWipe.filter(t => validTables.includes(t));
        if (finalTablesToWipe.length > 0) {
            await wipeTablesService(finalTablesToWipe, db);
        } else {
            console.warn("No valid tables found to wipe.");
        }

        // 2. Fetch Settings (needed for types)
        console.log("Fetching settings...");
        const settings = await getSettings(db);
        const employeeTypes: EmployeeTypeDefinition[] = settings.employee_types || [];
        const shiftTypes: ShiftTypeDefinition[] = settings.shift_types || [];
        const absenceTypes: AbsenceTypeDefinition[] = settings.absence_types || [];
        const availabilityTypes: AvailabilityTypeDefinition[] = settings.availability_types || [];

        if (employeeTypes.length === 0) {
             console.warn("Employee types not defined in settings. Using placeholders.")
             // Add fallback types if needed, or throw error
        }
        if (shiftTypes.length === 0) console.warn("Shift types not defined in settings.");
        if (absenceTypes.length === 0) console.warn("Absence types not defined in settings.");
        if (availabilityTypes.length === 0) console.warn("Availability types not defined in settings.");

        // 3. Generate Employees (30 total, specific distribution, standard hours)
        console.log("Generating 30 demo employees with type distribution and standard hours...");
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
                console.warn(`Generated invalid group ID '${group}' -> '${dbGroup}' for employee ${empId}. Defaulting to 'TZ'.`);
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
            console.log(`Inserted ${emps.length} demo employees. Calculated Total Contracted Hours: ${calculatedTotalHours.toFixed(2)}h (NOTE: 170h cap applies during schedule generation, not here)`);
        })(employeesToInsert);

        // Fetch newly inserted employees to get their DB IDs
        const generatedEmployees = await getAllEmployees({ status: 'active' }, db);
        if (generatedEmployees.length === 0) throw new Error("Failed to generate or fetch employees.");

        // 4. Generate Shift Templates
        console.log("Generating demo shift templates...");
        const templateInsertSql = `INSERT INTO shift_templates (start_time, end_time, duration_hours, requires_break, shift_type, shift_type_id, active_days) VALUES (?, ?, ?, ?, ?, ?, ?);`;
        const templateStmt = db.prepare(templateInsertSql);
        const templatesToInsert: any[][] = [
             // Early Shift (Mon-Sat)
             ['08:00', '16:30', 8.0, 1, 'EARLY', shiftTypes.find(st => st.id === 'early')?.id || 'early', '{"0":true,"1":true,"2":true,"3":true,"4":true,"5":true,"6":false}'],
             // Mid Shift (Mon-Sat)
             ['11:00', '19:30', 8.0, 1, 'MIDDLE', shiftTypes.find(st => st.id === 'middle')?.id || 'middle', '{"0":true,"1":true,"2":true,"3":true,"4":true,"5":true,"6":false}'],
             // Late Shift (Mon-Sat)
             ['13:30', '22:00', 8.0, 1, 'LATE', shiftTypes.find(st => st.id === 'late')?.id || 'late', '{"0":true,"1":true,"2":true,"3":true,"4":true,"5":true,"6":false}']
        ];
        // Bulk insert templates
        db.transaction((temps) => {
            for (const temp of temps) templateStmt.run(...temp);
            console.log(`Inserted ${temps.length} demo shift templates.`);
        })(templatesToInsert);

        // 5. Generate Coverage
        console.log("Generating demo coverage requirements...");
        const coverageInsertSql = `INSERT INTO coverage (day_index, start_time, end_time, min_employees, max_employees, requires_keyholder) VALUES (?, ?, ?, ?, ?, ?);`;
        const coverageStmt = db.prepare(coverageInsertSql);
        
        // Get store hours from settings
        const storeOpening = settings.store_opening || "09:00";
        const storeClosing = settings.store_closing || "20:00";
        
        const coveragesToInsert: any[][] = [];
        
        // Generate coverage blocks for each day
        [0, 1, 2, 3, 4, 5, 6].forEach(day => {  // Added day 6 (Saturday)
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
            console.log(`Inserted ${covers.length} demo coverage blocks.`);
        })(coveragesToInsert);
         // TODO: Generate recurring_coverage examples?

        // 6. Generate Absences (using generated employees)
        console.log("Generating demo absences...");
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
            console.log(`Inserted ${absences.length} demo absences.`);
        })(absencesToInsert);

        // 7. Generate Availabilities (using generated employees)
        console.log("Generating demo availabilities...");
        const availabilityInsertSql = `INSERT INTO employee_availabilities (employee_id, day_of_week, hour, availability_type, is_recurring, is_available) VALUES (?, ?, ?, ?, ?, ?)`;
        const availabilityStmt = db.prepare(availabilityInsertSql);
        const availabilitiesToInsert: any[][] = [];
        
        const unavailableType = availabilityTypes.find(t => t.id === 'unavailable');
        const preferredType = availabilityTypes.find(t => t.id === 'preferred');
        const availableType = availabilityTypes.find(t => t.id === 'available');
        
        // Convert store hours to numbers for comparison
        const [openingHour] = storeOpening.split(':').map(Number);
        const [closingHour] = storeClosing.split(':').map(Number);

        generatedEmployees.forEach(emp => {
            // First, mark all store hours as available by default
            for (let day = 0; day < 7; day++) {
                for (let hour = openingHour; hour < closingHour; hour++) {
                    availabilitiesToInsert.push([
                        emp.id,
                        day,
                        hour,
                        availableType?.name || 'AVAILABLE',
                        1, // is_recurring
                        1  // is_available
                    ]);
                }
            }

            // Add some fixed unavailability (e.g., student has lectures)
            if (emp.employee_group === 'GFB' && Math.random() < 0.5 && unavailableType) {
                const unavailableDay = getRandomInt(0, 4); // Mon-Fri
                const startHour = getRandomInt(openingHour, closingHour - 2);
                const endHour = Math.min(startHour + getRandomInt(2, 4), closingHour);
                for (let hour = startHour; hour < endHour; hour++) {
                    // Remove any existing availability for this slot
                    const existingIndex = availabilitiesToInsert.findIndex(
                        a => a[0] === emp.id && a[1] === unavailableDay && a[2] === hour
                    );
                    if (existingIndex !== -1) {
                        availabilitiesToInsert.splice(existingIndex, 1);
                    }
                    // Add unavailable slot
                    availabilitiesToInsert.push([
                        emp.id,
                        unavailableDay,
                        hour,
                        unavailableType.name,
                        1, // is_recurring
                        0  // is_available
                    ]);
                }
            }

            // Add some preferred times (e.g., prefers mornings)
            if (Math.random() < 0.3 && preferredType) {
                const preferredDay = getRandomInt(0, 6);
                for (let hour = openingHour; hour < Math.min(openingHour + 4, closingHour); hour++) {
                    // Remove any existing availability for this slot
                    const existingIndex = availabilitiesToInsert.findIndex(
                        a => a[0] === emp.id && a[1] === preferredDay && a[2] === hour
                    );
                    if (existingIndex !== -1) {
                        availabilitiesToInsert.splice(existingIndex, 1);
                    }
                    // Add preferred slot
                    availabilitiesToInsert.push([
                        emp.id,
                        preferredDay,
                        hour,
                        preferredType.name,
                        1, // is_recurring
                        1  // is_available
                    ]);
                }
            }

            // Add some random unavailable slots
            for (let day = 0; day < 7; day++) {
                if (Math.random() < 0.1 && unavailableType) { // 10% chance per day
                    const randomHour = getRandomInt(openingHour, closingHour - 1);
                    // Remove any existing availability for this slot
                    const existingIndex = availabilitiesToInsert.findIndex(
                        a => a[0] === emp.id && a[1] === day && a[2] === randomHour
                    );
                    if (existingIndex !== -1) {
                        availabilitiesToInsert.splice(existingIndex, 1);
                    }
                    // Add unavailable slot
                    availabilitiesToInsert.push([
                        emp.id,
                        day,
                        randomHour,
                        unavailableType.name,
                        1, // is_recurring
                        0  // is_available
                    ]);
                }
            }
        });

        // Bulk insert availabilities
        db.transaction((availabilities) => {
            for (const availability of availabilities) availabilityStmt.run(...availability);
            console.log(`Inserted ${availabilities.length} demo availability overrides.`);
        })(availabilitiesToInsert);

        // 8. Generate Schedules (Placeholder/Skipped)
        console.warn("Skipping demo schedule generation - requires complex algorithm implementation.");

        console.log("Comprehensive demo data generation process finished.");

        return {
            message: "Comprehensive demo data generated successfully.",
            status: "COMPLETED",
        };

    } catch (error: any) {
        console.error("Demo data generation failed:", error);
        // Consider adding more specific error handling or cleanup
        throw new Error(`Demo data generation failed: ${error.message}`);
    }
}

export async function generateDemoData(db: Database | null, settings: Settings) {
    if (!db) {
        throw new Error('Database connection is required for generating demo data');
    }
    
    // Wipe existing data
    const validTables = await getDatabaseTables(db);
    if (validTables.length > 0) {
        await wipeTablesService(validTables, db);
    }

    // ... rest of the function ...
} 