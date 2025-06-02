import { Schedule } from './api';
import { Employee } from '@/types';

interface MEPData {
  filiale: string;
  dateInfo: {
    monthYear: string;
    weekFrom: string;
    weekTo: string;
  };
  employees: Array<{
    id: number;
    firstName: string;
    lastName: string;
    position: string;
    dailySchedules: Record<string, {
      startTime: string;
      endTime: string;
      breakStart: string;
      dailySum: string;
    }>;
    weeklySum: string;
    monthlySum: string;
  }>;
  dateRangeDays: Array<{
    date: Date;
    name: string;
    dateFormatted: string;
  }>;
}

// Employee group to position mapping
const POSITION_MAPPING: Record<string, string> = {
  'VZ': 'Vollzeit',
  'TZ': 'Teilzeit',
  'GFB': 'Geringfügig Beschäftigte',
  'TL': 'Teamleitung',
  'GfB': 'Geringfügig Beschäftigte', // Alternative spelling
};

// German day names
const DAY_NAMES_DE: Record<number, string> = {
  0: 'Montag',
  1: 'Dienstag', 
  2: 'Mittwoch',
  3: 'Donnerstag',
  4: 'Freitag',
  5: 'Samstag',
  6: 'Sonntag'
};

// German month names
const MONTH_NAMES_DE: Record<number, string> = {
  0: 'Januar', 1: 'Februar', 2: 'März', 3: 'April',
  4: 'Mai', 5: 'Juni', 6: 'Juli', 7: 'August',
  8: 'September', 9: 'Oktober', 10: 'November', 11: 'Dezember'
};

export class MEPDataService {
  /**
   * Process schedule data for MEP template
   */
  static processSchedulesForMEP(
    schedules: Schedule[],
    employees: Employee[],
    startDate: Date,
    endDate: Date,
    filiale: string = ''
  ): MEPData {
    // Generate date info
    const dateInfo = this.generateDateInfo(startDate, endDate);
    
    // Generate date range days
    const dateRangeDays = this.generateDateRangeDays(startDate, endDate);
    
    // Group schedules by employee
    const schedulesByEmployee = this.groupSchedulesByEmployee(schedules);
    
    // Create employee lookup
    const employeeMap = new Map(employees.map(emp => [emp.id, emp]));
    
    // Process employee data
    const processedEmployees = [];
    
    // First, add employees who have schedules
    for (const [employeeId, empSchedules] of schedulesByEmployee.entries()) {
      const employee = employeeMap.get(employeeId);
      if (!employee) continue;
      
      const processedEmployee = this.processEmployeeData(
        employee,
        empSchedules,
        dateRangeDays
      );
      processedEmployees.push(processedEmployee);
    }
    
    // Then, add employees without schedules (empty rows)
    const employeesWithSchedules = new Set(schedulesByEmployee.keys());
    for (const employee of employees) {
      if (!employeesWithSchedules.has(employee.id)) {
        const processedEmployee = this.processEmployeeData(
          employee,
          [],
          dateRangeDays
        );
        processedEmployees.push(processedEmployee);
      }
    }
    
    // Sort employees by name
    processedEmployees.sort((a, b) => 
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
    );
    
    return {
      filiale,
      dateInfo,
      employees: processedEmployees,
      dateRangeDays
    };
  }
  
  /**
   * Generate formatted date information
   */
  private static generateDateInfo(startDate: Date, endDate: Date) {
    const monthYear = `${MONTH_NAMES_DE[startDate.getMonth()]} ${startDate.getFullYear()}`;
    const weekFrom = this.formatDateGerman(startDate);
    const weekTo = this.formatDateGerman(endDate);
    
    return {
      monthYear,
      weekFrom,
      weekTo
    };
  }
  
  /**
   * Generate list of days in date range
   */
  private static generateDateRangeDays(startDate: Date, endDate: Date) {
    const days = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const weekday = currentDate.getDay();
      const mondayBasedWeekday = weekday === 0 ? 6 : weekday - 1; // Convert Sunday=0 to Monday=0
      
      days.push({
        date: new Date(currentDate),
        name: DAY_NAMES_DE[mondayBasedWeekday],
        dateFormatted: this.formatDateShort(currentDate)
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  }
  
  /**
   * Group schedules by employee ID
   */
  private static groupSchedulesByEmployee(schedules: Schedule[]) {
    const grouped = new Map<number, Schedule[]>();
    
    for (const schedule of schedules) {
      if (!grouped.has(schedule.employee_id)) {
        grouped.set(schedule.employee_id, []);
      }
      grouped.get(schedule.employee_id)!.push(schedule);
    }
    
    return grouped;
  }
  
  /**
   * Process individual employee data
   */
  private static processEmployeeData(
    employee: Employee,
    schedules: Schedule[],
    dateRangeDays: Array<{ date: Date; name: string; dateFormatted: string }>
  ) {
    // Create schedule lookup by date
    const scheduleByDate = new Map<string, Schedule>();
    for (const schedule of schedules) {
      const dateKey = schedule.date;
      scheduleByDate.set(dateKey, schedule);
    }
    
    // Process daily schedules
    const dailySchedules: Record<string, any> = {};
    let totalWeeklyHours = 0;
    
    for (const day of dateRangeDays) {
      const dateStr = day.date.toISOString().split('T')[0];
      const schedule = scheduleByDate.get(dateStr);
      
      if (schedule) {
        const dailyData = this.processDailySchedule(schedule);
        dailySchedules[dateStr] = dailyData;
        totalWeeklyHours += dailyData.workingHours;
      } else {
        dailySchedules[dateStr] = {
          startTime: '',
          endTime: '',
          breakStart: '',
          dailySum: '',
          workingHours: 0
        };
      }
    }
    
    // Get employee position
    const employeeGroup = employee.employee_group?.toString() || '';
    const position = POSITION_MAPPING[employeeGroup] || employeeGroup;
    
    return {
      id: employee.id,
      firstName: employee.first_name || '',
      lastName: employee.last_name || '',
      position,
      dailySchedules,
      weeklySum: this.formatHours(totalWeeklyHours),
      monthlySum: this.formatHours(totalWeeklyHours), // Simplified - same as weekly for now
    };
  }
  
  /**
   * Process a single daily schedule
   */
  private static processDailySchedule(schedule: Schedule) {
    const startTime = this.formatTimeForDisplay(schedule.shift_start);
    const endTime = this.formatTimeForDisplay(schedule.shift_end);
    const breakStart = this.formatTimeForDisplay(schedule.break_start);
    
    // Calculate working hours
    const workingHours = this.calculateWorkingHours(
      schedule.shift_start,
      schedule.shift_end,
      schedule.break_start,
      schedule.break_end
    );
    
    return {
      startTime,
      endTime,
      breakStart,
      dailySum: this.formatHours(workingHours),
      workingHours
    };
  }
  
  /**
   * Format time for display (HH:MM)
   */
  private static formatTimeForDisplay(timeStr?: string | null): string {
    if (!timeStr) return '';
    
    // If it's already in HH:MM format
    if (timeStr.includes(':') && timeStr.length >= 5) {
      return timeStr.substring(0, 5);
    }
    
    return timeStr;
  }
  
  /**
   * Calculate working hours with break deduction
   */
  private static calculateWorkingHours(
    startTime?: string | null,
    endTime?: string | null,
    breakStart?: string | null,
    breakEnd?: string | null
  ): number {
    if (!startTime || !endTime) return 0;
    
    try {
      const start = this.parseTimeToMinutes(startTime);
      const end = this.parseTimeToMinutes(endTime);
      
      if (start === null || end === null) return 0;
      
      let totalMinutes = end - start;
      
      // Handle overnight shifts
      if (totalMinutes < 0) {
        totalMinutes += 24 * 60;
      }
      
      // Deduct break time
      if (breakStart && breakEnd) {
        const breakStartMin = this.parseTimeToMinutes(breakStart);
        const breakEndMin = this.parseTimeToMinutes(breakEnd);
        
        if (breakStartMin !== null && breakEndMin !== null) {
          let breakDuration = breakEndMin - breakStartMin;
          if (breakDuration < 0) breakDuration += 24 * 60;
          totalMinutes -= breakDuration;
        }
      } else {
        // Default break for shifts > 6 hours
        if (totalMinutes > 6 * 60) {
          totalMinutes -= 30; // 30 minutes break
        }
      }
      
      return Math.max(0, totalMinutes / 60);
    } catch {
      return 0;
    }
  }
  
  /**
   * Parse time string to minutes since midnight
   */
  private static parseTimeToMinutes(timeStr: string): number | null {
    if (!timeStr || !timeStr.includes(':')) return null;
    
    const parts = timeStr.split(':');
    if (parts.length < 2) return null;
    
    try {
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      return hours * 60 + minutes;
    } catch {
      return null;
    }
  }
  
  /**
   * Format hours for display (H:MM)
   */
  private static formatHours(hours: number): string {
    if (hours === 0) return '';
    
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    
    if (minutes === 0) {
      return `${wholeHours}:00`;
    } else {
      return `${wholeHours}:${minutes.toString().padStart(2, '0')}`;
    }
  }
  
  /**
   * Format date in German format (DD.MM.YYYY)
   */
  private static formatDateGerman(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }
  
  /**
   * Format date short (DD.MM.)
   */
  private static formatDateShort(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}.${month}.`;
  }
} 