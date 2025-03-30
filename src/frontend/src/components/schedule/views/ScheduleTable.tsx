import React, { useState } from 'react';
import { Schedule, ScheduleUpdate, Settings } from '@/types';
import { DateRange } from 'react-day-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isSameDay, format, addDays, isWeekend } from 'date-fns';
import { de } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { getEmployees } from '@/services/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Info } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ScheduleTableProps {
    schedules: Schedule[];
    dateRange: DateRange;
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
    storeSettings?: Settings; // Add store settings
}

export const ScheduleTable = ({
    schedules,
    dateRange,
    onDrop,
    onUpdate,
    isLoading,
    employeeAbsences,
    absenceTypes,
    storeSettings
}: ScheduleTableProps) => {
    const [activeTab, setActiveTab] = useState<'employees' | 'days'>('employees');
    
    // Fetch employees data
    const { data: employees, isLoading: isLoadingEmployees } = useQuery({
        queryKey: ['employees'],
        queryFn: getEmployees
    });

    if (isLoading || isLoadingEmployees) {
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

    // Generate days within the date range
    const getDaysInRange = () => {
        const days = [];
        let currentDate = new Date(dateRange.from);
        const endDate = new Date(dateRange.to);
        
        while (currentDate <= endDate) {
            days.push(new Date(currentDate));
            currentDate = addDays(currentDate, 1);
        }
        
        return days;
    };

    const days = getDaysInRange();

    // Filter days based on store opening days
    const isOpeningDay = (date: Date): boolean => {
        if (!storeSettings?.opening_days) return true;
        const dayIndex = date.getDay().toString();
        return storeSettings.opening_days[dayIndex] === true;
    };

    const filteredDays = days.filter(day => isOpeningDay(day));
    const daysToShow = filteredDays.length > 0 ? filteredDays : days;

    // Group schedules by employee
    const schedulesByEmployee: Record<number, Schedule[]> = {};
    schedules.forEach(schedule => {
        if (!schedule.employee_id) return;
        
        if (!schedulesByEmployee[schedule.employee_id]) {
            schedulesByEmployee[schedule.employee_id] = [];
        }
        schedulesByEmployee[schedule.employee_id].push(schedule);
    });

    // Group schedules by day
    const schedulesByDay: Record<string, Schedule[]> = {};
    schedules.forEach(schedule => {
        if (!schedule.date) return;
        
        const dateKey = schedule.date.split('T')[0]; // Format: YYYY-MM-DD
        if (!schedulesByDay[dateKey]) {
            schedulesByDay[dateKey] = [];
        }
        schedulesByDay[dateKey].push(schedule);
    });

    // Sort employees by name
    const sortedEmployees = employees 
        ? [...employees].sort((a, b) => {
            const nameA = `${a.last_name}, ${a.first_name}`;
            const nameB = `${b.last_name}, ${b.first_name}`;
            return nameA.localeCompare(nameB);
        })
        : [];

    // Get schedule for a specific employee and day
    const getScheduleForEmployeeAndDay = (employeeId: number, day: Date) => {
        const employeeSchedules = schedulesByEmployee[employeeId] || [];
        return employeeSchedules.find(schedule => {
            if (!schedule.date) return false;
            const scheduleDate = new Date(schedule.date);
            return isSameDay(scheduleDate, day);
        });
    };

    // Get all schedules for a specific day
    const getSchedulesForDay = (day: Date) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        return schedulesByDay[dateStr] || [];
    };

    // Get absence for an employee on a specific day
    const getEmployeeAbsence = (employeeId: number, day: Date) => {
        if (!employeeAbsences?.[employeeId]) return null;
        
        const dayFormatted = format(day, 'yyyy-MM-dd');
        return employeeAbsences[employeeId].find(absence => {
            const absenceStart = new Date(absence.start_date);
            const absenceEnd = new Date(absence.end_date);
            const dayDate = new Date(dayFormatted);
            
            return dayDate >= absenceStart && dayDate <= absenceEnd;
        });
    };

    // Function to get absence badge
    const getAbsenceBadge = (absence: any) => {
        if (!absence || !absenceTypes) return null;
        
        const absenceType = absenceTypes.find(type => type.id === absence.absence_type);
        const style = absenceType ? 
            { backgroundColor: `${absenceType.color}20`, color: absenceType.color, borderColor: absenceType.color } :
            { backgroundColor: '#ff000020', color: '#ff0000', borderColor: '#ff0000' };
            
        return (
            <Badge variant="outline" style={style} className="text-xs">
                {absenceType?.name || 'Abwesend'}
            </Badge>
        );
    };

    // Render cell content for a schedule
    const renderScheduleCell = (schedule: Schedule | undefined, absence: any) => {
        if (!schedule) {
            if (absence) {
                return (
                    <div className="flex justify-center items-center h-full bg-red-50 rounded p-1">
                        {getAbsenceBadge(absence)}
                    </div>
                );
            }
            return <div className="text-center text-muted-foreground">-</div>;
        }

        return (
            <div className={cn(
                "p-1 rounded text-sm",
                schedule.status === 'CONFIRMED' ? "bg-green-50" : "",
                schedule.status === 'PENDING' ? "bg-blue-50" : "",
                schedule.status === 'DECLINED' ? "bg-red-50" : "",
                absence ? "bg-red-50" : ""
            )}>
                <div className="font-medium">
                    {schedule.shift_start && schedule.shift_end ? 
                        `${schedule.shift_start} - ${schedule.shift_end}` : 
                        'Zeit nicht festgelegt'}
                </div>
                {schedule.is_keyholder && (
                    <Badge variant="secondary" className="text-xs">Schlüsselträger</Badge>
                )}
                {absence && getAbsenceBadge(absence)}
            </div>
        );
    };

    return (
        <div className="py-4">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Dienstplan-Tabelle</CardTitle>
                        
                        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'employees' | 'days')}>
                            <TabsList>
                                <TabsTrigger value="employees">Nach Mitarbeiter</TabsTrigger>
                                <TabsTrigger value="days">Nach Tag</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </CardHeader>
                
                <CardContent>
                    {filteredDays.length === 0 && (
                        <Alert className="mb-4">
                            <Info className="h-4 w-4" />
                            <AlertDescription>
                                Im ausgewählten Zeitraum gibt es keine regulären Öffnungstage. Alle Tage werden angezeigt.
                            </AlertDescription>
                        </Alert>
                    )}
                    
                    <TabsContent value="employees" className="mt-0">
                        <div className="rounded border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="min-w-[200px]">Mitarbeiter</TableHead>
                                        {daysToShow.map((day) => (
                                            <TableHead 
                                                key={day.toISOString()} 
                                                className={cn(
                                                    "text-center min-w-[120px]",
                                                    isWeekend(day) ? "bg-muted/30" : "",
                                                    !isOpeningDay(day) ? "bg-muted/50" : ""
                                                )}
                                            >
                                                <div className="text-xs">{format(day, 'EEEE', { locale: de })}</div>
                                                <div>{format(day, 'dd.MM')}</div>
                                                {!isOpeningDay(day) && (
                                                    <Badge variant="outline" className="text-xs bg-muted/30">Geschl.</Badge>
                                                )}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedEmployees.map((employee) => (
                                        <TableRow key={employee.id}>
                                            <TableCell className="font-medium">
                                                {employee.first_name} {employee.last_name}
                                            </TableCell>
                                            {daysToShow.map((day) => {
                                                const schedule = getScheduleForEmployeeAndDay(employee.id, day);
                                                const absence = getEmployeeAbsence(employee.id, day);
                                                
                                                return (
                                                    <TableCell 
                                                        key={day.toISOString()} 
                                                        className={cn(
                                                            isWeekend(day) ? "bg-muted/30" : "",
                                                            !isOpeningDay(day) ? "bg-muted/50" : ""
                                                        )}
                                                    >
                                                        {renderScheduleCell(schedule, absence)}
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                    
                    <TabsContent value="days" className="mt-0">
                        <div className="space-y-6">
                            {daysToShow.map((day) => {
                                const daySchedules = getSchedulesForDay(day);
                                const isOpenDay = isOpeningDay(day);
                                
                                return (
                                    <div key={day.toISOString()} className="border rounded-md p-4">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                                            <h3 className="text-lg font-semibold">
                                                {format(day, 'EEEE, dd. MMMM yyyy', { locale: de })}
                                            </h3>
                                            <div className="flex gap-2 mt-2 sm:mt-0">
                                                {!isOpenDay && (
                                                    <Badge variant="outline" className="bg-muted/20">Geschlossen</Badge>
                                                )}
                                                <Badge>{daySchedules.length} Schichten</Badge>
                                            </div>
                                        </div>
                                        
                                        {daySchedules.length === 0 ? (
                                            <div className="text-center py-4 text-muted-foreground">
                                                Keine Schichten für diesen Tag geplant
                                            </div>
                                        ) : (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Mitarbeiter</TableHead>
                                                        <TableHead>Schicht</TableHead>
                                                        <TableHead>Uhrzeit</TableHead>
                                                        <TableHead>Rolle</TableHead>
                                                        <TableHead className="text-right">Status</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {daySchedules.map((schedule) => {
                                                        const employee = employees?.find(emp => emp.id === schedule.employee_id);
                                                        const absence = getEmployeeAbsence(schedule.employee_id, day);
                                                        
                                                        return (
                                                            <TableRow 
                                                                key={schedule.id}
                                                                className={cn(
                                                                    absence ? "bg-red-50" : "",
                                                                    schedule.status === 'CONFIRMED' ? "bg-green-50" : ""
                                                                )}
                                                            >
                                                                <TableCell className="font-medium">
                                                                    <div className="flex flex-col">
                                                                        <span>{employee ? `${employee.first_name} ${employee.last_name}` : `Mitarbeiter #${schedule.employee_id}`}</span>
                                                                        {absence && getAbsenceBadge(absence)}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>{schedule.shift_id ? `Schicht #${schedule.shift_id}` : '-'}</TableCell>
                                                                <TableCell>
                                                                    {schedule.shift_start && schedule.shift_end ? 
                                                                        `${schedule.shift_start} - ${schedule.shift_end}` : 
                                                                        '-'}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {schedule.is_keyholder ? (
                                                                        <Badge variant="default">Schlüsselträger</Badge>
                                                                    ) : schedule.role || '-'}
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <Badge 
                                                                        variant={
                                                                            schedule.status === 'CONFIRMED' ? 'default' :
                                                                            schedule.status === 'PENDING' ? 'secondary' : 'outline'
                                                                        }
                                                                    >
                                                                        {schedule.status === 'CONFIRMED' ? 'Bestätigt' :
                                                                         schedule.status === 'PENDING' ? 'Ausstehend' : 
                                                                         schedule.status === 'DECLINED' ? 'Abgelehnt' : 
                                                                         schedule.status || 'Unbekannt'}
                                                                    </Badge>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </TabsContent>
                </CardContent>
            </Card>
        </div>
    );
}; 