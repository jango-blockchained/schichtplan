import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { WeeklySchedule } from '@/services/api';
import { format, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle } from 'lucide-react';

interface ShiftTableProps {
  weekStart: Date;
  weekEnd: Date;
  isLoading?: boolean;
  error?: string | null;
  data: WeeklySchedule[];
  onShiftUpdate?: (employeeId: number, fromDay: number, toDay: number) => Promise<void>;
}

const SubRow = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col border-t border-border first:border-t-0">
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
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);
  return `${hours}:${minutes.toString().padStart(2, '0')}`;
};

const calculateShiftHours = (shift: { start?: string; end?: string; break?: { start: string; end: string } }): number => {
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
    totalHours -= breakDuration;
  }

  return totalHours;
};

const calculateDailyHours = (shift: { start?: string; end?: string; break?: { start: string; end: string } }): string => {
  return formatHours(calculateShiftHours(shift));
};

const calculateWeeklyHours = (shifts: Array<{ start?: string; end?: string; break?: { start: string; end: string } }>): string => {
  const totalHours = shifts.reduce((acc, shift) => acc + calculateShiftHours(shift), 0);
  return formatHours(totalHours);
};

const calculateMonthlyHours = (shifts: Array<{ start?: string; end?: string; break?: { start: string; end: string } }>): string => {
  // Calculate weekly hours and multiply by average weeks per month (4.33)
  const weeklyHours = shifts.reduce((acc, shift) => acc + calculateShiftHours(shift), 0);
  const monthlyHours = weeklyHours * 4.33;
  return formatHours(monthlyHours);
};

const ShiftCell = ({ shift, showValidation = true }: {
  shift: WeeklySchedule['shifts'][0] | undefined;
  showValidation?: boolean;
}) => {
  if (!shift) return null;

  const dailyHours = calculateDailyHours(shift);
  const hasBreakViolation = parseFloat(dailyHours) > 6 && !shift.break;
  const hasHoursViolation = parseFloat(dailyHours) > 10;

  return (
    <div className={cn(
      "p-2 rounded border border-border",
      hasBreakViolation || hasHoursViolation ? "border-destructive" : "hover:border-primary"
    )}>
      <SubRow>Beginn: {shift.start}</SubRow>
      {shift.break && (
        <>
          <SubRow>Pause: {shift.break.start}</SubRow>
          <SubRow>Ende: {shift.break.end}</SubRow>
        </>
      )}
      <SubRow>Ende: {shift.end}</SubRow>
      <SubRow className="flex justify-between items-center">
        <span>Summe / Tag: {dailyHours}</span>
        {showValidation && (hasBreakViolation || hasHoursViolation) && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <AlertCircle className="h-4 w-4 text-destructive" />
              </TooltipTrigger>
              <TooltipContent>
                {hasBreakViolation && <p>Pause erforderlich für Schichten > 6 Stunden</p>}
                {hasHoursViolation && <p>Maximale Arbeitszeit von 10 Stunden überschritten</p>}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </SubRow>
    </div>
  );
};

export const ShiftTable = ({ weekStart, weekEnd, isLoading, error, data, onShiftUpdate }: ShiftTableProps) => {
  const [localData, setLocalData] = useState(data);
  const dates = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i));

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
                <TableCell className="align-top">{employee.position}</TableCell>
                <TableCell className="align-top">{employee.contracted_hours}</TableCell>
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
                                    <ShiftCell shift={shift} />
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
                <TableCell className="align-top">{calculateWeeklyHours(employee.shifts)}</TableCell>
                <TableCell className="align-top">{calculateMonthlyHours(employee.shifts)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="p-4 space-y-2 text-sm text-muted-foreground">
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