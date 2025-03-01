import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { WeeklySchedule, WeeklyShift } from '@/types';
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
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + minutes / 60;
};

const formatHours = (totalHours: number): string => {
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);
  return `${hours}:${minutes.toString().padStart(2, '0')}`;
};

const calculateShiftHours = (shift: WeeklyShift): number => {
  if (!shift.start_time || !shift.end_time) return 0;

  let totalHours = parseTime(shift.end_time) - parseTime(shift.start_time);

  if (shift.break) {
    const breakHours = parseTime(shift.break.end) - parseTime(shift.break.start);
    totalHours -= breakHours;
  }

  return totalHours;
};

const calculateDailyHours = (shift: WeeklyShift): string => {
  return formatHours(calculateShiftHours(shift));
};

const calculateWeeklyHours = (shifts: WeeklyShift[]): string => {
  const totalHours = shifts.reduce((acc, shift) => acc + calculateShiftHours(shift), 0);
  return formatHours(totalHours);
};

const calculateMonthlyHours = (shifts: WeeklyShift[]): string => {
  const totalHours = shifts.reduce((acc, shift) => acc + calculateShiftHours(shift), 0);
  return formatHours(totalHours * 4); // Assuming 4 weeks per month
};

interface ShiftCellProps {
  shift: WeeklyShift | undefined;
  showValidation?: boolean;
  onBreakNotesUpdate?: (employeeId: number, day: number, notes: string) => Promise<void>;
  employeeId?: number;
}

const ShiftCell = ({ shift, showValidation = true, onBreakNotesUpdate, employeeId }: ShiftCellProps) => {
  const [notes, setNotes] = useState(shift?.break?.notes || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const shiftHours = shift ? calculateShiftHours(shift) : 0;
  const hasBreakViolation = shiftHours > 6 && !shift?.break;
  const hasLongBreakViolation = shiftHours > 9 && (!shift?.break?.notes?.includes('Second break:'));

  const handleNotesUpdate = async () => {
    if (!onBreakNotesUpdate || !employeeId || !shift?.day) {
      return;
    }

    setIsSaving(true);
    try {
      await onBreakNotesUpdate(employeeId, shift.day, notes);
      setIsEditing(false);
      toast({
        title: "Pausennotizen gespeichert",
        description: "Die Pausennotizen wurden erfolgreich aktualisiert.",
      });
    } catch (error) {
      toast({
        title: "Fehler beim Speichern",
        description: "Die Pausennotizen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setNotes(shift?.break?.notes || '');
    setIsEditing(false);
  };

  if (!shift) return <TableCell className="h-24 align-top" />;

  return (
    <TableCell className="h-24 align-top">
      <div className="space-y-1 text-sm">
        <SubRow>Beginn: {shift.start_time}</SubRow>
        {shift.break && (
          <>
            <SubRow>Pause: {shift.break.start}</SubRow>
            <SubRow>Ende: {shift.break.end}</SubRow>
          </>
        )}
        {showValidation && (hasBreakViolation || hasLongBreakViolation) && (
          <SubRow>
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {hasBreakViolation
                  ? "Pause erforderlich (>6h)"
                  : "Zweite Pause erforderlich (>9h)"}
              </AlertDescription>
            </Alert>
          </SubRow>
        )}
        <SubRow>
          <div className="flex items-center gap-2">
            <span className="font-medium">Notizen:</span>
            {!isEditing ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
          {isEditing ? (
            <div className="space-y-2 mt-1">
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Pausennotizen eingeben..."
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleNotesUpdate}
                  disabled={isSaving}
                >
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Speichern
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">
              {shift.break?.notes || 'Keine Pausennotizen'}
            </div>
          )}
        </SubRow>
        <SubRow>Ende: {shift.end_time}</SubRow>
        <SubRow>
          <Badge variant={hasBreakViolation || hasLongBreakViolation ? "destructive" : "secondary"}>
            {calculateDailyHours(shift)}h
          </Badge>
        </SubRow>
      </div>
    </TableCell>
  );
};

export const ShiftTable = ({ weekStart, weekEnd, isLoading, error, data, onShiftUpdate, onBreakNotesUpdate }: ShiftTableProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      setIsDragging(false);

      if (!result.destination || !onShiftUpdate) {
        return;
      }

      const [employeeId, fromDay] = result.draggableId.split('-').map(Number);
      const toDay = parseInt(result.destination.droppableId);

      if (fromDay === toDay) {
        return;
      }

      try {
        await onShiftUpdate(employeeId, fromDay, toDay);
      } catch (error) {
        console.error('Failed to update shift:', error);
      }
    },
    [onShiftUpdate]
  );

  if (isLoading) return <LoadingSkeleton />;

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="overflow-x-auto">
      <DragDropContext
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Mitarbeiter</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Std/W</TableHead>
              {Array.from({ length: 7 }).map((_, i) => {
                const date = addDays(weekStart, i);
                return (
                  <TableHead key={i}>
                    {format(date, 'EEE dd.MM', { locale: de })}
                  </TableHead>
                );
              })}
              <TableHead>Woche</TableHead>
              <TableHead>Monat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((employee, index) => (
              <TableRow key={employee.employee_id} className={cn(index % 2 === 0 ? 'bg-background' : 'bg-muted/50')}>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">{employee.name}</span>
                    {employee.position === 'Teamleiter' && (
                      <Badge variant="outline" className="w-fit">
                        TL
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{employee.position}</TableCell>
                <TableCell>{employee.contracted_hours}:00</TableCell>
                {Array.from({ length: 7 }).map((_, day) => {
                  const shift = employee.shifts.find(s => s.day === day);
                  return (
                    <Droppable key={day} droppableId={day.toString()}>
                      {(provided, snapshot) => (
                        <TableCell
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={cn(
                            'p-0 relative',
                            snapshot.isDraggingOver && 'bg-accent'
                          )}
                        >
                          {shift && (
                            <Draggable
                              draggableId={`${employee.employee_id}-${day}`}
                              index={0}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={cn(
                                    'p-4',
                                    snapshot.isDragging && 'bg-accent'
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
                          )}
                          {provided.placeholder}
                        </TableCell>
                      )}
                    </Droppable>
                  );
                })}
                <TableCell>
                  {calculateWeeklyHours(employee.shifts)}h
                </TableCell>
                <TableCell>
                  {calculateMonthlyHours(employee.shifts)}h
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DragDropContext>
    </Card>
  );
};