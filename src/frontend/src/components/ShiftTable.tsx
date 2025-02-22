import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { WeeklySchedule } from '@/types';
import { format, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, Edit2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

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

  if (!shift) return null;

  const dailyHours = calculateDailyHours(shift);
  const shiftHours = parseFloat(dailyHours.split(':')[0]) + parseFloat(dailyHours.split(':')[1]) / 60;

  // Enhanced validation checks
  const hasBreakViolation = shiftHours > 6 && !shift.break;
  const hasLongBreakViolation = shiftHours > 9 && (!shift.break?.notes?.includes('Second break:'));
  const hasHoursViolation = shiftHours > 10;

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