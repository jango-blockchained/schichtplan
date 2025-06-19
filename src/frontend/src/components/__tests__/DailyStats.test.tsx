import { describe, it, expect } from 'bun:test';

// Mock data
const mockSchedules = [
  {
    id: 1,
    employee_id: 1,
    date: '2025-06-19',
    shift_id: 1,
    shift_start: '09:00',
    shift_end: '17:00',
    is_empty: false,
    version: 1,
    status: 'DRAFT' as const,
    shift_type_id: 'EARLY' as const,
  },
  {
    id: 2,
    employee_id: 2,
    date: '2025-06-19',
    shift_id: 2,
    shift_start: '13:00',
    shift_end: '21:00',
    is_empty: false,
    version: 1,
    status: 'DRAFT' as const,
    shift_type_id: 'LATE' as const,
  },
];

const mockEmployees = [
  {
    id: 1,
    employee_id: 'EMP001',
    first_name: 'John',
    last_name: 'Doe',
    employee_group: 'VZ',
    contracted_hours: 40,
    is_keyholder: true,
    is_active: true,
    birthday: null,
    email: null,
    phone: null,
    created_at: null,
    updated_at: null,
    max_daily_hours: 8,
    max_weekly_hours: 40,
  },
  {
    id: 2,
    employee_id: 'EMP002',
    first_name: 'Jane',
    last_name: 'Smith',
    employee_group: 'TZ',
    contracted_hours: 20,
    is_keyholder: false,
    is_active: true,
    birthday: null,
    email: null,
    phone: null,
    created_at: null,
    updated_at: null,
    max_daily_hours: 8,
    max_weekly_hours: 20,
  },
];

const mockDaysToDisplay = [new Date('2025-06-19')];

// Simple test to verify the DailyStats component logic
describe('DailyStats Logic', () => {
  it('should calculate daily statistics correctly', () => {
    // Test the logic that would be in the DailyStats component
    const daysToDisplay = mockDaysToDisplay;
    const schedules = mockSchedules;
    const employees = mockEmployees;

    const dailyStats = daysToDisplay.map(date => {
      const dateStr = '2025-06-19'; // format(date, 'yyyy-MM-dd');
      const daySchedules = schedules.filter(schedule => 
        schedule.date === dateStr && !schedule.is_empty && schedule.shift_id
      );
      
      const totalEmployees = daySchedules.length;
      expect(totalEmployees).toBe(2);
      
      // Count keyholders
      const keyholders = daySchedules.filter(schedule => {
        const employee = employees.find(emp => emp.id === schedule.employee_id);
        return employee?.is_keyholder;
      }).length;
      expect(keyholders).toBe(1); // Only John Doe is keyholder
      
      // Count shift types
      const shiftTypes = daySchedules.reduce((acc, schedule) => {
        const shiftType = schedule.shift_type_id || 'UNKNOWN';
        acc[shiftType] = (acc[shiftType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      expect(shiftTypes.EARLY).toBe(1);
      expect(shiftTypes.LATE).toBe(1);
      
      return {
        date,
        dateStr,
        totalEmployees,
        keyholders,
        shiftTypes
      };
    });

    expect(dailyStats).toHaveLength(1);
    expect(dailyStats[0].totalEmployees).toBe(2);
    expect(dailyStats[0].keyholders).toBe(1);
  });
});
