// src/scheduler/assignment.ts
import { scheduleLogger } from "../logger"; // Import the specialized schedule logger

// --- Configuration Interface ---
export interface SchedulerConfiguration {
    minShiftMinutes: number;
    maxShiftMinutes: number;
    slotIntervalMinutes: number;
    maxConsecutiveDays: number;
    defaultMinRestPeriodMinutes: number;
    defaultMaxDailyMinutes: number;
    defaultAbsoluteMaxDailyMinutes: number;
    // --- Simplified Break Rule --- 
    breakThresholdMinutes?: number; // e.g., 360 (6 hours)
    breakDurationMinutes?: number;  // e.g., 30
    // --- Keyholder Config ---
    enforceKeyholderRule?: boolean; // Flag to enable/disable
    openingLeadTimeMinutes?: number; // e.g., 5
    closingLagTimeMinutes?: number;  // e.g., 15
}

// --- Default Configuration (Example) ---
const DEFAULT_SCHEDULER_CONFIG: SchedulerConfiguration = {
    minShiftMinutes: 120,        // 2 hours
    maxShiftMinutes: 600,        // 10 hours
    slotIntervalMinutes: 15,
    maxConsecutiveDays: 6,
    defaultMinRestPeriodMinutes: 11 * 60, // 11 hours
    defaultMaxDailyMinutes: 8 * 60,      // 8 hours
    defaultAbsoluteMaxDailyMinutes: 10 * 60, // 10 hours
    // Simplified break rule
    breakThresholdMinutes: 6 * 60, // 6 hours
    breakDurationMinutes: 30,      // 30 minutes
    // Add keyholder defaults
    enforceKeyholderRule: true,
    openingLeadTimeMinutes: 5,
    closingLagTimeMinutes: 15,
};

// --- Interfaces (assuming definitions from previous steps) ---

interface TimeRange {
  start: Date;
  end: Date;
}

// Define a simple preference structure
interface DayPreference {
    dayOfWeek: number; // 0 (Sun) to 6 (Sat)
    score: number;     // e.g., -1 (dislike), 0 (neutral), 1 (prefer)
}

// Represents a time range within a day (e.g., 08:00 - 12:00)
interface TimeOfDay {
    hours: number;   // 0-23
    minutes: number; // 0-59
}

interface TimeOfDayPreference {
    startTime: TimeOfDay; // Inclusive
    endTime: TimeOfDay;   // Exclusive
    score: number;       // e.g., -1, 0, 1
}

interface Employee {
  id: string;
  name: string;
  qualifications: string[];
  unavailability: TimeRange[];
  maxHoursPerWeek?: number;
  minRestMinutes?: number;
  maxConsecutiveDays?: number;
  // Add preferences field
  preferences?: {
      dayPreferences?: DayPreference[];
      // Add time preferences
      timePreferences?: TimeOfDayPreference[];
  };
  // Add flag if employee *can* be a keyholder
  isKeyholderQualified?: boolean;
}

interface RequiredSlot {
  id: string; // Unique ID, e.g., '2024-08-15T09:15:00'
  startTime: Date;
  endTime: Date;
  minEmployees: number;
  maxEmployees: number;
  // Potentially: requiredRole?: string;
}

type ExpandedCoverage = RequiredSlot[];

interface CandidateInfo {
  employeeId: string;
  // Add scoring/ranking info later if needed
}

type SlotCandidatesMap = Map<string, CandidateInfo[]>; // Map<RequiredSlot.id, CandidateInfo[]>

// Represents a contiguous block of work assigned to one employee
interface AssignedShift {
  id: string; // Unique shift ID (e.g., UUID)
  employeeId: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  // Simplified break duration field
  breakDurationMinutes?: number;
}

// Tracks the state of an employee's schedule as it's being built
interface EmployeeScheduleState {
  employeeId: string;
  assignedShifts: AssignedShift[];
  // --- Constraint Tracking ---
  totalMinutesScheduled: number;
  minutesScheduledByWeek: Map<number, number>; // Map<WeekOfYear, Minutes>
  minutesScheduledByDate: Map<string, number>; // Map<YYYY-MM-DD, Minutes>
  lastShiftEndTime: Date | null;
  // --- Consecutive Day Tracking ---
  consecutiveWorkDays: number;
  lastWorkDate: Date | null; // Store the actual Date object of the last day worked on
}
type EmployeeStates = Map<string, EmployeeScheduleState>; // Map<EmployeeId, State>

// Tracks coverage fulfillment for each 15-min slot
interface SlotCoverageState {
  requiredSlot: RequiredSlot; // Keep original requirement info
  assignedCount: number;
  assignedEmployeeIds: Set<string>; // Track who is assigned
}
type SlotCoverageStatusMap = Map<string, SlotCoverageState>; // Map<RequiredSlot.id, Status>

// The final output
interface ScheduleResult {
  assignments: AssignedShift[];
  unfilledSlots: RequiredSlot[]; // Slots where minEmployees wasn't met
  warnings: string[]; // Constraint violations or other issues found
}

// --- Helper Function (example) ---
function getWeekNumber(d: Date): number {
    // Simple week number calculation (adjust for specific locale/start day if needed)
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
    return weekNo;
}

function getDateString(d: Date): string {
    // Returns date in YYYY-MM-DD format (UTC to avoid timezone issues during key creation)
    return d.toISOString().split('T')[0];
}

// Helper to check if two dates are on consecutive calendar days (ignores time)
function areConsecutiveDays(date1: Date, date2: Date): boolean {
    const day1 = new Date(date1);
    day1.setUTCHours(0, 0, 0, 0);
    const day2 = new Date(date2);
    day2.setUTCHours(0, 0, 0, 0);

    const diffTime = Math.abs(day2.getTime() - day1.getTime());
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    return diffDays === 1;
}

// Updated helper to get preference score for a specific slot
function getPreferenceScoreForSlot(
    employee: Employee,
    slot: RequiredSlot
): number {
    if (!employee.preferences) {
        return 0; // Neutral if no preferences defined
    }

    let score = 0;
    const slotDay = slot.startTime.getUTCDay();
    const slotHour = slot.startTime.getUTCHours();
    const slotMinute = slot.startTime.getUTCMinutes();

    // Check Day Preferences
    if (employee.preferences.dayPreferences) {
        const dayPref = employee.preferences.dayPreferences.find(p => p.dayOfWeek === slotDay);
        if (dayPref) {
            score += dayPref.score;
        }
    }

    // Check Time Preferences
    if (employee.preferences.timePreferences) {
        // Represent slot start time as minutes from midnight for easy comparison
        const slotStartMinutesPastMidnight = slotHour * 60 + slotMinute;
        for (const timePref of employee.preferences.timePreferences) {
            const prefStartMinutesPastMidnight = timePref.startTime.hours * 60 + timePref.startTime.minutes;
            const prefEndMinutesPastMidnight = timePref.endTime.hours * 60 + timePref.endTime.minutes;

            // Handle time ranges that wrap around midnight (e.g., 22:00 - 06:00)
            if (prefStartMinutesPastMidnight > prefEndMinutesPastMidnight) {
                // Check if slot time is in the late part OR the early part
                if (slotStartMinutesPastMidnight >= prefStartMinutesPastMidnight || slotStartMinutesPastMidnight < prefEndMinutesPastMidnight) {
                    score += timePref.score;
                    break; // Found a matching preference range, stop checking time prefs
                }
            } else {
                // Normal time range (e.g., 08:00 - 17:00)
                if (slotStartMinutesPastMidnight >= prefStartMinutesPastMidnight && slotStartMinutesPastMidnight < prefEndMinutesPastMidnight) {
                    score += timePref.score;
                    break; // Found a matching preference range
                }
            }
        }
    }

    return score;
}

// --- Determine Potential Shift End Time (Uses Config) ---
function determinePotentialShiftEnd(
    startSlot: RequiredSlot,
    candidateId: string,
    employee: Employee,
    employeeState: EmployeeScheduleState,
    slotCoverageStatus: SlotCoverageStatusMap,
    slotCandidatesMap: SlotCandidatesMap,
    sortedSlots: RequiredSlot[],
    config: SchedulerConfiguration // Pass config
): Date | null {

    let potentialEndTime = new Date(startSlot.endTime);
    let currentDuration = config.slotIntervalMinutes; // Use config
    const startIndex = sortedSlots.findIndex(s => s.id === startSlot.id);

    if (startIndex === -1) return null;

    // Look ahead
    for (let i = startIndex + 1; i < sortedSlots.length; i++) {
        const nextSlot = sortedSlots[i];
        // Stop condition 1: Time gap
        if (nextSlot.startTime.getTime() !== potentialEndTime.getTime()) {
            break;
        }
        // Stop condition 2: Max shift duration (Use config)
        if (currentDuration >= config.maxShiftMinutes) {
            break;
        }
        // 3. Candidate is no longer eligible/available for the next slot
        const nextSlotCandidates = slotCandidatesMap.get(nextSlot.id) || [];
        if (!nextSlotCandidates.some(c => c.employeeId === candidateId)) {
             // Check if it's just unavailability or if min coverage is already met
             const nextSlotStatus = slotCoverageStatus.get(nextSlot.id);
             if (nextSlotStatus && nextSlotStatus.assignedCount >= nextSlot.minEmployees) {
                 // Coverage met by others, maybe we can still extend? (More complex logic)
                 // For now, let's stop if candidate isn't explicitly listed as available.
                 break;
             } else {
                 // Candidate unavailable, definitely stop.
                 break;
             }
        }
         // 4. Minimum coverage for the next slot is already met by *other* assigned employees
         //    (Allows extending into slots where coverage is met, up to maxEmployees, but prioritize needed slots)
         const nextSlotStatus = slotCoverageStatus.get(nextSlot.id);
         if (!nextSlotStatus) break; // Should not happen
         // Optional: More aggressive stop if min coverage met?
         // if (nextSlotStatus.assignedCount >= nextSlot.minEmployees && !nextSlotStatus.assignedEmployeeIds.has(candidateId)) {
         //    break;
         //}


        // If we can extend:
        potentialEndTime = new Date(nextSlot.endTime);
        currentDuration += config.slotIntervalMinutes; // Use config

        // TODO: Add basic constraint checks within the loop? (e.g., simple daily max)
        // This avoids proposing extremely long shifts that will fail validation later.
    }

    // Check if the determined shift meets the minimum duration requirement
    if (currentDuration < config.minShiftMinutes) {
         // Maybe allow shorter shifts if it's the only way to fill coverage? Configurable.
         scheduleLogger.debug(`Proposed shift for ${candidateId} starting at ${startSlot.startTime.toISOString()} is too short (${currentDuration} min vs min ${config.minShiftMinutes}). Not creating.`);
        return null;
    }

    // Return the calculated end time
    return potentialEndTime;
}

// --- Constraint Checking Functions (Use Config) ---

function checkOverlaps(proposedStartTime: Date, proposedEndTime: Date, existingShifts: AssignedShift[]): boolean {
    for (const existing of existingShifts) {
        // Check if proposed shift overlaps with an existing shift
        // Overlap occurs if: StartA < EndB AND StartB < EndA
        if (proposedStartTime < existing.endTime && existing.startTime < proposedEndTime) {
            scheduleLogger.warn(`Constraint Violation: Proposed shift (${proposedStartTime.toISOString()} - ${proposedEndTime.toISOString()}) overlaps with existing shift (${existing.startTime.toISOString()} - ${existing.endTime.toISOString()})`);
            return false; // Found overlap
        }
    }
    return true; // No overlaps
}

function checkRestPeriod(
    proposedStartTime: Date,
    lastShiftEndTime: Date | null,
    minRestMinutes: number // This already takes specific value, default is handled in checkAllConstraints
): boolean {
    if (lastShiftEndTime === null) {
        return true; // No previous shift, so rest period is met
    }
    const restMinutes = (proposedStartTime.getTime() - lastShiftEndTime.getTime()) / 60000;
    if (restMinutes < minRestMinutes) {
        scheduleLogger.warn(`Constraint Violation: Insufficient rest period. Needed: ${minRestMinutes} min, Actual: ${restMinutes.toFixed(0)} min`);
        return false;
    }
    return true;
}

function checkDailyLimits(
    proposedStartTime: Date,
    proposedEndTime: Date,
    proposedDuration: number,
    state: EmployeeScheduleState,
    maxDaily: number, // Pass specific limits
    absMaxDaily: number // Pass specific limits
): boolean {
    // Handles shifts crossing midnight
    // NOTE: This function has known limitations regarding Daylight Saving Time transitions.
    // Durations calculated across DST changes might be inaccurate using native Date objects.
    // Consider using a timezone-aware library (e.g., date-fns-tz, luxon) for full accuracy.
    const startDayStr = getDateString(proposedStartTime);
    const endDayStr = getDateString(proposedEndTime);

    let minutesOnStartDay = proposedDuration;
    let minutesOnEndDay = 0;

    // Check if the shift crosses midnight
    // Simple check: if end time is earlier than start time OR date strings differ
    if (proposedEndTime < proposedStartTime || startDayStr !== endDayStr) {
        // Calculate minutes for each day accurately
        const midnightAfterStart = new Date(proposedStartTime);
        midnightAfterStart.setUTCHours(24, 0, 0, 0); // Set to midnight UTC of the *next* day

        // Check if the shift actually crosses the UTC midnight boundary
        if (proposedEndTime > midnightAfterStart) {
            minutesOnStartDay = (midnightAfterStart.getTime() - proposedStartTime.getTime()) / 60000;
            minutesOnEndDay = (proposedEndTime.getTime() - midnightAfterStart.getTime()) / 60000;
            // Sanity check for durations around DST changes - might need refinement
            if(Math.abs(minutesOnStartDay + minutesOnEndDay - proposedDuration) > 1) { // Allow small floating point diffs
                 scheduleLogger.warn("Potential DST issue or calculation error in daily split", {start: proposedStartTime, end: proposedEndTime, dur: proposedDuration, d1: minutesOnStartDay, d2: minutesOnEndDay });
                 // Fallback to simpler check or handle more robustly if needed
                 minutesOnStartDay = proposedDuration; // Revert to simple check if split fails
                 minutesOnEndDay = 0;
            }
        } else {
            // Shift ends on the same day it starts, even if end time < start time (e.g. 23:00-00:00)
            // Or the end date string is different but it doesn't actually cross the NEXT midnight.
            // Let the initial calculation stand (all duration on start day)
        }
    }

    // Check limits for the start day
    const currentMinutesStartDay = state.minutesScheduledByDate.get(startDayStr) || 0;
    const totalMinutesStartDay = currentMinutesStartDay + minutesOnStartDay;
    if (totalMinutesStartDay > absMaxDaily) {
        scheduleLogger.warn(`Constraint Violation (Start Day): Exceeds absolute daily max (${absMaxDaily} min). Date: ${startDayStr}, Current: ${currentMinutesStartDay}, Adding: ${minutesOnStartDay.toFixed(0)}`);
        return false;
    }
    if (totalMinutesStartDay > maxDaily) {
        scheduleLogger.log(`Info (Start Day): Exceeds standard daily max (${maxDaily} min). Date: ${startDayStr}, New Total: ${totalMinutesStartDay.toFixed(0)}`);
    }

    // Check limits for the end day (if applicable)
    if (minutesOnEndDay > 0 && startDayStr !== endDayStr) {
        const currentMinutesEndDay = state.minutesScheduledByDate.get(endDayStr) || 0;
        const totalMinutesEndDay = currentMinutesEndDay + minutesOnEndDay;
        if (totalMinutesEndDay > absMaxDaily) {
            scheduleLogger.warn(`Constraint Violation (End Day): Exceeds absolute daily max (${absMaxDaily} min). Date: ${endDayStr}, Current: ${currentMinutesEndDay}, Adding: ${minutesOnEndDay.toFixed(0)}`);
            return false;
        }
        if (totalMinutesEndDay > maxDaily) {
            scheduleLogger.log(`Info (End Day): Exceeds standard daily max (${maxDaily} min). Date: ${endDayStr}, New Total: ${totalMinutesEndDay.toFixed(0)}`);
        }
    }

    return true;
}

function checkWeeklyLimits(
    proposedStartTime: Date,
    proposedDuration: number,
    state: EmployeeScheduleState,
    maxWeekly: number | undefined // Use employee specific value if available
): boolean {
    if (maxWeekly === undefined) {
        return true; // No weekly limit defined for employee
    }
    const weekNum = getWeekNumber(proposedStartTime);
    const currentWeeklyMinutes = state.minutesScheduledByWeek.get(weekNum) || 0;
    const newTotalWeeklyMinutes = currentWeeklyMinutes + proposedDuration;

    if (newTotalWeeklyMinutes > maxWeekly * 60) { // Assuming maxWeekly is in hours
        scheduleLogger.warn(`Constraint Violation: Proposed shift exceeds weekly max (${maxWeekly} hrs). Week: ${weekNum}, Current: ${(currentWeeklyMinutes/60).toFixed(1)} hrs, Proposed: ${(proposedDuration/60).toFixed(1)} hrs`);
        return false;
    }
    return true;
}

function checkConsecutiveDays(
    proposedStartTime: Date,
    proposedEndTime: Date,
    state: EmployeeScheduleState,
    maxConsecutive: number // Pass specific limit
): boolean {
    if (!state.lastWorkDate) {
        // No previous work day recorded, so this shift (max 2 days) is fine
        return true;
    }

    const proposedStartDay = new Date(proposedStartTime);
    proposedStartDay.setUTCHours(0, 0, 0, 0);

    // If the proposed shift starts on the *same day* as the last recorded work day, it doesn't increase consecutive count
    if (proposedStartDay.getTime() === state.lastWorkDate.getTime()) {
        return true;
    }

    // If the proposed shift starts on the day *after* the last work day
    if (areConsecutiveDays(state.lastWorkDate, proposedStartDay)) {
        if (state.consecutiveWorkDays >= maxConsecutive) {
            scheduleLogger.warn(`Constraint Violation: Exceeds max consecutive days (${maxConsecutive}). Last worked: ${getDateString(state.lastWorkDate)}, Proposing: ${getDateString(proposedStartTime)}`);
            return false;
        }
    } else {
        // There was a gap day, so consecutive count would reset (this shift is fine from this perspective)
    }

    // Consider if the shift crosses midnight and *ends* on a day that would violate the limit
    const proposedEndDay = new Date(proposedEndTime);
    proposedEndDay.setUTCHours(0,0,0,0);
    if (proposedEndDay.getTime() !== proposedStartDay.getTime() && areConsecutiveDays(state.lastWorkDate, proposedEndDay)) {
         if (state.consecutiveWorkDays >= maxConsecutive) {
             scheduleLogger.warn(`Constraint Violation: Shift ending day exceeds max consecutive days (${maxConsecutive}). Last worked: ${getDateString(state.lastWorkDate)}, Shift ends: ${getDateString(proposedEndTime)}`);
            return false;
         }
    }


    return true;
}

function checkMaxCoverage(
    proposedStartTime: Date,
    proposedEndTime: Date,
    candidateId: string,
    slotCoverageStatus: SlotCoverageStatusMap,
    slotLookupMap: Map<string, RequiredSlot>,
    config: SchedulerConfiguration // Pass config
): boolean {
    let checkTime = new Date(proposedStartTime);

    while (checkTime < proposedEndTime) {
        // Construct the expected ID format (or pass the full sortedSlots if ID generation isn't perfectly predictable)
        // Assuming ID format is predictable from time (e.g., ISO string slice)
        // If not predictable, we might need to iterate through the map keys/values which is less efficient
        // OR pass sortedSlots just for this function if lookup map key isn't reliable.
        // Let's assume for now ID IS predictable (e.g., ISO string for simplicity, adjust if needed)
        const slotId = checkTime.toISOString(); // Adjust if ID format is different!
        const slotInfo = slotLookupMap.get(slotId);
        // -------------------------

        if (slotInfo) {
            const status = slotCoverageStatus.get(slotInfo.id);
            if (status) {
                // Check if adding this candidate would exceed max employees for *this specific slot*
                // Only count if the candidate isn't already assigned here (relevant for shift extensions starting mid-covered block)
                const currentAssignees = status.assignedEmployeeIds;
                if (!currentAssignees.has(candidateId) && status.assignedCount >= slotInfo.maxEmployees) {
                    scheduleLogger.warn(`Constraint Violation (Max Coverage): Assigning ${candidateId} to shift would exceed maxEmployees (${slotInfo.maxEmployees}) for slot ${slotInfo.id} (${slotInfo.startTime.toISOString()}). Currently ${status.assignedCount} assigned.`);
                    return false;
                }
            } else {
                // This shouldn't happen if initialized correctly
                scheduleLogger.error(`Error: Could not find coverage status for slot ${slotInfo.id} during max coverage check.`);
                return false; // Fail safe
            }
        } else {
             scheduleLogger.error(`Error: Could not find slot definition for ID ${slotId} (Time: ${checkTime.toISOString()}) during max coverage check.`);
             return false; // Fail safe
        }

        checkTime = new Date(checkTime.getTime() + config.slotIntervalMinutes * 60000); // Use config
    }

    return true; // No max coverage violations found
}

function checkAllConstraints(
    employee: Employee,
    state: EmployeeScheduleState,
    proposedStartTime: Date,
    proposedEndTime: Date,
    proposedDuration: number,
    slotCoverageStatus: SlotCoverageStatusMap,
    slotLookupMap: Map<string, RequiredSlot>,
    config: SchedulerConfiguration // Pass config
): boolean {

    // 1. Check Overlaps
    if (!checkOverlaps(proposedStartTime, proposedEndTime, state.assignedShifts)) {
        return false;
    }

    // 2. Check Rest Period
    const minRest = employee.minRestMinutes ?? config.defaultMinRestPeriodMinutes;
    if (!checkRestPeriod(proposedStartTime, state.lastShiftEndTime, minRest)) {
        return false;
    }

    // 3. Check Daily Limits
    if (!checkDailyLimits(proposedStartTime, proposedEndTime, proposedDuration, state, config.defaultMaxDailyMinutes, config.defaultAbsoluteMaxDailyMinutes)) {
        return false;
    }

    // 4. Check Weekly Limits
    if (!checkWeeklyLimits(proposedStartTime, proposedDuration, state, employee.maxHoursPerWeek)) {
        return false;
    }

    // 5. Check Consecutive Days
    const maxConsec = employee.maxConsecutiveDays ?? config.maxConsecutiveDays;
    if (!checkConsecutiveDays(proposedStartTime, proposedEndTime, state, maxConsec)) {
        return false;
    }

    // 6. Check Max Coverage Constraint
    if (!checkMaxCoverage(proposedStartTime, proposedEndTime, employee.id, slotCoverageStatus, slotLookupMap, config)) {
        return false;
    }

    // 7. Check Employee Specific Unavailability
    for (const unavailable of employee.unavailability) {
        if (proposedStartTime < unavailable.end && unavailable.start < proposedEndTime) {
            scheduleLogger.warn(`Constraint Violation: Proposed shift overlaps with employee unavailability (${unavailable.start.toISOString()} - ${unavailable.end.toISOString()})`);
            return false;
        }
    }

    return true; // All checks passed
}

// --- Helper Functions for State Updates ---

/**
 * Creates a new Date object set to the specified time on the same UTC day as the baseDate.
 */
function getDateForTimeOfDayUTC(baseDate: Date, timeOfDay: TimeOfDay): Date {
    const newDate = new Date(baseDate);
    newDate.setUTCHours(timeOfDay.hours, timeOfDay.minutes, 0, 0);
    return newDate;
}

/**
 * Updates the daily minutes count in the employee state, handling shifts crossing midnight.
 * durationChange can be positive (adding shift) or negative (removing part of extended shift).
 */
function updateDailyState(state: EmployeeScheduleState, startTime: Date, endTime: Date, durationChange: number): void {
    const startDayStr = getDateString(startTime);
    const endDayStr = getDateString(endTime);

    if (startDayStr === endDayStr) {
        // Shift does not cross midnight
        const currentMinutes = state.minutesScheduledByDate.get(startDayStr) || 0;
        state.minutesScheduledByDate.set(startDayStr, Math.max(0, currentMinutes + durationChange));
    } else {
        // Shift crosses midnight
        const midnightAfterStart = new Date(startTime);
        midnightAfterStart.setUTCHours(24, 0, 0, 0);

        // Ensure end time is actually after the next midnight boundary
        if (endTime > midnightAfterStart) {
            let minutesOnStartDayChange = (midnightAfterStart.getTime() - startTime.getTime()) / 60000;
            let minutesOnEndDayChange = (endTime.getTime() - midnightAfterStart.getTime()) / 60000;

            // Apply durationChange proportionally if it's not the full duration (e.g., for removals)
            const originalDuration = minutesOnStartDayChange + minutesOnEndDayChange;
            if (Math.abs(durationChange) < originalDuration) {
                const proportion = durationChange / originalDuration;
                minutesOnStartDayChange *= proportion;
                minutesOnEndDayChange *= proportion;
            }

            // Update start day
            const currentMinutesStart = state.minutesScheduledByDate.get(startDayStr) || 0;
            state.minutesScheduledByDate.set(startDayStr, Math.max(0, currentMinutesStart + minutesOnStartDayChange));

            // Update end day
            const currentMinutesEnd = state.minutesScheduledByDate.get(endDayStr) || 0;
            state.minutesScheduledByDate.set(endDayStr, Math.max(0, currentMinutesEnd + minutesOnEndDayChange));

        } else {
             // Shift ends on the same day it starts, even if date strings differ (e.g. 23:00-00:00)
             // Treat as non-crossing for daily state update.
            const currentMinutes = state.minutesScheduledByDate.get(startDayStr) || 0;
            state.minutesScheduledByDate.set(startDayStr, Math.max(0, currentMinutes + durationChange));
        }
    }
}

/**
 * Updates the consecutive work days count and last work date in the employee state.
 */
function updateConsecutiveDaysState(state: EmployeeScheduleState, shiftStartTime: Date, shiftEndTime: Date): void {
    const shiftStartDay = new Date(shiftStartTime);
    shiftStartDay.setUTCHours(0, 0, 0, 0);

    const shiftEndDay = new Date(shiftEndTime);
    shiftEndDay.setUTCHours(0, 0, 0, 0);

    // Determine the latest day the employee worked based on this shift
    const currentLastWorkDay = shiftEndDay > shiftStartDay ? shiftEndDay : shiftStartDay;

    if (state.lastWorkDate) {
        if (areConsecutiveDays(state.lastWorkDate, shiftStartDay)) {
            // Started on the day after the previous last work day
            state.consecutiveWorkDays++;
        } else if (shiftStartDay.getTime() > state.lastWorkDate.getTime()) {
             // Started after a gap day(s)
             state.consecutiveWorkDays = 1;
        } // Else: Started on the same day as lastWorkDate - no change in consecutive days

    } else {
        // First shift assigned
        state.consecutiveWorkDays = 1;
    }

    // Update the last work date to the latest day this shift touched
    state.lastWorkDate = currentLastWorkDay;
}

// --- Main Assignment Function (Accepts Config and Operating Hours) ---

export async function generateScheduleAssignments(
  expandedCoverage: ExpandedCoverage,
  slotCandidatesMap: SlotCandidatesMap,
  employees: Employee[],
  // Add daily operating hours
  dailyOperatingHours: Map<string, { open: TimeOfDay; close: TimeOfDay }>,
  config: SchedulerConfiguration = DEFAULT_SCHEDULER_CONFIG
): Promise<ScheduleResult> {

  scheduleLogger.debug(`Starting assignment with config:`, config);
  if (config.enforceKeyholderRule) {
      scheduleLogger.debug(`Keyholder Rule Enabled.`);
  }

  // 1. Initialization
  const assignments: AssignedShift[] = [];
  const warnings: string[] = [];
  const employeeMap = new Map(employees.map(e => [e.id, e]));

  // Initialize employee states
  const employeeStates: EmployeeStates = new Map();
  for (const employee of employees) {
    employeeStates.set(employee.id, {
      employeeId: employee.id,
      assignedShifts: [],
      totalMinutesScheduled: 0,
      minutesScheduledByWeek: new Map(),
      minutesScheduledByDate: new Map(),
      lastShiftEndTime: null,
      consecutiveWorkDays: 0,
      lastWorkDate: null,
    });
  }

  // Initialize slot coverage status
  const slotCoverageStatus: SlotCoverageStatusMap = new Map();
  for (const slot of expandedCoverage) {
    slotCoverageStatus.set(slot.id, {
      requiredSlot: slot,
      assignedCount: 0,
      assignedEmployeeIds: new Set(),
    });
  }

  // Sort slots chronologically
  const sortedSlots = [...expandedCoverage].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  // Create a quick lookup map for slots by ID
  const slotLookupMap = new Map(sortedSlots.map(s => [s.id, s]));

  // --- Keyholder State ---
  let previousDayKeyholderId: string | null = null;
  let previousDayString: string | null = null; // Track the date string of the last closer processed
  // TODO: Need initial keyholder for Day 1? Assume null for now. Or pass as parameter?
  // ---------------------

  // 2. Iteration through sorted 15-min slots
  for (const slot of sortedSlots) {
    const currentSlotStatus = slotCoverageStatus.get(slot.id);
    if (!currentSlotStatus) {
        warnings.push(`Error: Status not found for slot ${slot.id}`);
        continue;
    }

    let needed = slot.minEmployees - currentSlotStatus.assignedCount;

    // --- Determine current day's key times ---
    const currentDayString = getDateString(slot.startTime);
    const operatingHours = dailyOperatingHours.get(currentDayString);
    let requiredOpeningStartTime: Date | null = null;
    let requiredClosingEndTime: Date | null = null;
    let isOpeningSlot = false;
    // Ensure operating hours exist for the day
    if (operatingHours && config.enforceKeyholderRule && config.openingLeadTimeMinutes !== undefined && config.closingLagTimeMinutes !== undefined) {
         const officialOpenTime = getDateForTimeOfDayUTC(slot.startTime, operatingHours.open);
         const officialCloseTime = getDateForTimeOfDayUTC(slot.startTime, operatingHours.close); // Base on slot day

         requiredOpeningStartTime = new Date(officialOpenTime.getTime() - config.openingLeadTimeMinutes * 60000);
         requiredClosingEndTime = new Date(officialCloseTime.getTime() + config.closingLagTimeMinutes * 60000);

         // Check if the *current slot* is the one where the designated opening shift should START
         isOpeningSlot = slot.startTime.getTime() === requiredOpeningStartTime.getTime();
    }
     // Detect day change for keyholder reset (based on when closing shift was assigned)
     if (previousDayString !== null && currentDayString !== previousDayString) {
         // Moved to a new day *after* the closer for the previous day was processed.
         // previousDayKeyholderId should now hold the correct ID for today's opening.
         scheduleLogger.debug(`New Day ${currentDayString}. Previous keyholder: ${previousDayKeyholderId || 'None'}`);
     }
    // -----------------------------------------


    // While minimum coverage for this slot is not met
    while (needed > 0) {
      scheduleLogger.debug(`Slot ${slot.id} (${slot.startTime.toISOString()}) needs ${needed} more employee(s).`);

      let assignedThisIteration = false;

      // --- Candidate Prioritization & Selection ---

      // 3a. Filter initial candidates based on immediate availability/eligibility for THIS slot
      let originalEligibleCandidates = (slotCandidatesMap.get(slot.id) || [])
          .filter(candidate => {
              if (currentSlotStatus.assignedEmployeeIds.has(candidate.employeeId)) return false;
              const state = employeeStates.get(candidate.employeeId);
              if (!state) return false;
              // Basic rest check for starting a *new* shift
              const employee = employeeMap.get(candidate.employeeId);
              const minRest = employee?.minRestMinutes ?? config.defaultMinRestPeriodMinutes;
              if (state.lastShiftEndTime && (slot.startTime.getTime() - state.lastShiftEndTime.getTime()) < minRest * 60000) {
                   // console.log(`Skipping ${candidate.employeeId} for slot ${slot.id} due to rest period.`);
                  return false;
              }
              // --- Add Max Employee Check for *starting* slot --- 
              if (currentSlotStatus.assignedCount >= currentSlotStatus.requiredSlot.maxEmployees) {
                   // Don't even consider if the starting slot is already full or overfilled
                   // unless this candidate is *already* assigned (relevant for extensions? No, filtered earlier)
                   if (!currentSlotStatus.assignedEmployeeIds.has(candidate.employeeId)) {
                        // console.log(`Skipping ${candidate.employeeId} for slot ${slot.id}: Starting slot max coverage (${currentSlotStatus.requiredSlot.maxEmployees}) reached.`);
                       return false;
                   }
              }
              // -----------------------------------------------------

              return true;
          });
          
      let eligibleCandidates = [...originalEligibleCandidates]; // Clone for potential filtering

      let isOpeningSlotAttempt = isOpeningSlot; // Track if this iteration is for the designated opener

      // --- Keyholder Opening Constraint Filter ---
      if (isOpeningSlotAttempt && previousDayKeyholderId !== null) {
          const keyholderAvailable = eligibleCandidates.some(c => c.employeeId === previousDayKeyholderId);
          if (keyholderAvailable) {
              scheduleLogger.debug(`Filtering for required keyholder ${previousDayKeyholderId} for opening slot ${slot.id}.`);
              eligibleCandidates = eligibleCandidates.filter(c => c.employeeId === previousDayKeyholderId);
          } else {
              warnings.push(`Critical: Previous keyholder ${previousDayKeyholderId} is unavailable or fails constraints for opening slot ${slot.id} on ${currentDayString}. Attempting fallback.`);
              // Filter for qualified candidates only if keyholder fails
              const qualifiedFallbackCandidates = eligibleCandidates.filter(c => employeeMap.get(c.employeeId)?.isKeyholderQualified ?? false);
              if (qualifiedFallbackCandidates.length > 0) {
                  eligibleCandidates = qualifiedFallbackCandidates;
                  warnings.push(`Info: Assigning qualified fallback keyholder for opening slot ${slot.id} as previous closer ${previousDayKeyholderId} was unavailable.`);
              } else {
                  warnings.push(`Critical: No qualified fallback keyholder found for opening slot ${slot.id} on ${currentDayString}. Keyholder rule violated.`);
                  // Depending on strictness, could break here or let it fail naturally
                  eligibleCandidates = []; // Ensure no one is assigned if no qualified fallback exists
              }
              isOpeningSlotAttempt = false; // Mark that we are no longer strictly assigning the designated opener
          }
      } else if (isOpeningSlotAttempt && previousDayKeyholderId === null) {
          warnings.push(`Info: First day (${currentDayString}) or no previous closer recorded. Assigning first available qualified keyholder for opening slot ${slot.id}.`);
          // Filter to ensure only keyholder *qualified* people can open on Day 1
           const qualifiedFirstDayCandidates = eligibleCandidates.filter(c => employeeMap.get(c.employeeId)?.isKeyholderQualified ?? false);
           if (qualifiedFirstDayCandidates.length > 0) {
                eligibleCandidates = qualifiedFirstDayCandidates;
           } else {
               warnings.push(`Critical: No qualified keyholder found for opening slot ${slot.id} on the first day (${currentDayString}).`);
               // Depending on strictness, could break here or let it fail naturally
               eligibleCandidates = []; // Ensure no one is assigned if no qualified opener exists
           }
      }
      // --------------------------------------------

      // 3b. Prioritize (Extendable, Fairness, Preference)
      const extendableCandidates = eligibleCandidates.filter(candidate => {
          const state = employeeStates.get(candidate.employeeId);
          return state?.lastShiftEndTime?.getTime() === slot.startTime.getTime();
      });
      const otherEligibleCandidates = eligibleCandidates.filter(candidate => {
          const state = employeeStates.get(candidate.employeeId);
          return state?.lastShiftEndTime?.getTime() !== slot.startTime.getTime();
      });
      // --- Update Sorting Logic (Fairness + Preference) --- 
      const sortByPriority = (a: CandidateInfo, b: CandidateInfo) => {
          const stateA = employeeStates.get(a.employeeId)!; // Assume state exists from filter
          const stateB = employeeStates.get(b.employeeId)!;
          const empA = employeeMap.get(a.employeeId)!;
          const empB = employeeMap.get(b.employeeId)!;

          // Primary sort: Fewer total minutes scheduled is better (ascending)
          const minutesDiff = stateA.totalMinutesScheduled - stateB.totalMinutesScheduled;
          if (minutesDiff !== 0) {
              return minutesDiff;
          }

          // Secondary sort: Higher preference score (day + time) is better (descending)
          const prefScoreA = getPreferenceScoreForSlot(empA, slot);
          const prefScoreB = getPreferenceScoreForSlot(empB, slot);
          return prefScoreB - prefScoreA; // Descending order for score
      };

      extendableCandidates.sort(sortByPriority);
      otherEligibleCandidates.sort(sortByPriority);
      // --- End Sorting Logic Update ---

      // Combine prioritized list: sorted extendable first, then sorted others
      const prioritizedCandidates = [...extendableCandidates, ...otherEligibleCandidates];
       // Check if any candidates remain after filtering
       if (prioritizedCandidates.length === 0) {
           scheduleLogger.debug(`No eligible candidates found for slot ${slot.id} after filtering (including keyholder).`);
           break; // Break the inner while loop, cannot fill this need
       }
      // 3c. Attempt assignment using the prioritized list
      for (const candidateInfo of prioritizedCandidates) {
          const candidateId = candidateInfo.employeeId;
          const employee = employeeMap.get(candidateId);
          const empState = employeeStates.get(candidateId);
          if (!employee || !empState) continue;

          // --- Determine Potential Shift --- 
          let potentialEndTime = determinePotentialShiftEnd(
              slot, candidateId, employee, empState, slotCoverageStatus, slotCandidatesMap, sortedSlots, config
          );
          let potentialStartTime = slot.startTime; // Usually the slot start

          // Keyholder Shift Timing Adjustments
          let isDesignatedClosingShift = false;
          let isDesignatedOpeningShift = isOpeningSlotAttempt;


          if (config.enforceKeyholderRule && requiredOpeningStartTime && requiredClosingEndTime) {
               if (isDesignatedOpeningShift && potentialStartTime.getTime() !== requiredOpeningStartTime.getTime()) {
                   // This should ideally not happen if isOpeningSlot was check correctly, but as a safeguard:
                   scheduleLogger.warn(`Opening shift candidate ${candidateId} slot time ${potentialStartTime.toISOString()} doesn't match required opening start ${requiredOpeningStartTime.toISOString()}. Skipping keyholder logic.`);
                   isDesignatedOpeningShift = false;
               } else if (isDesignatedOpeningShift && !(employee.isKeyholderQualified ?? false)) {
                   // If fallback occurred and selected candidate isn't qualified, don't treat as designated opener
                    scheduleLogger.warn(`Opening shift fallback candidate ${candidateId} not keyholder qualified.`);
                   isDesignatedOpeningShift = false; 
               }

                // Check if the *determined* potential end time covers the required closing end time
               if (potentialEndTime && potentialEndTime.getTime() >= requiredClosingEndTime.getTime()) {
                    // Can this candidate *be* the closer? Check qualification.
                     if (!(employee.isKeyholderQualified ?? false)) {
                          scheduleLogger.log(`Candidate ${candidateId} cannot be closer: Not keyholder qualified.`);
                          // If not qualified, they cannot perform the closing shift ending at the specific time.
                          // We might need to shorten their potential shift here? Or just let validation fail?
                          // For now, let's not force the end time if they aren't qualified.
                     } else {
                         // If qualified and shift reaches/passes the required closing time, force it.
                         scheduleLogger.log(`Adjusting potential end time for ${candidateId} to match required closing time: ${requiredClosingEndTime.toISOString()}`);
                         potentialEndTime = requiredClosingEndTime;
                         isDesignatedClosingShift = true;
                     }
               }
          }

          if (!potentialEndTime) { 
              scheduleLogger.debug(`Could not determine a valid shift duration for ${candidateId}. Trying next candidate.`);
              continue; 
          }

          const potentialDuration = (potentialEndTime.getTime() - potentialStartTime.getTime()) / 60000;
           if (potentialDuration < config.minShiftMinutes && !(isDesignatedOpeningShift || isDesignatedClosingShift)) { // Allow potentially short keyholder shifts if necessary?
                scheduleLogger.debug(`Shift for ${candidateId} is too short (${potentialDuration} min). Skipping.`);
                continue;
           }
          scheduleLogger.debug(`Potential ${isDesignatedOpeningShift ? 'OPENING ' : ''}${isDesignatedClosingShift ? 'CLOSING ' : ''}shift for ${candidateId}: ${potentialStartTime.toISOString()} - ${potentialEndTime.toISOString()} (${potentialDuration} min)`);


          // --- Full Shift Validation --- 
          const isValid = checkAllConstraints(
              employee, empState,
              potentialStartTime, potentialEndTime, potentialDuration,
              slotCoverageStatus,
              slotLookupMap,
              config
          );

          if (isValid) {
               let finalShift: AssignedShift;
               let durationIncrease = potentialDuration; 
               let originalStartTime = potentialStartTime;
               let originalEndTime = potentialEndTime;
               let oldDuration = 0;
               let shiftToUpdate: AssignedShift | null = null;

               if (extendableCandidates.includes(candidateInfo) && empState.assignedShifts.length > 0) {
                   const lastShift = empState.assignedShifts[empState.assignedShifts.length - 1];
                   if (lastShift.endTime.getTime() === potentialStartTime.getTime()) {
                       shiftToUpdate = lastShift;
                       oldDuration = shiftToUpdate.durationMinutes;
                       originalStartTime = shiftToUpdate.startTime; 
                       originalEndTime = new Date(shiftToUpdate.startTime.getTime() + oldDuration * 60000);
                   }
               }

               if (shiftToUpdate) {
                   scheduleLogger.debug(`Extending existing shift ${shiftToUpdate.id} for ${candidateId}`);
                   shiftToUpdate.endTime = potentialEndTime;
                   shiftToUpdate.durationMinutes = (potentialEndTime.getTime() - shiftToUpdate.startTime.getTime()) / 60000;
                   finalShift = shiftToUpdate;
                   durationIncrease = finalShift.durationMinutes - oldDuration;
               } else {
                   finalShift = {
                       id: crypto.randomUUID(),
                       employeeId: candidateId,
                       startTime: potentialStartTime,
                       endTime: potentialEndTime, 
                       durationMinutes: potentialDuration 
                   };
                   assignments.push(finalShift);
                   empState.assignedShifts.push(finalShift);
               }

              empState.totalMinutesScheduled += durationIncrease;
              empState.lastShiftEndTime = finalShift.endTime;
              const weekNum = getWeekNumber(originalStartTime); 
              const weeklyMinutes = (empState.minutesScheduledByWeek.get(weekNum) || 0) + durationIncrease;
              empState.minutesScheduledByWeek.set(weekNum, weeklyMinutes);
              if (shiftToUpdate) { 
                  updateDailyState(empState, originalStartTime, originalEndTime, -oldDuration);
              }
              updateDailyState(empState, finalShift.startTime, finalShift.endTime, finalShift.durationMinutes);
              updateConsecutiveDaysState(empState, finalShift.startTime, finalShift.endTime); 

              if (isDesignatedClosingShift) {
                  previousDayKeyholderId = finalShift.employeeId;
                  previousDayString = getDateString(finalShift.startTime); 
                  scheduleLogger.log(`Recorded ${previousDayKeyholderId} as keyholder after closing shift on ${previousDayString}.`);
              }

              let slotTimeToUpdate = new Date(potentialStartTime);
              while (slotTimeToUpdate < potentialEndTime) {
                  const slotIdToUpdate = slotTimeToUpdate.toISOString(); 
                  const slotExists = slotLookupMap.has(slotIdToUpdate);
                  if (slotExists) { 
                      const statusToUpdate = slotCoverageStatus.get(slotIdToUpdate);
                      if (statusToUpdate && !statusToUpdate.assignedEmployeeIds.has(candidateId)) {
                          statusToUpdate.assignedCount++;
                          statusToUpdate.assignedEmployeeIds.add(candidateId);
                      }
                      else if (!statusToUpdate) {
                           warnings.push(`Error: Could not find status for slot ${slotIdToUpdate} during update.`);
                      }
                  } else {
                       warnings.push(`Warning: Attempted to update coverage for a non-existent slot time ${slotTimeToUpdate.toISOString()}. Shift may extend beyond coverage needs.`);
                  }
                  slotTimeToUpdate = new Date(slotTimeToUpdate.getTime() + config.slotIntervalMinutes * 60000);
              }

              assignedThisIteration = true;
              needed--;
              break; 
          } else {
              scheduleLogger.debug(`Proposed ${isDesignatedOpeningShift ? 'OPENING ' : ''}${isDesignatedClosingShift ? 'CLOSING ' : ''}shift/extension for ${candidateId} failed validation.`);
          }
      } 

      if (!assignedThisIteration) {
          scheduleLogger.debug(`Could not find/validate assignment for slot ${slot.id} need.`);
          break; 
      }
    } 
  } 

  // 4. Finalization & Post-Processing
  if (config.breakThresholdMinutes && config.breakDurationMinutes) {
      scheduleLogger.debug("Checking for required break durations (> " + config.breakThresholdMinutes / 60 + " hours)...");
      for (const shift of assignments) {
          if (shift.durationMinutes > config.breakThresholdMinutes) {
              shift.breakDurationMinutes = config.breakDurationMinutes;
              scheduleLogger.log(`Shift ${shift.id} (${shift.durationMinutes} min) requires a ${config.breakDurationMinutes} min break.`);
          }
      }
  }

  const unfilledSlots: RequiredSlot[] = [];
  for (const status of slotCoverageStatus.values()) {
    if (status.assignedCount < status.requiredSlot.minEmployees) {
      unfilledSlots.push(status.requiredSlot);
      warnings.push(`Slot ${status.requiredSlot.id} (${status.requiredSlot.startTime.toISOString()}) is understaffed. Needed: ${status.requiredSlot.minEmployees}, Assigned: ${status.assignedCount}`);
    }
     if (status.assignedCount > status.requiredSlot.maxEmployees) {
        warnings.push(`Slot ${status.requiredSlot.id} (${status.requiredSlot.startTime.toISOString()}) is overstaffed. Max: ${status.requiredSlot.maxEmployees}, Assigned: ${status.assignedCount}`);
    }
  }

  scheduleLogger.debug(`Assignment finished. ${assignments.length} shifts assigned. ${unfilledSlots.length} unfilled slots.`);

  return { assignments, unfilledSlots, warnings };
}

// TODOs:
// - Verify/Choose UUID generation method (crypto.randomUUID selected)
// - Refine Edge Cases (DST - commented limitations, Midnight consecutive days - looks okay)
// - Improve Break Logic (ensure coverage during breaks, staggering) -> Simplified, only duration added
// - Refine Prioritization (add preferences, costs) -> Added day and time preference
// - Implement Role Matching (if needed later)
// - Keyholder: What if store is closed on consecutive days? (Current logic should handle passing null keyholder forward)


 