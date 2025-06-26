import { isEarlyShift, isLateShift } from "@/lib/utils";
import { createSchedule, getSchedules, Shift } from "@/services/api";
import { addDays, format, subDays } from "date-fns";

interface ConsecutiveShiftRequirement {
  date: string;
  shiftType: "EARLY" | "LATE";
  reason: string;
}

interface ConsecutiveShiftValidation {
  isValid: boolean;
  conflicts: string[];
  requirements: ConsecutiveShiftRequirement[];
}

/**
 * Get the next business day after a given date based on store opening days
 */
export function getNextBusinessDay(date: Date, openingDays?: { [key: string]: boolean }): Date {
  const defaultOpeningDays = {
    "0": true,  // Monday
    "1": true,  // Tuesday
    "2": true,  // Wednesday
    "3": true,  // Thursday
    "4": true,  // Friday
    "5": true,  // Saturday
    "6": false, // Sunday
  };
  
  const openDays = openingDays || defaultOpeningDays;
  let nextDay = addDays(date, 1);
  
  // Find next open day (max 7 days to avoid infinite loop)
  for (let i = 0; i < 7; i++) {
    const dayOfWeek = nextDay.getDay();
    // Convert Sunday=0 to Monday=0 format
    const dayIndex = dayOfWeek === 0 ? "6" : (dayOfWeek - 1).toString();
    
    if (openDays[dayIndex]) {
      return nextDay;
    }
    nextDay = addDays(nextDay, 1);
  }
  
  // Fallback to next day if no opening days found
  return addDays(date, 1);
}

/**
 * Get consecutive shift requirements for a given shift
 */
export function getConsecutiveShiftRequirements(
  shift: { shift_type_id?: string; start_time?: string; end_time?: string },
  date: Date,
  openingDays?: { [key: string]: boolean }
): ConsecutiveShiftRequirement[] {
  const requirements: ConsecutiveShiftRequirement[] = [];
  const dayOfWeek = date.getDay();
  const isSaturday = dayOfWeek === 6; // Saturday in JavaScript Date
  
  if (isEarlyShift(shift)) {
    // EARLY shift requires LATE shift on previous day
    const prevDay = subDays(date, 1);
    requirements.push({
      date: format(prevDay, "yyyy-MM-dd"),
      shiftType: "LATE",
      reason: "Early shift requires late shift on previous day"
    });
  }
  
  if (isLateShift(shift)) {
    // LATE shift requires EARLY shift on next day
    let nextDay = addDays(date, 1);
    let reason = "Late shift requires early shift on next day";
    
    // Special case: Saturday closing rule
    if (isSaturday) {
      nextDay = getNextBusinessDay(date, openingDays);
      reason = "Saturday closing requires opening next business day";
    }
    
    requirements.push({
      date: format(nextDay, "yyyy-MM-dd"),
      shiftType: "EARLY",
      reason
    });
  }
  
  return requirements;
}

/**
 * Validate if consecutive shift requirements can be met for an employee
 */
export async function validateConsecutiveShiftRequirements(
  employeeId: number,
  shift: { shift_type_id?: string; start_time?: string; end_time?: string },
  date: Date,
  openingDays?: { [key: string]: boolean }
): Promise<ConsecutiveShiftValidation> {
  const requirements = getConsecutiveShiftRequirements(shift, date, openingDays);
  const conflicts: string[] = [];
  
  if (requirements.length === 0) {
    return { isValid: true, conflicts: [], requirements: [] };
  }
  
  // Get schedules for required dates
  const allDates = requirements.map(req => req.date);
  const startDate = allDates.reduce((min, date) => date < min ? date : min);
  const endDate = allDates.reduce((max, date) => date > max ? date : max);
  
  try {
    const response = await getSchedules(startDate, endDate, undefined, true);
    const existingSchedules = response.schedules || [];
    
    // Check each requirement
    for (const requirement of requirements) {
      const existingSchedule = existingSchedules.find(
        schedule => schedule.employee_id === employeeId && schedule.date === requirement.date
      );
      
      if (existingSchedule && !existingSchedule.is_empty) {
        // Employee already has a shift on required date
        const existingShiftType = isEarlyShift(existingSchedule) ? "EARLY" : 
                                 isLateShift(existingSchedule) ? "LATE" : "MIDDLE";
        
        if (existingShiftType !== requirement.shiftType) {
          conflicts.push(
            `Employee already has ${existingShiftType} shift on ${requirement.date}, but ${requirement.shiftType} shift is required (${requirement.reason})`
          );
        }
      }
    }
    
    return {
      isValid: conflicts.length === 0,
      conflicts,
      requirements
    };
    
  } catch (error) {
    console.error("Error validating consecutive shift requirements:", error);
    return {
      isValid: false,
      conflicts: ["Failed to validate consecutive shift requirements"],
      requirements
    };
  }
}

/**
 * Create required consecutive shifts for an employee
 */
export async function createRequiredConsecutiveShifts(
  employeeId: number,
  shift: { shift_type_id?: string; start_time?: string; end_time?: string },
  date: Date,
  currentVersion: number,
  shifts: Shift[],
  openingDays?: { [key: string]: boolean }
): Promise<void> {
  const requirements = getConsecutiveShiftRequirements(shift, date, openingDays);
  
  if (requirements.length === 0) {
    return;
  }
  
  // Get existing schedules to avoid duplicates
  const allDates = requirements.map(req => req.date);
  const startDate = allDates.reduce((min, date) => date < min ? date : min);
  const endDate = allDates.reduce((max, date) => date > max ? date : max);
  
  try {
    const response = await getSchedules(startDate, endDate, undefined, true);
    const existingSchedules = response.schedules || [];
    
    // Create required shifts
    for (const requirement of requirements) {
      const existingSchedule = existingSchedules.find(
        schedule => schedule.employee_id === employeeId && schedule.date === requirement.date
      );
      
      // Only create if no existing schedule
      if (!existingSchedule || existingSchedule.is_empty) {
        // Find appropriate shift template
        const shiftTemplate = shifts.find(s => 
          (requirement.shiftType === "EARLY" && isEarlyShift(s)) ||
          (requirement.shiftType === "LATE" && isLateShift(s))
        );
        
        if (shiftTemplate) {
          console.log(`Creating ${requirement.shiftType} shift for employee ${employeeId} on ${requirement.date} (${requirement.reason})`);
          
          await createSchedule({
            employee_id: employeeId,
            shift_id: shiftTemplate.id,
            date: requirement.date,
            version: currentVersion,
            availability_type: "AVAILABLE"
          });
        } else {
          console.warn(`No ${requirement.shiftType} shift template found for consecutive shift requirement`);
        }
      }
    }
    
  } catch (error) {
    console.error("Error creating consecutive shifts:", error);
    throw new Error(`Failed to create required consecutive shifts: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
