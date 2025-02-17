import { useState, useEffect } from 'react';
import { getSchedules, getEmployees, getShifts } from '../services/api';
import { Employee, Schedule, Shift } from '../types';

interface ScheduleEmployee {
    name: string;
    position: string;
    contractedHours: string;
    shifts: Array<{
        day: number;
        start?: string;
        end?: string;
        break?: {
            start: string;
            end: string;
        };
    }>;
}

export const useScheduleData = (weekStart: Date, weekEnd: Date) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [scheduleData, setScheduleData] = useState<ScheduleEmployee[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);

                // Fetch all required data in parallel
                const [schedules, employees, shifts] = await Promise.all([
                    getSchedules(
                        weekStart.toISOString().split('T')[0],
                        weekEnd.toISOString().split('T')[0]
                    ),
                    getEmployees(),
                    getShifts()
                ]);

                // Create a map for quick shift lookups
                const shiftsMap = new Map(shifts.map(shift => [shift.id, shift]));

                // Transform data into the format expected by ShiftTable
                const transformedData = employees.map(employee => {
                    // Get all schedules for this employee in the current week
                    const employeeSchedules = schedules.filter(
                        schedule => schedule.employee_id === employee.id
                    );

                    // Transform schedules into shifts array
                    const employeeShifts = employeeSchedules.map(schedule => {
                        const shift = shiftsMap.get(schedule.shift_id.toString());
                        if (!shift) return null;

                        // Calculate day of week (0-6)
                        const scheduleDate = new Date(schedule.date);
                        const day = scheduleDate.getDay();
                        // Adjust to make Monday = 0
                        const adjustedDay = day === 0 ? 6 : day - 1;

                        return {
                            day: adjustedDay,
                            start: shift.start_time,
                            end: shift.end_time,
                            break: schedule.break_start && schedule.break_end ? {
                                start: schedule.break_start,
                                end: schedule.break_end
                            } : undefined
                        };
                    }).filter((shift): shift is NonNullable<typeof shift> => shift !== null);

                    // Map employee group to position string
                    const positionMap: Record<string, string> = {
                        'VL': 'Vollzeit',
                        'TZ': 'Teilzeit',
                        'GFB': 'Minijob',
                        'TL': 'Teamleiter'
                    };

                    return {
                        name: `${employee.last_name}, ${employee.first_name}`,
                        position: positionMap[employee.employee_group] || employee.employee_group,
                        contractedHours: `${employee.contracted_hours}h`,
                        shifts: employeeShifts
                    };
                });

                setScheduleData(transformedData);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [weekStart, weekEnd]);

    return { scheduleData, loading, error };
}; 