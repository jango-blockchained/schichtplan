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
export async function generateOptimizedDemoDataService(db: Database = globalDb): Promise<DemoDataResponse> {
    console.log("Initiating comprehensive demo data generation...");

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

        // 3. Generate Employees
        console.log("Generating demo employees...");
        const employeeInsertSql = `INSERT INTO employees (employee_id, first_name, last_name, employee_group, contracted_hours, is_keyholder, is_active, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
        const employeeStmt = db.prepare(employeeInsertSql);
        const employeesToInsert: any[][] = [];
        const firstNames = ["Alex", "Jamie", "Chris", "Max", "Lea", "Nico", "Sam", "Kim", "Ben", "Mia", "Jan", "Tina", "Leo", "Sara", "Tom"];
        const lastNames = ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann"];
        const usedEmails = new Set<string>();

        for (let i = 1; i <= 15; i++) {
            const firstName = getRandomElement(firstNames) || 'Demo';
            const lastName = getRandomElement(lastNames) || `User${i}`;
            const empId = String(i).padStart(3, '0');
            const groupType = getRandomElement(employeeTypes);
            const group = groupType?.id || 'VZ'; // Default to VZ if types missing
            const hours = groupType?.max_hours || 40;
            const isKeyholder = group === 'TL' || (group === 'VZ' && Math.random() < 0.3) ? 1 : 0; // TLs and ~30% VZ are keyholders
            const isActive = 1;
            let email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${empId}@example.com`;
            // Ensure unique email
            while (usedEmails.has(email)) {
                email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${empId}_${getRandomInt(1,99)}@example.com`;
            }
            usedEmails.add(email);

            employeesToInsert.push([
                empId,
                firstName,
                lastName,
                group,
                hours,
                isKeyholder,
                isActive,
                email
            ]);
        }
        // Bulk insert employees
        db.transaction((emps) => {
            for (const emp of emps) employeeStmt.run(...emp);
            console.log(`Inserted ${emps.length} demo employees.`);
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
        const coveragesToInsert: any[][] = [
            // Weekdays 09:00-18:00 (Need 2 people, 1 keyholder)
            ...[0, 1, 2, 3, 4].map(day => [day, '09:00', '18:00', 2, 3, 1]),
            // Weekdays 18:00-21:00 (Need 1 person)
             ...[0, 1, 2, 3, 4].map(day => [day, '18:00', '21:00', 1, 2, 0]),
             // Saturday 09:00-18:00 (Need 3 people, 1 keyholder)
             [5, '09:00', '18:00', 3, 4, 1],
              // Saturday 18:00-21:00 (Need 2 people)
              [5, '18:00', '21:00', 2, 3, 0],
        ];
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
        const availabilityInsertSql = `INSERT INTO employee_availabilities (employee_id, day_of_week, hour, availability_type, is_recurring) VALUES (?, ?, ?, ?, ?)`;
        const availabilityStmt = db.prepare(availabilityInsertSql);
        const availabilitiesToInsert: any[][] = [];
        const unavailableType = availabilityTypes.find(t => t.id === 'unavailable');
        const preferredType = availabilityTypes.find(t => t.id === 'preferred');

        generatedEmployees.forEach(emp => {
            // Add some fixed unavailability (e.g., student has lectures)
            if (emp.employee_group === 'GFB' && Math.random() < 0.5 && unavailableType) {
                const unavailableDay = getRandomInt(0, 4); // Mon-Fri
                const startHour = getRandomInt(8, 12);
                const endHour = startHour + getRandomInt(2, 4);
                for (let hour = startHour; hour < endHour; hour++) {
                    availabilitiesToInsert.push([emp.id, unavailableDay, hour, unavailableType.id, 1]);
                }
            }
            // Add some preferred times (e.g., prefers mornings)
            if (Math.random() < 0.3 && preferredType) {
                const preferredDay = getRandomInt(0, 6);
                for (let hour = 8; hour < 12; hour++) {
                     availabilitiesToInsert.push([emp.id, preferredDay, hour, preferredType.id, 1]);
                }
            }
            // Add some random hourly overrides
            for (let day = 0; day < 7; day++) { // DB: 0=Mon, 6=Sun
                for (let hour = 0; hour < 24; hour++) {
                    let typeIdToInsert: string | null = null;
                    const randomVal = Math.random();
                    if (randomVal < 0.05 && unavailableType) {
                         typeIdToInsert = unavailableType.id;
                    } else if (randomVal < 0.10 && preferredType) {
                         typeIdToInsert = preferredType.id;
                    }
                    if (typeIdToInsert && !availabilitiesToInsert.some(a => a[0] === emp.id && a[1] === day && a[2] === hour)) {
                         availabilitiesToInsert.push([emp.id, day, hour, typeIdToInsert, 1]);
                    }
                }
            }
        });
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

// TODO: Add function for the simple POST /demo-data/ endpoint if needed
// export async function generateSimpleDemoDataService(module: string, db: Database = globalDb) { ... }

// TODO: Add function for GET /demo-data/optimized/status/:taskId if implementing polling
// export async function getOptimizedDemoDataStatus(taskId: string, db: Database = globalDb) { ... }

// TODO: Add function for POST /demo-data/optimized/reset if needed
// export async function resetOptimizedDemoDataStatusService(db: Database = globalDb) { ... } 