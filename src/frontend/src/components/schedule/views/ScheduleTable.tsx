import { Schedule, ScheduleUpdate } from '@/types';
import { DateRange } from 'react-day-picker';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, addDays, getDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSettings, getEmployees } from '@/services/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ScheduleTableProps {
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

export const ScheduleTable = ({
    schedules,
    dateRange,
    onDrop,
    onUpdate,
    isLoading,
    employeeAbsences,
    absenceTypes
}: ScheduleTableProps) => {
    const [employeeData, setEmployeeData] = useState<any[]>([]);
    const [groupedSchedules, setGroupedSchedules] = useState<Record<number, Schedule[]>>({});

    // Fetch employees
    const { data: employees, isLoading: isLoadingEmployees } = useQuery({
        queryKey: ['employees'],
        queryFn: getEmployees
    });

    // Group schedules by employee_id
    useEffect(() => {
        if (schedules.length > 0) {
            const grouped: Record<number, Schedule[]> = {};
            
            schedules.forEach(schedule => {
                if (!grouped[schedule.employee_id]) {
                    grouped[schedule.employee_id] = [];
                }
                grouped[schedule.employee_id].push(schedule);
            });
            
            setGroupedSchedules(grouped);
        }
    }, [schedules]);

    // Process employee data once loaded
    useEffect(() => {
        if (employees) {
            setEmployeeData(employees);
        }
    }, [employees]);

    if (isLoading || isLoadingEmployees) {
        return <Skeleton className="w-full h-[400px]" />;
    }

    if (!dateRange?.from || !dateRange?.to) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Bitte wählen Sie einen Datumsbereich aus</AlertDescription>
            </Alert>
        );
    }

    if (schedules.length === 0) {
        return (
            <Alert className="my-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Keine Dienstpläne gefunden</AlertDescription>
            </Alert>
        );
    }

    // Generate days array for the selected date range
    const days: Date[] = [];
    let currentDate = new Date(dateRange.from);
    const endDate = new Date(dateRange.to);
    
    while (currentDate <= endDate) {
        days.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Get day name in German
    const getDayName = (date: Date) => {
        return format(date, 'EEEE', { locale: de });
    };

    // Get shift display for a specific employee and day
    const getShiftForDay = (employeeId: number, day: Date) => {
        if (!groupedSchedules[employeeId]) return null;
        if (!day) return null;
        
        try {
            const dayFormatted = format(day, 'yyyy-MM-dd');
            
            const schedule = groupedSchedules[employeeId].find(s => {
                if (!s || !s.date) return false;
                try {
                    return format(new Date(s.date), 'yyyy-MM-dd') === dayFormatted;
                } catch (error) {
                    console.error('Error comparing dates:', error, { date: s.date });
                    return false;
                }
            });
            
            if (!schedule || !schedule.shift_id) return null;
            
            return schedule;
        } catch (error) {
            console.error('Error in getShiftForDay:', error);
            return null;
        }
    };

    // Check if employee is absent on a specific day
    const isEmployeeAbsent = (employeeId: number, day: Date): { isAbsent: boolean; absence?: any } => {
        if (!employeeAbsences || !employeeAbsences[employeeId] || !day) {
            return { isAbsent: false };
        }

        const dayFormatted = format(day, 'yyyy-MM-dd');
        const absence = employeeAbsences[employeeId].find(absence => {
            const absenceStart = new Date(absence.start_date);
            const absenceEnd = new Date(absence.end_date);
            const dayDate = new Date(dayFormatted);
            
            return dayDate >= absenceStart && dayDate <= absenceEnd;
        });

        return {
            isAbsent: !!absence,
            absence
        };
    };

    // Get absence badge
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

    // Get shift type label
    const getShiftTypeLabel = (shiftTypeId: string | undefined) => {
        if (!shiftTypeId) return '';
        
        switch(shiftTypeId) {
            case 'EARLY': return 'Früh';
            case 'MIDDLE': return 'Mittel';
            case 'LATE': return 'Spät';
            case 'NON_WORKING': return '---';
            case 'OFF': return 'Frei';
            default: return shiftTypeId;
        }
    };

    return (
        <Card>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[200px]">Mitarbeiter</TableHead>
                        {days.map((day, index) => (
                            <TableHead key={index} className="text-center">
                                <div className="flex flex-col items-center">
                                    <span>{format(day, 'dd.MM')}</span>
                                    <span className="text-xs text-muted-foreground">{getDayName(day)}</span>
                                </div>
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {employeeData.map((employee) => (
                        <TableRow key={employee.id}>
                            <TableCell>
                                <div className="font-medium">
                                    {employee.first_name} {employee.last_name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {employee.employee_id && <span className="font-mono">{employee.employee_id}</span>}
                                    {employee.employee_group && 
                                        <span className="ml-2">({employee.employee_group})</span>
                                    }
                                </div>
                            </TableCell>
                            {days.map((day, index) => {
                                if (!day) {
                                    return (
                                        <TableCell key={index} className="text-center">
                                            <span className="text-muted-foreground">-</span>
                                        </TableCell>
                                    );
                                }
                                
                                const { isAbsent, absence } = isEmployeeAbsent(employee.id, day);
                                const shift = !isAbsent ? getShiftForDay(employee.id, day) : null;
                                
                                return (
                                    <TableCell key={index} className="text-center">
                                        {isAbsent ? (
                                            getAbsenceBadge(absence)
                                        ) : shift ? (
                                            <Badge variant={
                                                shift.shift_type_id === 'EARLY' ? 'default' :
                                                shift.shift_type_id === 'MIDDLE' ? 'secondary' :
                                                shift.shift_type_id === 'LATE' ? 'outline' : 
                                                shift.shift_type_id === 'NON_WORKING' ? 'outline' :
                                                'default'
                                            } className={shift.shift_type_id === 'NON_WORKING' ? 'bg-slate-100 text-slate-400 border-slate-200' : ''}>
                                                {getShiftTypeLabel(shift.shift_type_id)}
                                            </Badge>
                                        ) : (
                                            <div className="h-6 flex items-center justify-center">
                                                <span className="text-muted-foreground">-</span>
                                            </div>
                                        )}
                                    </TableCell>
                                );
                            })}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Card>
    );
}; 