import React, { useState } from 'react';
import { Schedule, ScheduleUpdate, Employee } from '@/types';
import { DateRange } from 'react-day-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { getSettings, getEmployees } from '@/services/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface EmployeeViewProps {
    schedules: Schedule[];
    dateRange: DateRange | undefined;
    onDrop: (scheduleId: number, newEmployeeId: number, newDate: Date, newShiftId: number) => Promise<void>;
    onUpdate: (scheduleId: number, updates: ScheduleUpdate) => Promise<void>;
    isLoading: boolean;
    employeeAbsences?: Record<number, any[]>;
    absenceTypes?: Array<{
        id: string;
        name: string;
        color: string;
        type: 'absence';
    }>;
}

export const EmployeeView = ({
    schedules,
    dateRange,
    onDrop,
    onUpdate,
    isLoading,
    employeeAbsences,
    absenceTypes
}: EmployeeViewProps) => {
    // Fetch settings and employees
    const { data: settings, isLoading: isLoadingSettings } = useQuery({
        queryKey: ['settings'],
        queryFn: getSettings
    });

    const { data: employees, isLoading: isLoadingEmployees } = useQuery({
        queryKey: ['employees'],
        queryFn: getEmployees
    });

    // State for selected employee
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

    if (isLoading || isLoadingSettings || isLoadingEmployees) {
        return <Skeleton className="w-full h-[600px]" />;
    }

    if (!dateRange?.from || !dateRange?.to) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Bitte wählen Sie einen Datumsbereich aus</AlertDescription>
            </Alert>
        );
    }

    if (!employees || employees.length === 0) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Keine Mitarbeiter gefunden</AlertDescription>
            </Alert>
        );
    }

    // Select the first employee if none is selected
    if (selectedEmployeeId === null && employees.length > 0) {
        setSelectedEmployeeId(employees[0].id);
    }

    // Find the selected employee
    const selectedEmployee = employees.find(emp => emp.id === selectedEmployeeId);

    // Get all days in the date range
    const days = eachDayOfInterval({
        start: dateRange.from,
        end: dateRange.to
    });

    // Filter schedules for the selected employee
    const employeeSchedules = schedules.filter(schedule => 
        schedule.employee_id === selectedEmployeeId
    );

    // Group schedules by date
    const schedulesByDate: Record<string, Schedule[]> = {};
    employeeSchedules.forEach(schedule => {
        if (!schedule.date) return;
        
        const dateKey = schedule.date.split('T')[0]; // Format: YYYY-MM-DD
        if (!schedulesByDate[dateKey]) {
            schedulesByDate[dateKey] = [];
        }
        schedulesByDate[dateKey].push(schedule);
    });

    // Function to get absence for a specific day
    const getAbsenceForDay = (day: Date): any | null => {
        if (!employeeAbsences || !selectedEmployeeId || !employeeAbsences[selectedEmployeeId]) {
            return null;
        }

        const dayFormatted = format(day, 'yyyy-MM-dd');
        return employeeAbsences[selectedEmployeeId].find(absence => {
            const absenceStart = new Date(absence.start_date);
            const absenceEnd = new Date(absence.end_date);
            const currentDate = new Date(dayFormatted);
            
            return currentDate >= absenceStart && currentDate <= absenceEnd;
        });
    };

    // Helper function to get shift type badge
    const getShiftTypeBadge = (shiftTypeId?: string) => {
        if (!shiftTypeId) return null;
        
        let variant = 'default';
        let label = shiftTypeId;
        
        switch(shiftTypeId) {
            case 'EARLY':
                variant = 'default';
                label = 'Früh';
                break;
            case 'MIDDLE':
                variant = 'secondary';
                label = 'Mittel';
                break;
            case 'LATE':
                variant = 'outline';
                label = 'Spät';
                break;
            case 'NON_WORKING':
                variant = 'outline';
                label = '---';
                break;
            case 'OFF':
                variant = 'outline';
                label = 'Frei';
                break;
        }
        
        return (
            <Badge variant={variant as any} className={shiftTypeId === 'NON_WORKING' ? 'bg-slate-100 text-slate-400 border-slate-200' : ''}>
                {label}
            </Badge>
        );
    };

    // Function to get absence badge
    const getAbsenceBadge = (absence: any) => {
        if (!absence || !absenceTypes) return null;
        
        const absenceType = absenceTypes.find(type => type.id === absence.absence_type);
        const style = absenceType ? 
            { backgroundColor: `${absenceType.color}20`, color: absenceType.color, borderColor: absenceType.color } :
            { backgroundColor: '#ff000020', color: '#ff0000', borderColor: '#ff0000' };
            
        return (
            <Badge variant="outline" style={style}>
                {absenceType?.name || 'Abwesend'}
            </Badge>
        );
    };

    // Calculate statistics
    const getStatistics = () => {
        if (!selectedEmployeeId) return null;

        const totalSchedules = employeeSchedules.length;
        const totalHours = employeeSchedules.reduce((total, schedule) => {
            if (!schedule.shift_start || !schedule.shift_end) return total;
            
            const [startHour, startMinute] = schedule.shift_start.split(':').map(Number);
            const [endHour, endMinute] = schedule.shift_end.split(':').map(Number);
            
            const durationInHours = (endHour - startHour) + (endMinute - startMinute) / 60;
            return total + durationInHours;
        }, 0);

        // Count by shift type
        const shiftTypeCounts: Record<string, number> = {};
        employeeSchedules.forEach(schedule => {
            if (schedule.shift_type_id) {
                shiftTypeCounts[schedule.shift_type_id] = (shiftTypeCounts[schedule.shift_type_id] || 0) + 1;
            }
        });

        // Count absences
        let absenceCount = 0;
        if (employeeAbsences && employeeAbsences[selectedEmployeeId]) {
            employeeAbsences[selectedEmployeeId].forEach(absence => {
                const start = new Date(absence.start_date);
                const end = new Date(absence.end_date);
                
                // Count days in the selected date range
                for (const day of days) {
                    if (day >= start && day <= end) {
                        absenceCount++;
                    }
                }
            });
        }

        return {
            totalSchedules,
            totalHours: Math.round(totalHours * 10) / 10, // Round to 1 decimal place
            shiftTypeCounts,
            absenceCount
        };
    };

    const statistics = getStatistics();

    return (
        <div className="py-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xl font-semibold">Mitarbeiteransicht</CardTitle>
                    
                    <Select
                        value={selectedEmployeeId?.toString() || ''}
                        onValueChange={(value) => setSelectedEmployeeId(parseInt(value))}
                    >
                        <SelectTrigger className="w-[260px]">
                            <SelectValue placeholder="Mitarbeiter auswählen" />
                        </SelectTrigger>
                        <SelectContent>
                            {employees.map(employee => (
                                <SelectItem key={employee.id} value={employee.id.toString()}>
                                    {employee.first_name} {employee.last_name} ({employee.employee_group})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardHeader>
                
                <CardContent className="pt-6">
                    {selectedEmployee && (
                        <>
                            <div className="flex flex-col md:flex-row gap-6 mb-6">
                                <div className="flex-1">
                                    <h3 className="text-lg font-medium mb-2">Mitarbeiterdetails</h3>
                                    <div className="space-y-2">
                                        <div className="grid grid-cols-2 gap-x-4 text-sm">
                                            <span className="text-muted-foreground">Name:</span>
                                            <span>{selectedEmployee.first_name} {selectedEmployee.last_name}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-4 text-sm">
                                            <span className="text-muted-foreground">Mitarbeiter-ID:</span>
                                            <span>{selectedEmployee.employee_id}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-4 text-sm">
                                            <span className="text-muted-foreground">Gruppe:</span>
                                            <span>{selectedEmployee.employee_group}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-4 text-sm">
                                            <span className="text-muted-foreground">Vertragsstunden:</span>
                                            <span>{selectedEmployee.contracted_hours} Std/Woche</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-4 text-sm">
                                            <span className="text-muted-foreground">Schlüsselträger:</span>
                                            <span>{selectedEmployee.is_keyholder ? 'Ja' : 'Nein'}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {statistics && (
                                    <div className="flex-1">
                                        <h3 className="text-lg font-medium mb-2">Statistik für ausgewählten Zeitraum</h3>
                                        <div className="space-y-2">
                                            <div className="grid grid-cols-2 gap-x-4 text-sm">
                                                <span className="text-muted-foreground">Gesamte Schichten:</span>
                                                <span>{statistics.totalSchedules}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-x-4 text-sm">
                                                <span className="text-muted-foreground">Gesamte Stunden:</span>
                                                <span>{statistics.totalHours} h</span>
                                            </div>
                                            {Object.entries(statistics.shiftTypeCounts).map(([shiftType, count]) => (
                                                <div key={shiftType} className="grid grid-cols-2 gap-x-4 text-sm">
                                                    <span className="text-muted-foreground flex items-center gap-2">
                                                        {getShiftTypeBadge(shiftType)}:
                                                    </span>
                                                    <span>{count}</span>
                                                </div>
                                            ))}
                                            <div className="grid grid-cols-2 gap-x-4 text-sm">
                                                <span className="text-muted-foreground">Abwesenheitstage:</span>
                                                <span>{statistics.absenceCount}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <h3 className="text-lg font-medium mt-6 mb-4">Einsatzplan</h3>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Datum</TableHead>
                                        <TableHead>Tag</TableHead>
                                        <TableHead>Schicht</TableHead>
                                        <TableHead>Uhrzeit</TableHead>
                                        <TableHead>Stunden</TableHead>
                                        <TableHead>Notizen</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {days.map((day) => {
                                        const dayStr = format(day, 'yyyy-MM-dd');
                                        const daySchedules = schedulesByDate[dayStr] || [];
                                        const daySchedule = daySchedules[0]; // Take first schedule of the day
                                        const absence = getAbsenceForDay(day);
                                        
                                        // Calculate hours if shift data exists
                                        let hours = null;
                                        if (daySchedule?.shift_start && daySchedule?.shift_end) {
                                            const [startHour, startMinute] = daySchedule.shift_start.split(':').map(Number);
                                            const [endHour, endMinute] = daySchedule.shift_end.split(':').map(Number);
                                            hours = (endHour - startHour) + (endMinute - startMinute) / 60;
                                        }
                                        
                                        return (
                                            <TableRow key={dayStr} className={cn(
                                                daySchedule ? "" : "opacity-70"
                                            )}>
                                                <TableCell>{format(day, 'dd.MM.yyyy')}</TableCell>
                                                <TableCell>{format(day, 'EEEE', { locale: de })}</TableCell>
                                                <TableCell>
                                                    {absence ? (
                                                        getAbsenceBadge(absence)
                                                    ) : daySchedule?.shift_type_id ? (
                                                        getShiftTypeBadge(daySchedule.shift_type_id)
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {absence ? (
                                                        <span className="text-muted-foreground">Abwesend</span>
                                                    ) : daySchedule?.shift_start && daySchedule?.shift_end ? (
                                                        `${daySchedule.shift_start} - ${daySchedule.shift_end}`
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {absence ? (
                                                        <span className="text-muted-foreground">-</span>
                                                    ) : hours !== null ? (
                                                        `${hours.toFixed(1)}`
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {daySchedule?.notes || (
                                                        absence?.reason ? (
                                                            <span className="text-muted-foreground italic">{absence.reason}</span>
                                                        ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                        )
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}; 