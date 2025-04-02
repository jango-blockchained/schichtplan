import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, addDays, startOfWeek, isWeekend, getDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { Schedule, Settings } from '@/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Info } from 'lucide-react';
import { getEmployees } from '@/services/api';
import { cn } from '@/lib/utils';
import {
  ScheduleTableWrapper,
  ShiftTypeBadge,
  TimeRangeDisplay,
  EmployeeCell
} from '../shared';

// Extended types to handle additional properties
interface ExtendedEmployee {
  id: number;
  first_name: string;
  last_name: string;
  position?: string;
  availability_type?: string;
  availability_color?: string;
  [key: string]: any;
}

interface ExtendedSchedule extends Schedule {
  is_keyholder?: boolean;
  [key: string]: any;
}

interface WeeklyScheduleViewProps {
  schedules: Schedule[];
  currentDate: Date;
  onChangeWeek: (date: Date) => void;
  employeeAbsences?: Record<number, any[]>;
  absenceTypes?: Array<{
    id: string;
    name: string;
    color: string;
    type: 'absence';
  }>;
  storeSettings?: Settings;
  isLoading?: boolean;
  showEmployeeAvailability?: boolean;
}

export const WeeklyScheduleView: React.FC<WeeklyScheduleViewProps> = ({
  schedules,
  currentDate,
  onChangeWeek,
  employeeAbsences,
  absenceTypes,
  storeSettings,
  isLoading = false,
  showEmployeeAvailability = true
}) => {
  // Fetch employees data
  const { data: employees, isLoading: isLoadingEmployees } = useQuery<ExtendedEmployee[]>({
    queryKey: ['employees'],
    queryFn: getEmployees
  });

  // Get current week dates
  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  // Previous and next week handlers
  const handlePreviousWeek = () => {
    onChangeWeek(addDays(weekStart, -7));
  };

  const handleNextWeek = () => {
    onChangeWeek(addDays(weekStart, 7));
  };

  // Check if a date is a store opening day
  const isOpeningDay = (date: Date): boolean => {
    if (!storeSettings?.opening_days) return true;
    const dayIndex = getDay(date).toString();
    return storeSettings.opening_days[dayIndex] === true;
  };

  // Filter the week dates to only show opening days
  const filteredWeekDates = useMemo(() => {
    return weekDates.filter(date => isOpeningDay(date));
  }, [weekDates, storeSettings]);

  // Group schedules by employee and day for efficient lookup
  const schedulesByEmployeeAndDay = useMemo(() => {
    const result: Record<string, ExtendedSchedule[]> = {};
    
    schedules.forEach(schedule => {
      if (!schedule.employee_id || !schedule.date) return;
      
      const key = `${schedule.employee_id}-${schedule.date.split('T')[0]}`;
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(schedule as ExtendedSchedule);
    });
    
    return result;
  }, [schedules]);

  // Get schedules for a specific employee and day
  const getSchedulesForEmployeeAndDay = (employeeId: number, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const key = `${employeeId}-${dateStr}`;
    return schedulesByEmployeeAndDay[key] || [];
  };

  // Get employee absence for a specific day
  const getEmployeeAbsence = (employeeId: number, date: Date) => {
    if (!employeeAbsences?.[employeeId]) return null;
    
    return employeeAbsences[employeeId].find(absence => {
      const absenceStart = new Date(absence.start_date);
      const absenceEnd = new Date(absence.end_date);
      return date >= absenceStart && date <= absenceEnd;
    });
  };

  // Create header content with week navigation controls
  const headerContent = (
    <div className="flex items-center space-x-2">
      <Button variant="outline" size="icon" onClick={handlePreviousWeek}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="flex items-center space-x-1">
        <CalendarIcon className="h-4 w-4" />
        <span>
          {format(weekStart, 'dd.MM.yyyy')} - {format(addDays(weekStart, 6), 'dd.MM.yyyy')}
        </span>
      </div>
      <Button variant="outline" size="icon" onClick={handleNextWeek}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );

  // Loading state
  if (isLoading || isLoadingEmployees) {
    return (
      <ScheduleTableWrapper
        title="Wochenplan"
        isLoading={true}
        headerContent={headerContent}
      >
        <div></div>
      </ScheduleTableWrapper>
    );
  }

  // No employees
  if (!employees || employees.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Keine Mitarbeiter gefunden.</AlertDescription>
      </Alert>
    );
  }

  // Check if we have filtered days
  const noOpeningDays = filteredWeekDates.length === 0;
  const displayDates = noOpeningDays ? weekDates : filteredWeekDates;

  // Sort employees by last name, first name
  const sortedEmployees = [...employees].sort((a, b) => {
    const nameA = `${a.last_name}, ${a.first_name}`;
    const nameB = `${b.last_name}, ${b.first_name}`;
    return nameA.localeCompare(nameB);
  });

  return (
    <ScheduleTableWrapper
      title="Wochenplan"
      headerContent={headerContent}
      footerContent={noOpeningDays ? (
        <Alert className="mx-6 mb-4 mt-2">
          <Info className="h-4 w-4" />
          <AlertDescription>
            In dieser Woche gibt es keine regulären Öffnungstage laut Filialeinstellungen. Alle Tage werden angezeigt.
          </AlertDescription>
        </Alert>
      ) : null}
    >
      <div className="rounded border mx-6 my-4 overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="min-w-[220px] sticky left-0 bg-background z-20">Mitarbeiter</TableHead>
              {displayDates.map((date) => (
                <TableHead
                  key={date.toISOString()}
                  className={cn(
                    "text-center min-w-[130px]",
                    isWeekend(date) ? "bg-muted/30" : "",
                    !isOpeningDay(date) ? "bg-muted/50" : ""
                  )}
                >
                  <div className="text-xs">{format(date, 'EEEE', { locale: de })}</div>
                  <div>{format(date, 'dd.MM')}</div>
                  {!isOpeningDay(date) && (
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
                    role={employee.position || ''}
                    availabilityType={showEmployeeAvailability ? employee.availability_type : undefined}
                    availabilityColor={showEmployeeAvailability ? employee.availability_color : undefined}
                  />
                </TableCell>
                {displayDates.map((date) => {
                  const schedules = getSchedulesForEmployeeAndDay(employee.id, date);
                  const absence = getEmployeeAbsence(employee.id, date);
                  
                  return (
                    <TableCell
                      key={date.toISOString()}
                      className={cn(
                        "p-1 py-2",
                        isWeekend(date) ? "bg-muted/30" : "",
                        !isOpeningDay(date) ? "bg-muted/50" : ""
                      )}
                    >
                      {absence && (
                        <div className="text-center text-xs mb-1">
                          <Badge
                            variant="outline"
                            style={{
                              backgroundColor: `${absenceTypes?.find(t => t.id === absence.absence_type)?.color || '#ff0000'}20`,
                              color: absenceTypes?.find(t => t.id === absence.absence_type)?.color || '#ff0000',
                              borderColor: absenceTypes?.find(t => t.id === absence.absence_type)?.color || '#ff0000'
                            }}
                          >
                            {absenceTypes?.find(t => t.id === absence.absence_type)?.name || 'Abwesend'}
                          </Badge>
                        </div>
                      )}
                      
                      {schedules.length === 0 ? (
                        <div className="text-center text-xs text-muted-foreground">-</div>
                      ) : (
                        <div className="space-y-2">
                          {schedules.map((schedule) => {
                            // Using type assertion to handle additional properties
                            const shiftType = schedule.shift_type_id || '';
                            const shiftName = '';
                            const isKeyHolder = schedule.is_keyholder || false;
                            
                            return (
                              <div key={schedule.id} className="border rounded p-1">
                                <div className="flex justify-center mb-1">
                                  <ShiftTypeBadge 
                                    type={shiftType}
                                    name={shiftName}
                                    size="sm"
                                  />
                                </div>
                                <div className="text-center text-xs">
                                  <TimeRangeDisplay
                                    startTime={schedule.shift_start || ''}
                                    endTime={schedule.shift_end || ''}
                                    shiftType={shiftType}
                                    showIcon={false}
                                  />
                                </div>
                                {isKeyHolder && (
                                  <div className="text-center text-xs text-muted-foreground mt-1">
                                    Schlüsselträger
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ScheduleTableWrapper>
  );
}; 