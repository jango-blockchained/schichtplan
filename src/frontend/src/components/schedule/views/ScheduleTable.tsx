import React, { useState, useMemo } from 'react';
import { Schedule, ScheduleUpdate, Settings } from '@/types';
import { DateRange } from 'react-day-picker';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { format, isSameDay, isWeekend } from 'date-fns';
import { de } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { getEmployees } from '@/services/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Info } from 'lucide-react';
import { 
  ScheduleTableWrapper, 
  EmployeeCell, 
  ScheduleShiftCell 
} from '../shared';

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
  storeSettings?: Settings;
}

export const ScheduleTable: React.FC<ScheduleTableProps> = ({
  schedules,
  dateRange,
  onDrop,
  onUpdate,
  isLoading,
  employeeAbsences,
  absenceTypes,
  storeSettings
}) => {
  const [activeTab, setActiveTab] = useState<'employees' | 'days'>('employees');
  
  // Fetch employees data
  const { data: employees, isLoading: isLoadingEmployees } = useQuery({
    queryKey: ['employees'],
    queryFn: getEmployees
  });

  // Process date range
  const days = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return [];
    
    const result = [];
    let currentDate = new Date(dateRange.from);
    const endDate = new Date(dateRange.to);
    
    while (currentDate <= endDate) {
      result.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return result;
  }, [dateRange]);

  // Filter days based on store opening days
  const isOpeningDay = (date: Date): boolean => {
    if (!storeSettings?.opening_days) return true;
    const dayIndex = date.getDay().toString();
    return storeSettings.opening_days[dayIndex] === true;
  };

  const filteredDays = useMemo(() => 
    days.filter(day => isOpeningDay(day)),
    [days, storeSettings]
  );
  
  const daysToShow = filteredDays.length > 0 ? filteredDays : days;
  
  // Group schedules by employee and day
  const schedulesByEmployee = useMemo(() => {
    const result: Record<number, Schedule[]> = {};
    
    schedules.forEach(schedule => {
      if (!schedule.employee_id) return;
      
      if (!result[schedule.employee_id]) {
        result[schedule.employee_id] = [];
      }
      result[schedule.employee_id].push(schedule);
    });
    
    return result;
  }, [schedules]);
  
  const schedulesByDay = useMemo(() => {
    const result: Record<string, Schedule[]> = {};
    
    schedules.forEach(schedule => {
      if (!schedule.date) return;
      
      const dateKey = schedule.date.split('T')[0]; // Format: YYYY-MM-DD
      if (!result[dateKey]) {
        result[dateKey] = [];
      }
      result[dateKey].push(schedule);
    });
    
    return result;
  }, [schedules]);
  
  // Get sorted employees list
  const sortedEmployees = useMemo(() => 
    employees 
      ? [...employees].sort((a, b) => {
          const nameA = `${a.last_name}, ${a.first_name}`;
          const nameB = `${b.last_name}, ${b.first_name}`;
          return nameA.localeCompare(nameB);
        })
      : [],
    [employees]
  );
  
  // Helper functions
  const getScheduleForEmployeeAndDay = (employeeId: number, day: Date) => {
    const employeeSchedules = schedulesByEmployee[employeeId] || [];
    return employeeSchedules.find(schedule => {
      if (!schedule.date) return false;
      const scheduleDate = new Date(schedule.date);
      return isSameDay(scheduleDate, day);
    });
  };
  
  const getSchedulesForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return schedulesByDay[dateStr] || [];
  };
  
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
  
  // Header content for table
  const headerContent = (
    <Select value={activeTab} onValueChange={(value) => setActiveTab(value as 'employees' | 'days')}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Ansicht wählen" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="employees">Nach Mitarbeiter</SelectItem>
        <SelectItem value="days">Nach Tag</SelectItem>
      </SelectContent>
    </Select>
  );
  
  if (isLoading || isLoadingEmployees) {
    return (
      <ScheduleTableWrapper
        title="Dienstplan-Tabelle"
        isLoading={true}
      />
    );
  }
  
  if (!dateRange?.from || !dateRange?.to) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Bitte wählen Sie einen Datumsbereich aus</AlertDescription>
      </Alert>
    );
  }
  
  // Check if we have any schedules
  const isEmpty = schedules.length === 0;
  
  return (
    <DndProvider backend={HTML5Backend}>
      <ScheduleTableWrapper
        title="Dienstplan-Tabelle"
        headerContent={headerContent}
        isEmpty={isEmpty}
        emptyMessage="Keine Schichten im ausgewählten Zeitraum gefunden"
      >
        {filteredDays.length === 0 && (
          <Alert className="mx-6 mt-4 mb-2">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Im ausgewählten Zeitraum gibt es keine regulären Öffnungstage. Alle Tage werden angezeigt.
            </AlertDescription>
          </Alert>
        )}
        
        {activeTab === "employees" && (
          <div className="rounded border mx-6 my-4 overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="min-w-[220px] sticky left-0 bg-background z-20">Mitarbeiter</TableHead>
                  {daysToShow.map((day) => (
                    <TableHead 
                      key={day.toISOString()} 
                      className={cn(
                        "text-center min-w-[130px]",
                        isWeekend(day) ? "bg-muted/30" : "",
                        !isOpeningDay(day) ? "bg-muted/50" : ""
                      )}
                    >
                      <div className="text-xs">{format(day, 'EEEE', { locale: de })}</div>
                      <div>{format(day, 'dd.MM')}</div>
                      {!isOpeningDay(day) && (
                        <div className="text-xs text-muted-foreground mt-0.5">Geschlossen</div>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="sticky left-0 bg-background z-10">
                      <EmployeeCell
                        firstName={employee.first_name}
                        lastName={employee.last_name}
                        id={employee.id}
                        role={employee.position}
                        availabilityType={employee.availability_type}
                        availabilityColor={employee.availability_color}
                      />
                    </TableCell>
                    {daysToShow.map((day) => {
                      const schedule = getScheduleForEmployeeAndDay(employee.id, day);
                      const absence = getEmployeeAbsence(employee.id, day);
                      
                      return (
                        <TableCell 
                          key={day.toISOString()} 
                          className={cn(
                            "p-2",
                            isWeekend(day) ? "bg-muted/30" : "",
                            !isOpeningDay(day) ? "bg-muted/50" : ""
                          )}
                        >
                          <ScheduleShiftCell
                            schedule={schedule}
                            hasAbsence={!!absence}
                            enableDragDrop={true}
                            onDrop={onDrop}
                            onUpdate={onUpdate}
                            onEdit={(schedule) => {
                              /* Add edit handler logic */
                            }}
                            onDelete={async (schedule) => {
                              await onUpdate(schedule.id, { shift_id: null });
                            }}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        
        {activeTab === "days" && (
          <div className="space-y-6 p-6">
            {daysToShow.map((day) => {
              const daySchedules = getSchedulesForDay(day);
              const isOpenDay = isOpeningDay(day);
              
              return (
                <div key={day.toISOString()} className="border rounded-md p-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                    <h3 className="text-lg font-semibold">
                      {format(day, 'EEEE, dd. MMMM yyyy', { locale: de })}
                    </h3>
                    {!isOpenDay && (
                      <div className="mt-2 sm:mt-0 text-sm text-muted-foreground">
                        Geschlossen laut Filialeinstellungen
                      </div>
                    )}
                  </div>
                  
                  {daySchedules.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      Keine Schichten für diesen Tag geplant
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mitarbeiter</TableHead>
                          <TableHead>Schicht</TableHead>
                          <TableHead>Uhrzeit</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {daySchedules.map((schedule) => {
                          const employee = employees?.find(emp => emp.id === schedule.employee_id);
                          const absence = getEmployeeAbsence(schedule.employee_id, day);
                          
                          return (
                            <TableRow key={schedule.id}>
                              <TableCell>
                                <EmployeeCell
                                  firstName={employee?.first_name}
                                  lastName={employee?.last_name}
                                  id={schedule.employee_id}
                                  isKeyHolder={schedule.is_keyholder}
                                  role={schedule.role}
                                  absence={absence ? {
                                    type: absence.absence_type,
                                    name: absenceTypes?.find(t => t.id === absence.absence_type)?.name || 'Abwesend',
                                    color: absenceTypes?.find(t => t.id === absence.absence_type)?.color || '#ff0000'
                                  } : null}
                                />
                              </TableCell>
                              <TableCell>
                                <ScheduleShiftCell
                                  schedule={schedule}
                                  hasAbsence={!!absence}
                                  enableDragDrop={false}
                                  showValidation={true}
                                  isEditMode={true}
                                  onUpdate={onUpdate}
                                />
                              </TableCell>
                              <TableCell>
                                {schedule.shift_start && schedule.shift_end ? 
                                  `${schedule.shift_start} - ${schedule.shift_end}` : 
                                  '-'}
                              </TableCell>
                              <TableCell>
                                {schedule.status === 'CONFIRMED' ? 'Bestätigt' :
                                 schedule.status === 'PENDING' ? 'Ausstehend' : 
                                 schedule.status === 'DECLINED' ? 'Abgelehnt' : 
                                 schedule.status || '-'}
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
        )}
      </ScheduleTableWrapper>
    </DndProvider>
  );
}; 