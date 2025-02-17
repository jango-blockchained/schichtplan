import { useState, useEffect } from 'react';
import { getSchedules, getEmployees, WeeklySchedule, ScheduleData } from '../services/api';
import { Employee } from '../types';
import { useQuery } from '@tanstack/react-query';

export const useScheduleData = (weekStart: Date, weekEnd: Date) => {
    const {
        data: scheduleData,
        isLoading,
        error,
        refetch
    } = useQuery({
        queryKey: ['schedules', weekStart.toISOString(), weekEnd.toISOString()],
        queryFn: async () => {
            const [schedules, employees] = await Promise.all([
                getSchedules(
                    weekStart.toISOString().split('T')[0],
                    weekEnd.toISOString().split('T')[0]
                ),
                getEmployees()
            ]);

            // Transform data into the format expected by ShiftTable
            const employeeMap = new Map(employees.map(emp => [emp.id, emp]));
            const weeklySchedules = new Map<number, WeeklySchedule>();

            // Initialize weekly schedules for all employees
            employees.forEach(employee => {
                weeklySchedules.set(employee.id, {
                    employee_id: employee.id,
                    name: `${employee.last_name}, ${employee.first_name}`,
                    position: getPositionString(employee.employee_group),
                    contracted_hours: `${employee.contracted_hours}h`,
                    shifts: []
                });
            });

            // Process schedules
            schedules.forEach(schedule => {
                const employee = employeeMap.get(schedule.employee.id);
                if (!employee) return;

                const weeklySchedule = weeklySchedules.get(employee.id);
                if (!weeklySchedule) return;

                const scheduleDate = new Date(schedule.date);
                const day = scheduleDate.getDay();
                // Adjust to make Monday = 0
                const adjustedDay = day === 0 ? 6 : day - 1;

                weeklySchedule.shifts.push({
                    day: adjustedDay,
                    start: schedule.shift.start_time,
                    end: schedule.shift.end_time,
                    break: schedule.break_start && schedule.break_end ? {
                        start: schedule.break_start,
                        end: schedule.break_end
                    } : undefined
                });
            });

            return Array.from(weeklySchedules.values());
        },
        enabled: Boolean(weekStart && weekEnd)
    });

    return {
        scheduleData: scheduleData || [],
        loading: isLoading,
        error: error ? (error as Error).message : null,
        refetch
    };
};

function getPositionString(employeeGroup: string): string {
    const positionMap: Record<string, string> = {
        'VL': 'Vollzeit',
        'TZ': 'Teilzeit',
        'GFB': 'Minijob',
        'TL': 'Teamleiter'
    };
    return positionMap[employeeGroup] || employeeGroup;
} 