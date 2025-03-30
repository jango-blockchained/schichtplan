import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { WeeklySchedule, WeeklyShift } from '@/types';
import { format, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { useState, useCallback, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, Edit2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useQuery } from '@tanstack/react-query';
import { getSettings } from '@/services/api';

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
  <div className={cn("text-xs text-muted-foreground", className)} {...props}>
    {children}
  </div>
);

const LoadingSkeleton = () => (
  <Card className="shadow-none p-0">
    <div className="overflow-auto max-h-96">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-44">
              <Skeleton className="h-5 w-full" />
            </TableHead>
            <TableHead className="w-28">
              <Skeleton className="h-5 w-full" />
            </TableHead>
            <TableHead className="w-16">
              <Skeleton className="h-5 w-full" />
            </TableHead>
            {Array.from({ length: 7 }).map((_, i) => (
              <TableHead key={i}>
                <Skeleton className="h-5 w-full" />
              </TableHead>
            ))}
            <TableHead>
              <Skeleton className="h-5 w-full" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-5 w-full" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-5 w-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-full" />
              </TableCell>
              {Array.from({ length: 7 }).map((_, j) => (
                <TableCell key={j}>
                  <Skeleton className="h-20 w-full" />
                </TableCell>
              ))}
              <TableCell>
                <Skeleton className="h-5 w-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-full" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </Card>
);

const parseTime = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

const formatHours = (totalHours: number): string => {
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);
  return minutes > 0 ? `${hours}.${minutes}` : `${hours}`;
};

const calculateShiftHours = (shift: WeeklyShift): number => {
  if (!shift.start_time || !shift.end_time) return 0;
  
  const startMinutes = parseTime(shift.start_time);
  const endMinutes = parseTime(shift.end_time);
  
  // Break calculation
  let breakDuration = 0;
  if (shift.break?.start && shift.break?.end) {
    const breakStartMinutes = parseTime(shift.break.start);
    const breakEndMinutes = parseTime(shift.break.end);
    breakDuration = breakEndMinutes - breakStartMinutes;
  }
  
  return (endMinutes - startMinutes - breakDuration) / 60;
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
  return formatHours(totalHours * 4.33); // Approximate weeks in a month
};

interface ShiftCellProps {
  shift: WeeklyShift | undefined;
  showValidation?: boolean;
  onBreakNotesUpdate?: (employeeId: number, day: number, notes: string) => Promise<void>;
  employeeId?: number;
}

const ShiftCell = ({ shift, showValidation = true, onBreakNotesUpdate, employeeId }: ShiftCellProps) => {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [breakNotes, setBreakNotes] = useState(shift?.break?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  const handleNotesUpdate = async () => {
    if (!onBreakNotesUpdate || !employeeId || !shift?.day) return;
    
    try {
      setIsSubmitting(true);
      await onBreakNotesUpdate(employeeId, shift.day, breakNotes);
      setIsEditingNotes(false);
      toast({
        title: "Success",
        description: "Break notes updated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update break notes",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleCancel = () => {
    setBreakNotes(shift?.break?.notes || '');
    setIsEditingNotes(false);
  };
  
  if (!shift) return null;
  
  return (
    <div className="h-full w-full space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">{shift.start_time} - {shift.end_time}</span>
        {shift.break && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={() => setIsEditingNotes(true)}
                  className="text-xs text-primary hover:text-primary/80"
                >
                  <Edit2 size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Edit break notes</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      {shift.shift_type_id && (
        <Badge variant="outline" className="text-xs font-normal py-0 h-5">
          {shift.shift_type_id}
        </Badge>
      )}
      
      {shift.break && (
        <SubRow>
          Break: {shift.break.start} - {shift.break.end}
        </SubRow>
      )}
      
      {shift.break?.notes && !isEditingNotes && (
        <SubRow>{shift.break.notes}</SubRow>
      )}
      
      {isEditingNotes && (
        <div className="space-y-1.5 pt-1">
          <Input
            value={breakNotes}
            onChange={(e) => setBreakNotes(e.target.value)}
            placeholder="Break notes..."
            size={3}
            className="text-xs h-6 py-1 px-2"
          />
          <div className="flex gap-1 justify-end">
            <Button 
              variant="outline" 
              size="sm"
              className="h-6 text-xs py-0 px-2"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button 
              variant="default" 
              size="sm"
              className="h-6 text-xs py-0 px-2"
              onClick={handleNotesUpdate}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </div>
      )}
      
      <SubRow>Total: {calculateDailyHours(shift)}h</SubRow>
    </div>
  );
};

export const ShiftTable = ({ weekStart, weekEnd, isLoading, error, data, onShiftUpdate, onBreakNotesUpdate }: ShiftTableProps) => {
  const { toast } = useToast();
  
  // Fetch settings to determine opening days
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings
  });
  
  // Generate days for the week, filtered by opening days
  const days = useMemo(() => {
    if (!settings) return Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
    
    const filteredDays = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      const dayIndex = day.getDay().toString(); // 0 = Sunday, 1 = Monday, etc.
      
      // Only include days marked as opening days in settings
      if (settings.general?.opening_days?.[dayIndex]) {
        filteredDays.push(day);
      }
    }
    
    return filteredDays;
  }, [weekStart, settings]);
  
  const onDragEnd = useCallback((result: DropResult) => {
    if (!result.destination || !onShiftUpdate) {
      return;
    }
    
    const employeeId = parseInt(result.draggableId.split('-')[0]);
    const fromDay = parseInt(result.draggableId.split('-')[1]);
    const toDay = parseInt(result.destination.droppableId);
    
    if (fromDay === toDay) {
      return;
    }
    
    onShiftUpdate(employeeId, fromDay, toDay)
      .then(() => {
        toast({
          title: "Success",
          description: "Shift updated successfully",
        });
      })
      .catch(() => {
        toast({
          title: "Error",
          description: "Failed to update shift",
          variant: "destructive",
        });
      });
  }, [onShiftUpdate, toast]);
  
  if (isLoading || isLoadingSettings) {
    return <LoadingSkeleton />;
  }
  
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  
  return (
    <Card className="shadow-none p-0">
      <DragDropContext onDragEnd={onDragEnd}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">Employee</TableHead>
              <TableHead className="w-28">Position</TableHead>
              <TableHead className="w-16">Contracted</TableHead>
              {days.map((day) => (
                <TableHead key={day.toString()}>
                  {format(day, 'EEE, dd.MM', { locale: de })}
                </TableHead>
              ))}
              <TableHead>Weekly</TableHead>
              <TableHead>Monthly</TableHead>
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
                {days.map((day, dayIndex) => {
                  // Map the actual day of week (0-6) to the shift day value
                  const dayOfWeek = day.getDay(); // 0 = Sunday, 1 = Monday, etc
                  // Convert to our internal day numbering if needed
                  const shift = employee.shifts.find(s => s.day === dayOfWeek);
                  
                  return (
                    <Droppable key={dayOfWeek} droppableId={dayOfWeek.toString()}>
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
                              draggableId={`${employee.employee_id}-${dayOfWeek}`}
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