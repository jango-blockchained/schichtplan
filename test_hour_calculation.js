// Test script to verify the hour calculation fixes
const { parseISO, isWithinInterval } = require('date-fns');

// Mock data that matches the issue from the screenshot
const mockSchedules = [
  {
    id: 1,
    employee_id: 101,
    date: "2024-06-23", // Monday
    shift_start: "08:00",
    shift_end: "16:00",
    break_start: "12:00",
    break_end: "12:30",
    shift_id: 1,
    is_empty: false
  },
  {
    id: 2,
    employee_id: 101,
    date: "2024-06-24", // Tuesday
    shift_start: "09:00",
    shift_end: "17:00",
    break_start: "13:00",
    break_end: "13:30",
    shift_id: 2,
    is_empty: false
  },
  {
    id: 3,
    employee_id: 101,
    date: "2024-06-25", // Wednesday
    shift_start: "08:30",
    shift_end: "16:30",
    break_start: "12:30",
    break_end: "13:00",
    shift_id: 3,
    is_empty: false
  },
  // Some schedules from outside the date range (should not be counted)
  {
    id: 4,
    employee_id: 101,
    date: "2024-06-16", // Previous week Monday
    shift_start: "08:00",
    shift_end: "16:00",
    break_start: "12:00",
    break_end: "12:30",
    shift_id: 4,
    is_empty: false
  },
  {
    id: 5,
    employee_id: 101,
    date: "2024-06-30", // Next week Monday
    shift_start: "08:00",
    shift_end: "16:00",
    break_start: "12:00",
    break_end: "12:30",
    shift_id: 5,
    is_empty: false
  }
];

const mockEmployees = [
  {
    id: 101,
    first_name: "Brauner",
    last_name: "Nadine",
    is_keyholder: false
  }
];

// Mock date range for the week being displayed (June 23-29, 2024)
const mockDateRange = {
  from: parseISO("2024-06-23"), // Monday
  to: parseISO("2024-06-29")    // Sunday
};

// Test the calculateWorkingTime function logic
function calculateBaseDuration(startTime, endTime) {
  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  };
  
  const startMinutes = timeToMinutes(startTime);
  let endMinutes = timeToMinutes(endTime);
  
  // Handle overnight shifts
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }
  
  return (endMinutes - startMinutes) / 60; // Return in hours
}

function calculateBreakDuration(schedule) {
  if (schedule.break_start && schedule.break_end) {
    return calculateBaseDuration(schedule.break_start, schedule.break_end);
  }
  return 0;
}

function calculateWorkingTime(schedule) {
  if (!schedule.shift_start || !schedule.shift_end) {
    return { totalTime: 0, breakTime: 0, workingTime: 0 };
  }
  
  const totalTime = calculateBaseDuration(schedule.shift_start, schedule.shift_end);
  const breakTime = calculateBreakDuration(schedule);
  const workingTime = Math.max(0, totalTime - breakTime);
  
  return { totalTime, breakTime, workingTime };
}

// Test the fixed calculateEmployeeHours function
function calculateEmployeeHours(employeeId, schedules, dateRange) {
  if (!dateRange?.from || !dateRange?.to) {
    return { weeklyHours: 0, monthlyHours: 0, totalHours: 0 };
  }

  const employeeSchedules = schedules.filter(
    (s) => s.employee_id === employeeId && s.shift_id !== null && !s.is_empty
  );

  let totalHours = 0;

  employeeSchedules.forEach((schedule) => {
    if (!schedule.shift_start || !schedule.shift_end || !schedule.date) return;

    try {
      const scheduleDate = parseISO(schedule.date);
      
      // Only include schedules within the actual displayed date range
      if (isWithinInterval(scheduleDate, { start: dateRange.from, end: dateRange.to })) {
        const timeCalc = calculateWorkingTime(schedule);
        const workingHours = timeCalc.workingTime;
        
        console.log(`Schedule ${schedule.id} on ${schedule.date}: ${schedule.shift_start}-${schedule.shift_end}, Working hours: ${workingHours}`);
        totalHours += workingHours;
      } else {
        console.log(`Schedule ${schedule.id} on ${schedule.date}: OUTSIDE DATE RANGE - excluded`);
      }
    } catch (error) {
      console.error("Error calculating hours for schedule:", error);
    }
  });

  // For weekly/monthly views, the total hours within the date range IS the weekly/monthly total
  return { 
    weeklyHours: totalHours, 
    monthlyHours: totalHours, 
    totalHours: totalHours 
  };
}

// Test the calculation
console.log("Testing hour calculation for Brauner, Nadine (ID: 101)");
console.log("Date range:", mockDateRange.from.toISOString().split('T')[0], "to", mockDateRange.to.toISOString().split('T')[0]);
console.log("");

const result = calculateEmployeeHours(101, mockSchedules, mockDateRange);

console.log("");
console.log("Results:");
console.log(`Weekly hours: ${result.weeklyHours}`);
console.log(`Monthly hours: ${result.monthlyHours}`);
console.log(`Total hours: ${result.totalHours}`);

// Expected: Should be around 23.5 hours (3 days × ~7.5 hours each with 30min breaks)
// Monday: 8h - 0.5h = 7.5h
// Tuesday: 8h - 0.5h = 7.5h  
// Wednesday: 8h - 0.5h = 7.5h
// Total: 22.5h

console.log("");
console.log("Expected: Around 22.5 hours (3 shifts × 7.5 hours each)");
console.log("Previous bug would have shown ~93 hours by including all schedules");
