import {
  Employee,
  Schedule,
  Absence,
  Settings,
  EmployeeAvailability,
  Coverage,
  RecurringCoverage,
  AvailabilityType,
  ShiftTypeSetting
} from '../types';
// Import date-fns functions
import { eachDayOfInterval, parseISO, format, isSameDay, isWithinInterval, startOfDay, getHours, parse as parseTime, isAfter, isBefore, isEqual } from 'date-fns';

// Defines the structure for specific day absences passed to the function.
// interface Absence { ... } // Definition is now imported from ../types

// Helper function to format date (assuming input is YYYY-MM-DD or similar)
// TODO: Replace with robust date handling if necessary (e.g., using date-fns)
// const formatDateKey = (date: string | Date): string => {
//   if (date instanceof Date) {
//     return date.toISOString().split('T')[0]; // Get YYYY-MM-DD
//   }
//   // Basic assumption: input string is already in a usable key format
//   // Add validation or specific formatting if needed
//   return date;
// };
// Using date-fns format instead
const DATE_KEY_FORMAT = 'yyyy-MM-dd';

// --- Updated GenerateScheduleParams ---
interface GenerateScheduleParams {
  employees: Employee[];
  absences: Absence[];
  availabilities: EmployeeAvailability[];
  coverages: Coverage[];
  recurringCoverages: RecurringCoverage[];
  settings: Settings;
  startDate: string; // Expecting 'YYYY-MM-DD'
  endDate: string; // Expecting 'YYYY-MM-DD'
}

// --- Define RequiredSlot Interface ---
interface RequiredSlot {
  date: Date;         // The specific date for this slot
  startTime: string;    // Start time HH:MM
  endTime: string;      // End time HH:MM
  type: AvailabilityType | 'COVERAGE'; // Priority: FIXED, PREFERRED, AVAILABLE (from employee) or general COVERAGE need
  requiredEmployees: number; // How many needed for this specific slot/time
  assignedEmployees: number; // How many have been assigned so far
  requiredGroupId?: string;  // Optional: Specific employee group needed (e.g., 'TL')
  requiresKeyholder?: boolean; // Optional: Does this slot need a keyholder?
  // Add other relevant details like original Coverage ID if needed for tracking
  sourceId?: number | string; // ID of the Coverage, RecurringCoverage, or EmployeeAvailability record that generated this slot
  fixedEmployeeId?: number; // Optional: Employee ID for FIXED slots
}
// --- End RequiredSlot Interface ---

// --- Helper Function: isEmployeeAbsent ---
/**
 * Checks if an employee is absent on a specific date based on absence ranges.
 */
const isEmployeeAbsent = (
  employeeId: number,
  checkDate: Date,
  absenceMap: Map<number, Absence[]>
): boolean => {
  const employeeAbsences = absenceMap.get(employeeId);
  if (!employeeAbsences) {
    return false; // No absences recorded for this employee
  }

  const checkDateStart = startOfDay(checkDate); // Normalize checkDate to start of day

  for (const absence of employeeAbsences) {
    try {
      const startDate = parseISO(absence.start_date);
      const endDate = parseISO(absence.end_date);

      // Ensure dates are valid before comparison
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.warn(`Invalid date format in absence record ID ${absence.id} for employee ${employeeId}`);
        continue; // Skip this invalid absence record
      }

      // Check if checkDate falls within the absence interval (inclusive)
      if (isWithinInterval(checkDateStart, { start: startOfDay(startDate), end: startOfDay(endDate) })) {
        return true; // Employee is absent on this date
      }
    } catch (error) {
        console.error(`Error parsing dates for absence ID ${absence.id}:`, error);
        continue; // Skip record if date parsing fails severely
    }
  }

  return false; // Employee is not absent on this date
};
// --- End Helper Function ---

// --- Helper Function: Check Employee Availability for Slot ---
/**
 * Checks if an employee is generally available during the hours of a required slot.
 * Considers the EmployeeAvailability data (FIXED, PREFERRED, AVAILABLE, UNAVAILABLE).
 * Note: Needs adjustment for JS vs Python day index if availabilityMap uses Python index.
 */
const isEmployeeAvailableForSlot = (
  employeeId: number,
  slot: RequiredSlot,
  availabilityMap: Map<number, Map<number, Map<number, EmployeeAvailability>>>
): boolean => {
  const jsDayOfWeek = slot.date.getDay(); // 0=Sun, 6=Sat
  const pythonDayOfWeek = (jsDayOfWeek === 0) ? 6 : jsDayOfWeek - 1; // Assuming map uses 0=Mon

  const employeeDayMap = availabilityMap.get(employeeId)?.get(pythonDayOfWeek);
  if (!employeeDayMap) {
    // If no specific availability is set for this day, assume AVAILABLE?
    // TODO: Clarify default availability - Assuming NOT available if no entry?
    // Let's assume unavailable if no specific entries for the day.
    return false;
  }

  const startHour = parseInt(slot.startTime.split(':')[0], 10);
  const endHour = parseInt(slot.endTime.split(':')[0], 10);
  const endMinute = parseInt(slot.endTime.split(':')[1], 10);

  // Check each hour within the slot's duration
  for (let hour = startHour; hour < endHour || (hour === endHour && endMinute > 0); hour++) {
    const currentHour = hour % 24; // Handle potential overnight wrap-around for checking
    const availabilityRecord = employeeDayMap.get(currentHour);

    if (!availabilityRecord) {
      // No specific record for this hour - Assume NOT available?
      // TODO: Confirm default availability assumption
      return false; // Needs specific availability entry for the hour
    }

    // Check the availability type
    if (availabilityRecord.availability_type === AvailabilityType.UNAVAILABLE) {
      return false; // Explicitly unavailable
    }

    // TODO: Consider recurring vs specific date availability record validity? Assuming map only contains relevant ones for now.

    // If we get here, the employee has *some* available status (AVAILABLE, FIXED, PREFFERED) for this hour.
    // We need them to be available for *all* hours of the slot.
  }

  // If the loop completes without returning false, the employee is available for all hours.
  return true;
};
// --- End Helper Function ---

// --- Helper Function: findCandidates (Updated) ---
/**
 * Finds potential candidates for a given slot, filtering by activity, absence, and availability.
 * TODO: Enhance with slot-specific criteria (skills, group, etc.).
 */
const findCandidates = (
  slot: RequiredSlot, // Changed from currentDate
  employeeMap: Map<number, Employee>,
  absenceMap: Map<number, Absence[]>,
  availabilityMap: Map<number, Map<number, Map<number, EmployeeAvailability>>>
): Employee[] => {
  const candidates: Employee[] = [];
  const currentDate = slot.date; // Get date from slot

  for (const employee of employeeMap.values()) {
    // 1. Check if employee is active
    if (!employee.is_active) {
      continue;
    }

    // 2. Check for absence on the current date
    if (isEmployeeAbsent(employee.id, currentDate, absenceMap)) {
      continue;
    }

    // 3. Check general availability for the slot's time range
    if (!isEmployeeAvailableForSlot(employee.id, slot, availabilityMap)) {
      continue;
    }

    // 4. Check slot-specific requirements (if any)
    // Example: Check if keyholder is required and employee is keyholder
    if (slot.requiresKeyholder && !employee.is_keyholder) {
        console.log(`      Employee ${employee.id} skipped: Slot requires keyholder.`);
        continue;
    }
    // Example: Check required group
    if (slot.requiredGroupId && employee.employee_group !== slot.requiredGroupId) {
        console.log(`      Employee ${employee.id} skipped: Slot requires group ${slot.requiredGroupId}, employee is ${employee.employee_group}.`);
        continue;
    }
    // TODO: Add skill checks etc. here if needed


    // If all checks pass, add as a potential candidate
    candidates.push(employee);
  }
  return candidates;
};
// --- End Helper Function ---

// --- Helper: Find Shift Template for a Given Hour ---
const findShiftTemplateForHour = (
  hour: number, // 0-23
  settings: Settings
): ShiftTypeSetting | null => {
  if (!settings.shift_types) {
    console.warn("Shift types not defined in settings.");
    return null;
  }

  for (const shiftType of settings.shift_types) {
    // Ensure hourConditions and times exist
    if (!shiftType.hourConditions?.startTime || !shiftType.hourConditions?.endTime) {
      continue;
    }

    try {
      // Create dummy date objects to parse HH:MM times for comparison
      const today = new Date(); // Use a consistent date for time parsing
      const startTimeStr = shiftType.hourConditions.startTime;
      const endTimeStr = shiftType.hourConditions.endTime;
      
      // Basic HH:MM validation
      if (!/^\d{2}:\d{2}$/.test(startTimeStr) || !/^\d{2}:\d{2}$/.test(endTimeStr)) {
          console.warn(`Invalid time format in shiftType ${shiftType.id}: ${startTimeStr}-${endTimeStr}`);
          continue;
      }

      const shiftStartHour = parseInt(startTimeStr.split(':')[0], 10);
      const shiftEndHour = parseInt(endTimeStr.split(':')[0], 10);
      const shiftEndMinute = parseInt(endTimeStr.split(':')[1], 10);

      // Simple check: does the target hour fall within the shift's hour range?
      // Handles overnight shifts implicitly if start > end (e.g., 22:00-06:00)
      let coversHour = false;
      if (shiftStartHour <= shiftEndHour) {
          // Normal day shift (e.g., 08:00 - 16:00)
          // Check if hour is within [start, end). End hour is exclusive unless minutes > 0.
          coversHour = hour >= shiftStartHour && (hour < shiftEndHour || (hour === shiftEndHour && shiftEndMinute > 0));
      } else {
          // Overnight shift (e.g., 22:00 - 06:00)
          // Check if hour is >= start OR < end
          coversHour = hour >= shiftStartHour || (hour < shiftEndHour || (hour === shiftEndHour && shiftEndMinute > 0));
      }

      if (coversHour) {
        return shiftType;
      }
    } catch (error) {
      console.error(`Error parsing time for shift type ${shiftType.id}:`, error);
    }
  }

  console.warn(`No shift template found covering hour ${hour}.`);
  return null;
};
// --- End Helper ---

// --- Helper: Check if a rule covers a specific hour ---
const doesRuleCoverHour = (
  hour: number, // 0-23
  rule: Coverage | RecurringCoverage
): boolean => {
  // Basic HH:MM validation
  if (!/^\d{2}:\d{2}$/.test(rule.start_time) || !/^\d{2}:\d{2}$/.test(rule.end_time)) {
    console.warn(`Invalid time format in coverage rule ID ${rule.id}: ${rule.start_time}-${rule.end_time}`);
    return false;
  }
  const ruleStartHour = parseInt(rule.start_time.split(':')[0], 10);
  const ruleEndHour = parseInt(rule.end_time.split(':')[0], 10);
  const ruleEndMinute = parseInt(rule.end_time.split(':')[1], 10);

  // Simple check: does the target hour fall within the rule's hour range?
  // Handles overnight shifts implicitly if start > end (e.g., 22:00-06:00)
  if (ruleStartHour <= ruleEndHour) {
    // Normal day shift
    return hour >= ruleStartHour && (hour < ruleEndHour || (hour === ruleEndHour && ruleEndMinute > 0));
  } else {
    // Overnight shift
    return hour >= ruleStartHour || (hour < ruleEndHour || (hour === ruleEndHour && ruleEndMinute > 0));
  }
};
// --- End Helper ---

// --- Helper: Parse HH:MM string to a Date object on a consistent day ---
const parseTimeString = (timeStr: string, baseDate: Date): Date => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const newDate = new Date(baseDate);
  newDate.setHours(hours, minutes, 0, 0);
  return newDate;
};
// --- End Helper ---

// --- Helper Function: determineRequiredSlots --- //
/**
 * Determines the required staffing slots for a given date.
 * Needs to interpret settings, coverages, recurring coverages, and employee FIXED/PREFFERED availability.
 * Should generate slots prioritizing FIXED, then PREFFERED, then general AVAILABLE/Coverage needs.
 */
const determineRequiredSlots = (
  currentDate: Date,
  settings: Settings,
  coverages: Coverage[],
  recurringCoverages: RecurringCoverage[],
  availabilityMap: Map<number, Map<number, Map<number, EmployeeAvailability>>>
): RequiredSlot[] => {
  let slots: RequiredSlot[] = [];
  const dateKey = format(currentDate, DATE_KEY_FORMAT);
  const dayOfWeek = currentDate.getDay(); // 0=Sun, 6=Sat
  const pythonDayOfWeek = (dayOfWeek === 0) ? 6 : dayOfWeek - 1; // Convert JS Sunday(0) to Python Monday(0), ..., JS Saturday(6) to Python Saturday(5)
  // Correction: Python is 0=Mon, 6=Sun. JS is 0=Sun, 6=Sat.
  // JS Sunday(0) -> Python Sunday(6)
  // JS Monday(1) -> Python Monday(0)
  // JS Tuesday(2) -> Python Tuesday(1)
  // JS Wednesday(3) -> Python Wednesday(2)
  // JS Thursday(4) -> Python Thursday(3)
  // JS Friday(5) -> Python Friday(4)
  // JS Saturday(6) -> Python Saturday(5)
  // Formula: (dayOfWeek + 6) % 7 seems wrong. Let's try direct mapping or simpler formula
  const pythonDayIndexString = String((dayOfWeek === 0) ? 6 : dayOfWeek - 1); // 0=Mon,..., 6=Sun as string key

  console.log(`Determining required slots for ${dateKey} (JS Day ${dayOfWeek}, Py Day String ${pythonDayIndexString})`);

  // --- Step 1: Check if store is open --- 
  let isStoreOpen = true;
  let openingTime = settings.store_opening || "00:00";
  let closingTime = settings.store_closing || "23:59";

  // Check special hours first (they override regular hours)
  const specialDayInfo = settings.special_hours?.[dateKey];
  if (specialDayInfo) {
    if (specialDayInfo.is_closed) {
      console.log(`  Store closed due to special hours on ${dateKey}.`);
      isStoreOpen = false;
    } else {
      // Store is open with special hours
      openingTime = specialDayInfo.opening;
      closingTime = specialDayInfo.closing;
      console.log(`  Store open with special hours on ${dateKey}: ${openingTime} - ${closingTime}`);
    }
  } else {
    // No special hours, check regular opening days
    const regularOpening = settings.opening_days?.[pythonDayIndexString];
    if (regularOpening === false) { // Explicitly check for false, as undefined means default open?
      console.log(`  Store closed based on regular opening_days for day ${pythonDayIndexString}.`);
      isStoreOpen = false;
    }
  }

  // If store is closed, return empty slots array
  if (!isStoreOpen) {
    return [];
  }
  // --- End Step 1 ---

  const fixedSlotsGenerated = new Set<string>();
  const fixedSlots: RequiredSlot[] = []; // Store FIXED slots separately first

  // --- Step 2: Generate slots based on Employee FIXED availability ---
  console.log("  Generating slots from FIXED availability...");
  for (const [employeeId, employeeDayMap] of availabilityMap.entries()) {
    const dayMap = employeeDayMap.get(pythonDayOfWeek);
    if (dayMap) {
      for (const [hour, availability] of dayMap.entries()) {
        if (availability.availability_type === AvailabilityType.FIXED) {
          // Find the shift template covering this hour
          const shiftTemplate = findShiftTemplateForHour(hour, settings);

          if (shiftTemplate?.id) {
            const slotKey = `${employeeId}-${shiftTemplate.id}`;

            // Check if a FIXED slot for this employee and this shift has already been created
            if (!fixedSlotsGenerated.has(slotKey)) {
              console.log(`    Found FIXED availability for Employee ${employeeId} at hour ${hour}, matches Shift ${shiftTemplate.id} (${shiftTemplate.name})`);

              // Create the RequiredSlot based on the shift template
              const fixedSlot: RequiredSlot = {
                date: currentDate,
                startTime: shiftTemplate.hourConditions!.startTime,
                endTime: shiftTemplate.hourConditions!.endTime,
                type: AvailabilityType.FIXED,
                requiredEmployees: 1,
                assignedEmployees: 0,
                sourceId: availability.id,
                fixedEmployeeId: employeeId
              };
              fixedSlots.push(fixedSlot);
              fixedSlotsGenerated.add(slotKey);
            }
          } else {
            console.warn(`    Found FIXED availability for Employee ${employeeId} at hour ${hour}, but no matching shift template found.`);
          }
        }
      }
    }
  }
  console.log(`  Generated ${fixedSlots.length} slots from FIXED availability.`);
  // --- End Step 2 ---

  // --- Step 4a: Gather applicable Coverage rules --- 
  console.log("  Gathering applicable coverage rules...");
  const applicableRules: (Coverage | RecurringCoverage)[] = [];

  // Check RecurringCoverage
  recurringCoverages.forEach(rc => {
    // Check if active
    if (!rc.is_active) return;

    // Check if today falls within the rule's date range (if specified)
    let dateInRange = true;
    if (rc.start_date) {
        try {
            const ruleStartDate = startOfDay(parseISO(rc.start_date));
            if (isBefore(startOfDay(currentDate), ruleStartDate)) dateInRange = false;
        } catch { dateInRange = false; console.warn(`Invalid start_date in RecurringCoverage ${rc.id}`); }
    }
    if (rc.end_date) {
        try {
            const ruleEndDate = startOfDay(parseISO(rc.end_date));
            if (isAfter(startOfDay(currentDate), ruleEndDate)) dateInRange = false;
        } catch { dateInRange = false; console.warn(`Invalid end_date in RecurringCoverage ${rc.id}`); }
    }
    if (!dateInRange) return;

    // Check if the rule applies to this day of the week
    // Assuming rc.days uses Python index (0=Mon, 6=Sun)
    if (!rc.days?.includes(pythonDayOfWeek)) return;

    // Rule is applicable
    applicableRules.push(rc);
  });

  // Check specific Coverages (apply to specific days of week, non-recurring)
  coverages.forEach(cov => {
    // Assuming cov.day_index uses Python index (0=Mon, 6=Sun)
    // Note: The TS type has day_index 0-6 (Sun-Sat). Need consistency!
    // Assuming input `coverages` uses 0=Mon like pythonDayOfWeek for now.
    if (cov.day_index === pythonDayOfWeek) {
      applicableRules.push(cov);
    }
  });
  console.log(`    Found ${applicableRules.length} potentially applicable coverage rules.`);
  // --- End Step 4a ---

  // --- Step 4b/4c/4d: Generate COVERAGE slots based on hourly requirements --- 
  console.log("  Generating COVERAGE slots based on hourly maximum requirements...");
  const hourlyRequirements: { hour: number; required: number }[] = [];
  const startHour = parseInt(openingTime.split(':')[0], 10);
  const endHour = parseInt(closingTime.split(':')[0], 10);
  const endMinute = parseInt(closingTime.split(':')[1], 10);

  // Determine requirement for each hour the store is open
  // Note: This simple hourly check might miss requirements spanning across hour boundaries precisely.
  for (let hour = startHour; hour < endHour || (hour === endHour && endMinute > 0); hour++) {
    let maxRequiredThisHour = 0;
    for (const rule of applicableRules) {
      if (doesRuleCoverHour(hour, rule)) {
        maxRequiredThisHour = Math.max(maxRequiredThisHour, rule.min_employees);
      }
    }
    if (maxRequiredThisHour > 0) {
      hourlyRequirements.push({ hour, required: maxRequiredThisHour });
    }
  }
  console.log(`    Hourly requirements determined:`, hourlyRequirements);

  // Consolidate consecutive hours with the same requirement into slots
  const coverageSlots: RequiredSlot[] = [];
  if (hourlyRequirements.length > 0) {
    let currentSlot: RequiredSlot | null = null;

    for (let i = 0; i < hourlyRequirements.length; i++) {
      const req = hourlyRequirements[i];

      if (!currentSlot) {
        // Start a new slot
        currentSlot = {
          date: currentDate,
          startTime: `${String(req.hour).padStart(2, '0')}:00`,
          endTime: `${String(req.hour + 1).padStart(2, '0')}:00`, // Initial end time
          type: 'COVERAGE',
          requiredEmployees: req.required,
          assignedEmployees: 0,
          sourceId: 'AggregatedCoverage' // Indicate it comes from general rules
        };
      } else if (
        req.hour === parseInt(currentSlot.endTime.split(':')[0], 10) && // Hour is consecutive
        req.required === currentSlot.requiredEmployees // Requirement level is the same
      ) {
        // Extend the current slot
        currentSlot.endTime = `${String(req.hour + 1).padStart(2, '0')}:00`;
      } else {
        // Requirement changed or hour is not consecutive, finalize previous slot
        coverageSlots.push(currentSlot);
        // Start a new slot
        currentSlot = {
          date: currentDate,
          startTime: `${String(req.hour).padStart(2, '0')}:00`,
          endTime: `${String(req.hour + 1).padStart(2, '0')}:00`,
          type: 'COVERAGE',
          requiredEmployees: req.required,
          assignedEmployees: 0,
          sourceId: 'AggregatedCoverage'
        };
      }
    }
    // Add the last slot if it exists
    if (currentSlot) {
      coverageSlots.push(currentSlot);
    }
  }
  console.log(`    Generated ${coverageSlots.length} consolidated COVERAGE slots.`);

  // --- Step 5: Merge/Consolidate Slots (FIXED vs COVERAGE) --- 
  console.log("  Merging FIXED slots into COVERAGE requirements...");
  const finalCoverageSlots: RequiredSlot[] = [];

  coverageSlots.forEach(covSlot => {
    let overlappingFixedSlots = 0;

    // Find FIXED slots that overlap with this COVERAGE slot
    const covStartTime = parseTimeString(covSlot.startTime, covSlot.date);
    const covEndTime = parseTimeString(covSlot.endTime, covSlot.date);

    fixedSlots.forEach(fixSlot => {
      const fixStartTime = parseTimeString(fixSlot.startTime, fixSlot.date);
      const fixEndTime = parseTimeString(fixSlot.endTime, fixSlot.date);
      const intervalsOverlap = isBefore(fixStartTime, covEndTime) && isBefore(covStartTime, fixEndTime);

      if (intervalsOverlap) {
        overlappingFixedSlots++;
      }
    });

    // ---- Added Warning Check ----
    if (overlappingFixedSlots > covSlot.requiredEmployees) {
      console.warn(
        `    Warning: ${overlappingFixedSlots} FIXED slots overlap with COVERAGE slot ` +
        `${covSlot.startTime}-${covSlot.endTime} which only requires ${covSlot.requiredEmployees}. ` +
        `Minimum coverage exceeded by fixed assignments.`
      );
      // Note: We still keep all FIXED slots. This check is just informational.
    }
    // ---- End Warning Check ----

    const remainingRequired = covSlot.requiredEmployees - overlappingFixedSlots;

    if (remainingRequired > 0) {
      covSlot.requiredEmployees = remainingRequired;
      finalCoverageSlots.push(covSlot);
      console.log(`    Adjusted COVERAGE slot ${covSlot.startTime}-${covSlot.endTime}, remaining required: ${remainingRequired}`);
    } else {
       console.log(`    COVERAGE slot ${covSlot.startTime}-${covSlot.endTime} fully covered by FIXED slots.`);
    }
  });
  // --- End Step 5 ---

  // Combine FIXED slots and adjusted COVERAGE slots
  slots = [...fixedSlots, ...finalCoverageSlots];
  console.log(`  Total slots after merge: ${slots.length}`);

  // --- Step 6: Sort slots by priority (FIXED > PREFERRED > COVERAGE) --- 
  // (Assuming PREFERRED might be added later)
  const typePriority = {
    [AvailabilityType.FIXED]: 1,
    [AvailabilityType.PREFERRED]: 2, // Placeholder for future
    'COVERAGE': 3,
    [AvailabilityType.AVAILABLE]: 4, // Lower priority if used
    [AvailabilityType.UNAVAILABLE]: 5 // Should not appear here
  };

  slots.sort((a, b) => {
    const priorityA = typePriority[a.type] || 99;
    const priorityB = typePriority[b.type] || 99;
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    // Optional: Secondary sort by start time if priorities are equal
    const startTimeA = parseTimeString(a.startTime, a.date).getTime();
    const startTimeB = parseTimeString(b.startTime, b.date).getTime();
    return startTimeA - startTimeB;
  });
  console.log(`  Slots sorted by priority.`);
  // --- End Step 6 ---

  // --- TODO: Implementation Steps --- 
  // 1. [DONE] Check if store is open
  // 2. [DONE] Generate slots based on Employee FIXED availability
  // 3. Generate slots based on Employee PREFERRED availability
  // 4. Generate general COVERAGE slots [DONE]
  //    a. [DONE] Gather applicable rules
  //    b. [DONE] Iterate through time intervals (hourly)
  //    c. [DONE] Determine max required employees for each interval
  //    d. [DONE] Create consolidated COVERAGE slots (basic consolidation)
  // 5. [DONE] Merge/Consolidate Slots (FIXED vs COVERAGE overlap)
  // 6. [DONE] Sort slots by priority

  return slots;
};
// --- End Helper Function ---

// --- Helper Function: selectBestCandidate --- // (Initial Implementation)
/**
 * Selects the best candidate for a given slot based on rules and constraints.
 * Initial version handles FIXED slots.
 * TODO: Implement logic for COVERAGE/PREFERRED slots (constraints, fairness, preferences).
 */
const selectBestCandidate = (
  candidates: Employee[],
  slot: RequiredSlot,
  generatedEntries: Schedule[], // For checking constraints (hours worked, rest time etc.)
  availabilityMap: Map<number, Map<number, Map<number, EmployeeAvailability>>>,
  settings: Settings
): Employee | null => {

  // --- Handle FIXED Slots --- 
  if (slot.type === AvailabilityType.FIXED) {
    if (slot.fixedEmployeeId === undefined) {
      console.error(`Slot ${slot.startTime}-${slot.endTime} on ${format(slot.date, DATE_KEY_FORMAT)} is FIXED but has no fixedEmployeeId!`);
      return null; // Cannot assign if we don't know who it's for
    }
    // Find the specific employee required by the FIXED slot
    const fixedCandidate = candidates.find(c => c.id === slot.fixedEmployeeId);
    if (fixedCandidate) {
      console.log(`    -> FIXED slot: Selecting designated employee ${fixedCandidate.id}`);
      // TODO: Add constraint checks even for FIXED employees? (e.g., max hours)
      // For now, assume the FIXED assignment is valid if the employee was found in candidates
      return fixedCandidate;
    } else {
      console.warn(
        `    -> FIXED slot requires employee ${slot.fixedEmployeeId}, but they are not in the valid candidates list ` +
        `(maybe absent, inactive, or unavailable?). Slot cannot be filled.`
      );
      return null; // The required employee is not available/suitable
    }
  }

  // --- Handle COVERAGE / PREFERRED Slots (Placeholder) --- 
  if (slot.type === 'COVERAGE' || slot.type === AvailabilityType.PREFERRED) {
    console.log(`    Selecting candidate for ${slot.type} slot...`);
    // TODO: Implement actual selection logic:
    // 1. Filter out candidates violating hard constraints (max hours, rest time)
    //    - Need to calculate hours worked so far from `generatedEntries`
    // 2. Score remaining candidates based on preferences (PREFFERED > AVAILABLE), fairness (hours vs contract), etc.
    // 3. Return the best-scoring candidate.

    // TEMP: Return the first candidate for now if any exist
    if (candidates.length > 0) {
      console.log(`      (TEMP) Selecting first candidate: ${candidates[0].id}`);
      return candidates[0];
    }
  }

  // Default: No suitable candidate found or slot type not handled
  return null;
};
// --- End Helper Function ---

export const generateSchedule = async ({
  employees,
  absences,
  availabilities,
  coverages,
  recurringCoverages,
  settings,
  startDate,
  endDate,
}: GenerateScheduleParams): Promise<Schedule[]> => {
  console.log('Starting schedule generation...');
  console.log('Employees:', employees.length);
  console.log('Absences:', absences.length);
  console.log('Availabilities:', availabilities.length);
  console.log('Coverages:', coverages.length);
  console.log('Recurring Coverages:', recurringCoverages.length);
  console.log('Settings:', settings ? 'Loaded' : 'Not Loaded');
  console.log('Start Date:', startDate);
  console.log('End Date:', endDate);

  const generatedEntries: Schedule[] = [];

  // TODO: Preprocessing data
  // - Create efficient data structures (Maps) for lookups
  //   - EmployeeMap: Map<string, Employee>
  //   - AbsenceMap: Map<string, Map<string, Absence>> (EmployeeID -> DateString -> Absence)
  //   - AvailabilityMap? SkillsMap? GroupMap?

  console.log('Preprocessing data...');

  // Employee Map (Key is number)
  const employeeMap: Map<number, Employee> = new Map();
  employees.forEach(emp => {
    employeeMap.set(emp.id, emp);
  });
  console.log('EmployeeMap created:', employeeMap.size, 'entries');

  // Absence Map (Key is Employee ID, Value is Array of Absence objects)
  const absenceMap: Map<number, Absence[]> = new Map();
  absences.forEach(abs => {
    if (abs.employee_id !== undefined && abs.start_date && abs.end_date) {
      if (!absenceMap.has(abs.employee_id)) {
        absenceMap.set(abs.employee_id, []);
      }
      absenceMap.get(abs.employee_id)!.push(abs); // Add the whole absence object
    } else {
      console.warn('Absence missing employee_id, start_date, or end_date:', abs);
    }
  });
  console.log('AbsenceMap created:', absenceMap.size, 'employees with absences');

  // Availability Map (EmployeeID -> DayOfWeek -> Hour -> AvailabilityRecord)
  // NOTE: Assumes input availability.day_of_week is 0=Monday, 6=Sunday (consistent with Python model)
  const availabilityMap: Map<number, Map<number, Map<number, EmployeeAvailability>>> = new Map();
  availabilities.forEach(avail => {
    if (
      avail.employee_id === undefined ||
      avail.day_of_week === undefined ||
      avail.hour === undefined
    ) {
      console.warn('Availability record missing employee_id, day_of_week, or hour:', avail);
      return; // Skip this record
    }

    // Get or create employee map
    if (!availabilityMap.has(avail.employee_id)) {
      availabilityMap.set(avail.employee_id, new Map());
    }
    const employeeDayMap = availabilityMap.get(avail.employee_id)!;

    // Get or create day map for the employee
    if (!employeeDayMap.has(avail.day_of_week)) {
      employeeDayMap.set(avail.day_of_week, new Map());
    }
    const dayHourMap = employeeDayMap.get(avail.day_of_week)!;

    // Set the availability for the specific hour
    // TODO: Consider how to handle conflicts if multiple records exist for the same hour (e.g., recurring vs specific date)
    dayHourMap.set(avail.hour, avail);
  });
  console.log('AvailabilityMap created:', availabilityMap.size, 'employees with availability data');

  // TODO: Preprocess Coverages/Settings into daily needs?
  console.log('Coverage/Settings preprocessing needed.');

  // --- End Preprocessing ---

  // TODO: Core Scheduling Algorithm
  // 1. Determine required staffing levels (min/max) for each day/shift based on
  //    recurringCoverages, oneOffCoverages, or fetched StoreConfiguration.
  // 2. Iterate through each day in the range [startDate, endDate].
  // 3. For each day, iterate through required shifts/coverage slots.
  // 4. Identify suitable candidates (use EmployeeMap, AbsenceMap, check availability,
  //    skills, group, contract hours, fairness, consecutive shifts etc.).
  // 5. Assign the best candidate and add to generatedEntries (as Schedule objects).

  console.log('Processing date range:', startDate, 'to', endDate);

  // --- Date Iteration using date-fns ---
  const start = parseISO(startDate); // Parse start date string
  const end = parseISO(endDate);     // Parse end date string

  // Validate dates
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    console.error('Invalid start or end date provided.');
    return []; // Or throw an error
  }

  const dateRange = eachDayOfInterval({ start, end });

  for (const currentDate of dateRange) {
    const dateKey = format(currentDate, DATE_KEY_FORMAT);
    console.log(`Processing date: ${dateKey}`);

    // Determine required coverage/shifts for currentDate using the new function
    const requiredSlots: RequiredSlot[] = determineRequiredSlots(
      currentDate,
      settings,
      coverages,
      recurringCoverages,
      availabilityMap
    );
    console.log(`  Found ${requiredSlots.length} required slots for ${dateKey}`);

    // Process slots (consider making a copy if modifying requiredEmployees directly)
    for (const slot of requiredSlots) {

      // Keep track of attempts to fill this slot
      let assignedCount = slot.assignedEmployees; 
      const maxNeeded = slot.requiredEmployees; 

      console.log(`  Processing slot: ${slot.startTime}-${slot.endTime} (Requires ${maxNeeded}, Type: ${slot.type})`);

      // Loop until the slot is filled or no more candidates can be found
      while (assignedCount < maxNeeded) {
        console.log(`    Attempting assignment ${assignedCount + 1} of ${maxNeeded}...`);

        // Find suitable candidates
        // TODO: Filter out candidates already assigned in overlapping slots on this day
        const candidates = findCandidates(slot, employeeMap, absenceMap, availabilityMap /*, alreadyAssignedIds? */);
        console.log(`      Found ${candidates.length} potential candidates.`);

        if (candidates.length === 0) {
            console.warn(`      No suitable candidates remaining for slot ${slot.startTime}-${slot.endTime}. Requirement may not be fully met.`);
            break; // Exit while loop for this slot
        }

        // --- Use selectBestCandidate --- 
        const assignedEmployee = selectBestCandidate(
          candidates,
          slot,
          generatedEntries,
          availabilityMap,
          settings
        );
        // --- End Use selectBestCandidate --- 

        if (assignedEmployee) {
           console.log(`      Assigning Employee ${assignedEmployee.id} to slot.`);
           // TODO: Add assignedEmployee to a temporary list for this slot/day to prevent double booking
           assignedCount++;
           slot.assignedEmployees = assignedCount;

           // TODO: Create Schedule object for the assignment
           // const scheduleEntry: Schedule = createScheduleEntry(assignedEmployee, slot);
           // generatedEntries.push(scheduleEntry);

           // TODO: Remove assignedEmployee from candidate pool for the *next iteration* of this slot 
           // (if maxNeeded > 1) or mark as assigned for the day for constraint checking.
        } else {
          console.warn(`      selectBestCandidate did not return an employee for slot ${slot.startTime}-${slot.endTime}. Stopping assignment attempts for this slot.`);
          break; // Exit while loop if selection fails
        }
      }
    }
  }
  // --- End Date Iteration ---

  console.log('Finished schedule generation.');
  return generatedEntries;
}; 