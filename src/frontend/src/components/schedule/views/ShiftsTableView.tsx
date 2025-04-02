import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { WeeklySchedule } from '@/types';
import { format, addDays, isWeekend, isValid, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { useState, useCallback, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, Edit2, Loader2, CalendarDays, Info, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useQuery } from '@tanstack/react-query';
import { getSettings } from '@/services/api';
import { Schedule, ScheduleUpdate, Settings } from '@/types';
import { DateRange } from 'react-day-picker';
import { getShifts, getEmployees } from '@/services/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
    Popover, 
    PopoverContent, 
    PopoverTrigger 
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Check, Clock, X } from 'lucide-react';

interface ShiftTableProps {
  weekStart: Date;
  weekEnd: Date;
  isLoading?: boolean;
  error?: string | null;
  data: WeeklySchedule[];
  onShiftUpdate?: (employeeId: number, fromDay: number, toDay: number) => Promise<void>;
  onBreakNotesUpdate?: (employeeId: number, day: number, notes: string) => Promise<void>;
}

interface SubRowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const SubRow = ({ children, className, ...props }: SubRowProps) => (
  <div className={cn("flex flex-col border-t border-border first:border-t-0", className)} {...props}>
    {children}
  </div>
);

const LoadingSkeleton = () => (
  <Card className="overflow-x-auto">
    <div className="p-4 space-y-4">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-12 w-[150px]" />
        <Skeleton className="h-12 w-20" />
        <Skeleton className="h-12 w-20" />
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-[100px]" />
        ))}
        <Skeleton className="h-12 w-20" />
        <Skeleton className="h-12 w-20" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4">
          <Skeleton className="h-20 w-[150px]" />
          <Skeleton className="h-20 w-20" />
          <Skeleton className="h-20 w-20" />
          {Array.from({ length: 7 }).map((_, j) => (
            <Skeleton key={j} className="h-20 w-[100px]" />
          ))}
          <Skeleton className="h-20 w-20" />
          <Skeleton className="h-20 w-20" />
        </div>
      ))}
    </div>
  </Card>
);

const parseTime = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + minutes / 60;
};

const formatHours = (totalHours: number): string => {
  // Round to nearest quarter hour (15 minutes)
  totalHours = Math.round(totalHours * 4) / 4;

  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);
  return `${hours}:${minutes.toString().padStart(2, '0')}`;
};

const calculateShiftHours = (shift: { start?: string; end?: string; break?: { start: string; end: string; notes?: string } }): number => {
  if (!shift.start || !shift.end) return 0;

  let totalHours = parseTime(shift.end) - parseTime(shift.start);

  // Handle shifts crossing midnight
  if (totalHours < 0) {
    totalHours += 24;
  }

  // Subtract break time if present
  if (shift.break) {
    let breakDuration = parseTime(shift.break.end) - parseTime(shift.break.start);
    if (breakDuration < 0) {
      breakDuration += 24;
    }

    // Handle second break from notes if present (for shifts > 9 hours)
    if (shift.break.notes?.includes('Second break:')) {
      const secondBreakMatch = shift.break.notes.match(/Second break: (\d{2}:\d{2})-(\d{2}:\d{2})/);
      if (secondBreakMatch) {
        const [_, secondBreakStart, secondBreakEnd] = secondBreakMatch;
        let secondBreakDuration = parseTime(secondBreakEnd) - parseTime(secondBreakStart);
        if (secondBreakDuration < 0) {
          secondBreakDuration += 24;
        }
        breakDuration += secondBreakDuration;
      }
    }

    totalHours -= breakDuration;
  }

  return totalHours;
};

const calculateDailyHours = (shift: { start?: string; end?: string; break?: { start: string; end: string; notes?: string } }): string => {
  return formatHours(calculateShiftHours(shift));
};

const calculateWeeklyHours = (shifts: Array<{ start?: string; end?: string; break?: { start: string; end: string; notes?: string } }>): string => {
  const totalHours = shifts.reduce((acc, shift) => acc + calculateShiftHours(shift), 0);
  return formatHours(totalHours);
};

const calculateMonthlyHours = (shifts: Array<{ start?: string; end?: string; break?: { start: string; end: string; notes?: string } }>): string => {
  // Calculate weekly hours and multiply by average weeks per month (4.33)
  // This provides a more accurate projection of monthly hours
  const weeklyHours = shifts.reduce((acc, shift) => acc + calculateShiftHours(shift), 0);
  const monthlyHours = weeklyHours * 4.33;
  return formatHours(monthlyHours);
};

const ShiftCell = ({ shift, showValidation = true, onBreakNotesUpdate, employeeId }: {
  shift: WeeklySchedule['shifts'][0] | undefined;
  showValidation?: boolean;
  onBreakNotesUpdate?: (employeeId: number, day: number, notes: string) => Promise<void>;
  employeeId?: number;
}) => {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notes, setNotes] = useState(shift?.break?.notes || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  // Fetch settings to get shift type details
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  if (!shift) return null;

  const dailyHours = calculateDailyHours(shift);
  const shiftHours = parseFloat(dailyHours.split(':')[0]) + parseFloat(dailyHours.split(':')[1]) / 60;

  // Enhanced validation checks
  const hasBreakViolation = shiftHours > 6 && !shift.break;
  const hasLongBreakViolation = shiftHours > 9 && (!shift.break?.notes?.includes('Second break:'));
  const hasHoursViolation = shiftHours > 10;

  // Determine shift type based on time
  const determineShiftType = () => {
    // If the shift has a shift_type_id, use that
    if (shift.shift_type_id) {
      return shift.shift_type_id;
    }

    // Otherwise guess based on start time
    const startHour = parseInt(shift.start?.split(':')[0] || '0');
    if (startHour < 11) return 'EARLY';
    if (startHour >= 16) return 'LATE';
    return 'MIDDLE';
  };

  const shiftTypeId = determineShiftType();

  // Find the shift type details in settings
  const shiftTypeInfo = settings?.shift_types?.find(type => type.id === shiftTypeId);

  // Get the color and name for the shift type
  const shiftTypeColor = shiftTypeInfo?.color || '#64748b'; // Default slate gray
  const shiftTypeName = shiftTypeInfo?.name || (
    shiftTypeId === 'EARLY' ? 'Frühschicht' :
      shiftTypeId === 'MIDDLE' ? 'Mittelschicht' :
        shiftTypeId === 'LATE' ? 'Spätschicht' : 'Schicht'
  );

  const handleNotesUpdate = async () => {
    if (!onBreakNotesUpdate || !employeeId || shift.day === undefined || !shift.break) {
      return;
    }

    try {
      setIsUpdating(true);
      await onBreakNotesUpdate(employeeId, shift.day, notes.trim());
      setIsEditingNotes(false);
      toast({
        description: "Pausennotizen wurden gespeichert.",
      });
    } catch (error) {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Fehler beim Speichern der Notizen",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setNotes(shift.break?.notes || '');
    setIsEditingNotes(false);
  };

  return (
    <div className={cn(
      "p-2 rounded border border-border",
      (hasBreakViolation || hasLongBreakViolation || hasHoursViolation) ? "border-destructive" : "hover:border-primary"
    )}>
      {/* Display shift type in badge with the correct color */}
      <div className="mb-2">
        <Badge
          variant="outline"
          style={{
            backgroundColor: `${shiftTypeColor}20`, // Add transparency
            color: shiftTypeColor,
            borderColor: shiftTypeColor
          }}
        >
          {shiftTypeName}
        </Badge>
      </div>
      <SubRow>Beginn: {shift.start}</SubRow>
      {shift.break && (
        <>
          <SubRow>Pause: {shift.break.start}</SubRow>
          <SubRow>Ende: {shift.break.end}</SubRow>
          <SubRow className="flex items-center gap-2">
            {isEditingNotes ? (
              <>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Pausennotizen..."
                  className="h-8 text-sm"
                  disabled={isUpdating}
                />
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleNotesUpdate}
                    className="h-8 px-2"
                    disabled={isUpdating}
                  >
                    {isUpdating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Speichern"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancel}
                    className="h-8 px-2"
                    disabled={isUpdating}
                  >
                    Abbrechen
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 w-full">
                <span className="text-sm text-muted-foreground flex-1">
                  {shift.break.notes || 'Keine Pausennotizen'}
                </span>
                {onBreakNotesUpdate && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditingNotes(true)}
                    className="h-6 w-6 p-0"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </SubRow>
        </>
      )}
      <SubRow>Ende: {shift.end}</SubRow>
      <SubRow className="flex justify-between items-center">
        <span>Summe / Tag: {dailyHours}</span>
        {showValidation && (hasBreakViolation || hasLongBreakViolation || hasHoursViolation) && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <AlertCircle className="h-4 w-4 text-destructive" />
              </TooltipTrigger>
              <TooltipContent>
                {hasBreakViolation && <p>Pause erforderlich für Schichten &gt; 6 Stunden</p>}
                {hasLongBreakViolation && <p>Zweite Pause erforderlich für Schichten &gt; 9 Stunden</p>}
                {hasHoursViolation && <p>Maximale Arbeitszeit von 10 Stunden überschritten</p>}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </SubRow>
    </div>
  );
};

export const ShiftTable = ({ weekStart, weekEnd, isLoading, error, data, onShiftUpdate, onBreakNotesUpdate }: ShiftTableProps) => {
  const [localData, setLocalData] = useState(data);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)); // Changed to 7 days to include Sunday

  const handleDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination || !onShiftUpdate) return;

    const { source, destination, draggableId } = result;
    const [employeeId, dayStr] = draggableId.split('-');
    const fromDay = parseInt(dayStr, 10);
    const toDay = parseInt(destination.droppableId.split('-')[1], 10);

    // Don't do anything if dropped in the same spot
    if (fromDay === toDay) return;

    try {
      // Update backend
      await onShiftUpdate(parseInt(employeeId, 10), fromDay, toDay);

      // Update local state
      setLocalData(prevData => {
        return prevData.map(employee => {
          if (employee.employee_id.toString() !== employeeId) return employee;

          const newShifts = [...employee.shifts];
          const shiftIndex = newShifts.findIndex(s => s.day === fromDay);
          if (shiftIndex === -1) return employee;

          const [shift] = newShifts.splice(shiftIndex, 1);
          shift.day = toDay;
          newShifts.push(shift);

          return {
            ...employee,
            shifts: newShifts,
          };
        });
      });
    } catch (error) {
      console.error('Failed to update shift:', error);
      // Reset to original data if update fails
      setLocalData(data);
    }
  }, [onShiftUpdate, data]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Card className="overflow-x-auto">
        <div className="p-4 border-b border-border">
          <h2 className="text-xl font-semibold">Mitarbeiter-Einsatz-Planung (MEP)</h2>
          <div className="text-sm text-muted-foreground mt-2">
            <span>Filiale: {/* Add filiale number */}</span>
            <span className="ml-4">Woche vom: {format(weekStart, 'dd.MM.yy')} bis: {format(weekEnd, 'dd.MM.yy')}</span>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell className="font-medium min-w-[150px]">Name, Vorname</TableCell>
              <TableCell className="font-medium w-20">Position</TableCell>
              <TableCell className="font-medium w-20">Plan / Woche</TableCell>
              {dates.map((date) => (
                <TableCell key={date.toISOString()} className="font-medium min-w-[100px]">
                  {format(date, 'EEEE\ndd.MM', { locale: de })}
                </TableCell>
              ))}
              <TableCell className="font-medium w-20">Summe / Woche</TableCell>
              <TableCell className="font-medium w-20">Summe / Monat</TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {localData.map((employee, index) => (
              <TableRow key={employee.employee_id} className={cn(index % 2 === 0 ? 'bg-background' : 'bg-muted/50')}>
                <TableCell className="align-top">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">{employee.name}</span>
                    {employee.position === 'Teamleiter' && (
                      <Badge variant="secondary" className="w-fit">TL</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="align-top text-center">
                  {employee.position}
                </TableCell>
                <TableCell className="align-top text-center">
                  {employee.contracted_hours}:00
                </TableCell>
                {dates.map((_, dayIndex) => (
                  <TableCell key={dayIndex} className="align-top p-0">
                    <Droppable droppableId={`drop-${dayIndex}`}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={cn(
                            "min-h-[120px] p-2",
                            snapshot.isDraggingOver && "bg-accent"
                          )}
                        >
                          {employee.shifts
                            .filter(s => s.day === dayIndex)
                            .map((shift, index) => (
                              <Draggable
                                key={`${employee.employee_id}-${shift.day}`}
                                draggableId={`${employee.employee_id}-${shift.day}`}
                                index={index}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={cn(
                                      "mb-2 last:mb-0",
                                      snapshot.isDragging && "opacity-50"
                                    )}
                                  >
                                    <ShiftCell
                                      shift={shift}
                                      employeeId={employee.employee_id}
                                      onBreakNotesUpdate={onBreakNotesUpdate}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </TableCell>
                ))}
                <TableCell className="align-top text-center">
                  {calculateWeeklyHours(employee.shifts)}
                </TableCell>
                <TableCell className="align-top text-center">
                  {calculateMonthlyHours(employee.shifts)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="p-4 space-y-2 text-sm text-muted-foreground border-t border-border">
          <p>h : 60 Minuten</p>
          <p>
            Anwesenheiten: Arbeitszeitbeginn bis Arbeitszeitende inkl. Pausenzeiten und die Tagesstunden eintragen.
            Am Ende der Woche: wöchentliche und monatliche Summe eintragen.
          </p>
          <p>
            Abwesenheiten: Feiertag, Krankheit (AU-Bescheinigung), Freizeit, Schule (Führungsnachweis), Urlaub
          </p>
        </div>
      </Card>
    </DragDropContext>
  );
};

interface ShiftsTableViewProps {
    schedules: Schedule[];
    dateRange: DateRange;
    onUpdate: (scheduleId: number, updates: any) => Promise<void>;
    isLoading: boolean;
    storeSettings?: Settings;
    employeeAbsences?: Record<number, any[]>;
    absenceTypes?: Array<{
        id: string;
        name: string;
        color: string;
        type: 'absence';
    }>;
}

export const ShiftsTableView = ({
    schedules,
    dateRange,
    onUpdate,
    isLoading,
    storeSettings,
    employeeAbsences,
    absenceTypes
}: ShiftsTableViewProps) => {
    // State for selected date
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(
        dateRange?.from ? new Date(dateRange.from) : undefined
    );

    // Fetch employees and shifts data
    const { data: employees, isLoading: isLoadingEmployees } = useQuery({
        queryKey: ['employees'],
        queryFn: getEmployees
    });

    const { data: shifts, isLoading: isLoadingShifts } = useQuery({
        queryKey: ['shifts'],
        queryFn: getShifts
    });

    // Check if a date is a store opening day
    const isOpeningDay = (date: Date): boolean => {
        if (!storeSettings?.opening_days || !isValid(date)) return true;
        const dayIndex = date.getDay().toString();
        return storeSettings.opening_days[dayIndex] === true;
    };

    // Filter dates based on opening days
    const dateDisabledFn = (date: Date) => {
        return !isOpeningDay(date);
    };

    // Create an array of dates from the range
    const datesInRange = useMemo(() => {
        if (!dateRange?.from || !dateRange?.to) return [];
        
        const dates: Date[] = [];
        let currentDate = new Date(dateRange.from);
        const endDate = new Date(dateRange.to);
        
        while (currentDate <= endDate) {
            dates.push(new Date(currentDate));
            currentDate = addDays(currentDate, 1);
        }
        
        return dates;
    }, [dateRange]);

    // Filter to only opening days
    const openingDaysInRange = useMemo(() => {
        return datesInRange.filter(date => isOpeningDay(date));
    }, [datesInRange]);

    // If no date is selected, select the first opening day in range
    useMemo(() => {
        if (!selectedDate && openingDaysInRange.length > 0) {
            setSelectedDate(openingDaysInRange[0]);
        }
    }, [selectedDate, openingDaysInRange]);

    // Get schedules for the selected day
    const selectedDateSchedules = useMemo(() => {
        if (!selectedDate) return [];
        
        return schedules.filter(schedule => {
            if (!schedule.date) return false;
            
            try {
                const scheduleDate = new Date(schedule.date);
                return isSameDay(scheduleDate, selectedDate);
            } catch (error) {
                console.error('Error parsing date:', error);
                return false;
            }
        });
    }, [schedules, selectedDate]);

    // Group schedules by shift
    const schedulesByShift = useMemo(() => {
        const result: Record<number, Schedule[]> = {};
        
        selectedDateSchedules.forEach(schedule => {
            if (!schedule.shift_id) return;
            
            if (!result[schedule.shift_id]) {
                result[schedule.shift_id] = [];
            }
            
            result[schedule.shift_id].push(schedule);
        });
        
        return result;
    }, [selectedDateSchedules]);

    // Get employee absence for a specific day
    const getEmployeeAbsence = (employeeId: number, date: Date) => {
        if (!employeeAbsences?.[employeeId]) return null;
        
        return employeeAbsences[employeeId].find(absence => {
            const absenceStart = new Date(absence.start_date);
            const absenceEnd = new Date(absence.end_date);
            return date >= absenceStart && date <= absenceEnd;
        });
    };

    // Render absence badge
    const renderAbsenceBadge = (absence: any) => {
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

    // Get shift details
    const getShiftDetails = (shiftId: number) => {
        if (!shifts) return null;
        return shifts.find(shift => shift.id === shiftId);
    };

    // Loading state
    if (isLoading || isLoadingEmployees || isLoadingShifts) {
        return <Skeleton className="w-full h-[600px]" />;
    }

    // No date range selected
    if (!dateRange?.from || !dateRange?.to) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Bitte wählen Sie einen Datumsbereich aus</AlertDescription>
            </Alert>
        );
    }

    // No schedules
    if (schedules.length === 0) {
        return (
            <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>Keine Schichten im ausgewählten Zeitraum gefunden</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="py-4">
            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle>Schichten</CardTitle>
                        <div className="flex items-center gap-4">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="justify-start text-left font-normal">
                                        <CalendarDays className="mr-2 h-4 w-4" />
                                        {selectedDate ? (
                                            format(selectedDate, 'EEEE, dd. MMMM yyyy', { locale: de })
                                        ) : (
                                            <span>Datum wählen</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={selectedDate}
                                        onSelect={setSelectedDate}
                                        disabled={dateDisabledFn}
                                        fromDate={dateRange.from}
                                        toDate={dateRange.to}
                                        modifiers={{
                                            weekend: (date) => isWeekend(date)
                                        }}
                                        modifiersClassNames={{
                                            weekend: 'bg-muted/50'
                                        }}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </CardHeader>

                {selectedDate && !isOpeningDay(selectedDate) && (
                    <div className="px-6 pt-1 pb-2">
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertDescription>
                                Der ausgewählte Tag ist kein regulärer Öffnungstag laut Filialeinstellungen.
                            </AlertDescription>
                        </Alert>
                    </div>
                )}

                <CardContent>
                    {selectedDateSchedules.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Keine Schichten für den {selectedDate && format(selectedDate, 'dd.MM.yyyy')} geplant
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {Object.entries(schedulesByShift).map(([shiftId, shiftSchedules]) => {
                                const shift = getShiftDetails(parseInt(shiftId));
                                const shiftTime = shift ? `${shift.start_time} - ${shift.end_time}` : 'Keine Zeitangabe';
                                
                                return (
                                    <div key={shiftId} className="border rounded-md p-4">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="text-lg font-semibold">
                                                    Schicht {shift?.name || `#${shiftId}`}
                                                </h3>
                                                <div className="flex items-center mt-1 text-sm text-muted-foreground">
                                                    <Clock className="mr-1 h-4 w-4" />
                                                    {shiftTime}
                                                </div>
                                            </div>
                                            <Badge>{shiftSchedules.length} Mitarbeiter</Badge>
                                        </div>
                                        
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Mitarbeiter</TableHead>
                                                    <TableHead>Rolle</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead className="text-right">Info</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {shiftSchedules.map((schedule) => {
                                                    const employee = employees?.find(emp => emp.id === schedule.employee_id);
                                                    const absence = selectedDate && 
                                                        getEmployeeAbsence(schedule.employee_id, selectedDate);
                                                    
                                                    return (
                                                        <TableRow 
                                                            key={schedule.id}
                                                            className={cn(
                                                                absence ? "bg-red-50" : "",
                                                                schedule.status === 'CONFIRMED' ? "bg-green-50/30" : "",
                                                                schedule.status === 'PENDING' ? "bg-blue-50/30" : "",
                                                                schedule.status === 'DECLINED' ? "bg-red-50/30" : ""
                                                            )}
                                                        >
                                                            <TableCell>
                                                                <div className="flex flex-col">
                                                                    <div className="font-medium flex items-center">
                                                                        <User className="h-4 w-4 mr-2 text-muted-foreground" />
                                                                        {employee ? 
                                                                            `${employee.first_name} ${employee.last_name}` : 
                                                                            `Mitarbeiter #${schedule.employee_id}`
                                                                        }
                                                                    </div>
                                                                    {absence && (
                                                                        <div className="mt-1">
                                                                            {renderAbsenceBadge(absence)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                {schedule.is_keyholder ? (
                                                                    <Badge variant="default">Schlüsselträger</Badge>
                                                                ) : schedule.role || '-'}
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center">
                                                                    {schedule.status === 'CONFIRMED' && (
                                                                        <Check className="h-4 w-4 mr-1 text-green-500" />
                                                                    )}
                                                                    {schedule.status === 'PENDING' && (
                                                                        <Clock className="h-4 w-4 mr-1 text-amber-500" />
                                                                    )}
                                                                    {schedule.status === 'DECLINED' && (
                                                                        <X className="h-4 w-4 mr-1 text-red-500" />
                                                                    )}
                                                                    <Badge 
                                                                        variant={
                                                                            schedule.status === 'CONFIRMED' ? 'default' :
                                                                            schedule.status === 'PENDING' ? 'secondary' : 
                                                                            'outline'
                                                                        }
                                                                    >
                                                                        {schedule.status === 'CONFIRMED' ? 'Bestätigt' :
                                                                         schedule.status === 'PENDING' ? 'Ausstehend' : 
                                                                         schedule.status === 'DECLINED' ? 'Abgelehnt' : 
                                                                         schedule.status || '-'}
                                                                    </Badge>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                {schedule.notes && (
                                                                    <Badge variant="outline" className="ml-2">
                                                                        Notiz
                                                                    </Badge>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};