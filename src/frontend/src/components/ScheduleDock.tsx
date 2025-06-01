import React, { useState, useMemo } from "react";
import { useDrag } from "react-dnd";
import { format } from "date-fns";
import { 
  ChevronUp, 
  ChevronDown, 
  Users, 
  Clock, 
  GripVertical,
  X 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Employee, Shift, ShiftType } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { getEmployees, getShifts } from "@/services/api";

interface ScheduleDockProps {
  currentVersion?: number;
  selectedDate?: Date;
  onClose?: () => void;
  onDrop?: (employeeId: number, date: Date, shiftId: number) => Promise<void>;
}

interface DragItem {
  type: "SCHEDULE";
  scheduleId?: number;
  employeeId: number;
  shiftId: number | null;
  date: string;
  shift_type_id?: string;
  isDockItem?: boolean; // Flag to indicate this is from the dock
}

interface DraggableEmployeeProps {
  employee: Employee;
  selectedDate?: Date;
  currentVersion?: number;
}

interface DraggableShiftProps {
  shift: Shift;
  selectedDate?: Date;
  currentVersion?: number;
}

const DraggableEmployee: React.FC<DraggableEmployeeProps> = ({ 
  employee, 
  selectedDate,
  currentVersion 
}) => {
  const [{ isDragging }, drag] = useDrag({
    type: "SCHEDULE",
    item: (): DragItem => ({
      type: "SCHEDULE",
      employeeId: employee.id,
      shiftId: null, // Will be assigned when dropped
      date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      isDockItem: true, // Flag to indicate this is from the dock
    }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const getEmployeeGroupColor = (group: string) => {
    switch (group) {
      case "VZ": return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "TZ": return "bg-green-500/20 text-green-300 border-green-500/30";
      case "GFB": return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case "TL": return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      default: return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    }
  };

  return (
    <div
      ref={drag}
      className={cn(
        "flex flex-col items-center p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-all cursor-move min-w-[120px] select-none",
        isDragging && "opacity-50 scale-95 shadow-lg",
        !isDragging && "hover:shadow-md hover:scale-105"
      )}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground mb-1" />
      <div className="text-sm font-medium text-center mb-2">
        {employee.first_name} {employee.last_name}
      </div>
      <div className="flex flex-col gap-1 items-center">
        <Badge
          variant="secondary"
          className={cn("text-xs", getEmployeeGroupColor(employee.employee_group))}
        >
          {employee.employee_group}
        </Badge>
        {employee.is_keyholder && (
          <Badge variant="outline" className="text-xs">
            🔑 Keyholder
          </Badge>
        )}
        <div className="text-xs text-muted-foreground">
          {employee.contracted_hours}h/week
        </div>
      </div>
    </div>
  );
};

const DraggableShift: React.FC<DraggableShiftProps> = ({ 
  shift, 
  selectedDate,
  currentVersion 
}) => {
  const [{ isDragging }, drag] = useDrag({
    type: "SCHEDULE",
    item: (): DragItem => ({
      type: "SCHEDULE",
      employeeId: 0, // Will be assigned when dropped on an employee
      shiftId: shift.id,
      date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      shift_type_id: shift.shift_type_id,
      isDockItem: true, // Flag to indicate this is from the dock
    }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const getShiftTypeColor = (shiftType?: string) => {
    switch (shiftType) {
      case "EARLY": return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "MIDDLE": return "bg-green-500/20 text-green-300 border-green-500/30";
      case "LATE": return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      default: return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    }
  };

  const getShiftTypeName = (shiftType?: string) => {
    switch (shiftType) {
      case "EARLY": return "Früh";
      case "MIDDLE": return "Mitte";
      case "LATE": return "Spät";
      default: return "Schicht";
    }
  };

  return (
    <div
      ref={drag}
      className={cn(
        "flex flex-col items-center p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-all cursor-move min-w-[120px] select-none",
        isDragging && "opacity-50 scale-95 shadow-lg",
        !isDragging && "hover:shadow-md hover:scale-105"
      )}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground mb-1" />
      <div className="text-sm font-medium text-center mb-2">
        {shift.start_time} - {shift.end_time}
      </div>
      <div className="flex flex-col gap-1 items-center">
        {shift.shift_type_id && (
          <Badge
            variant="secondary"
            className={cn("text-xs", getShiftTypeColor(shift.shift_type_id))}
          >
            {getShiftTypeName(shift.shift_type_id)}
          </Badge>
        )}
        <div className="text-xs text-muted-foreground">
          {shift.duration_hours}h
        </div>
        {shift.requires_break && (
          <Badge variant="outline" className="text-xs">
            ☕ Break
          </Badge>
        )}
      </div>
    </div>
  );
};

export const ScheduleDock: React.FC<ScheduleDockProps> = ({ 
  currentVersion, 
  selectedDate,
  onClose,
  onDrop 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("employees");

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts"],
    queryFn: getShifts,
  });

  // Filter active employees
  const activeEmployees = useMemo(() => 
    employees.filter(emp => emp.is_active), 
    [employees]
  );

  // Filter shifts that are available for the selected date
  const availableShifts = useMemo(() => {
    if (!selectedDate) return shifts;
    
    const dayOfWeek = selectedDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    // Convert to match backend format (0 = Monday)
    const backendDayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    return shifts.filter(shift => {
      if (!shift.active_days) return true;
      
      // Handle both array and object formats for active_days
      if (Array.isArray(shift.active_days)) {
        return shift.active_days.includes(backendDayIndex);
      } else if (typeof shift.active_days === 'object') {
        // Handle object format where keys are day indices
        return shift.active_days[backendDayIndex.toString()] === true;
      }
      
      return true;
    });
  }, [shifts, selectedDate]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 border-t border-border shadow-lg">
      {/* Dock Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2"
            title="Drag employees or shifts from here onto the schedule table to create new assignments"
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            <span className="font-medium">Drag & Drop Stack</span>
            <Badge variant="secondary" className="ml-2">
              {activeTab === "employees" ? activeEmployees.length : availableShifts.length} items
            </Badge>
          </Button>
          {!isExpanded && (
            <div className="text-xs text-muted-foreground hidden sm:block">
              💡 Expand to drag items onto the schedule
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {selectedDate && (
            <Badge variant="outline" className="text-xs">
              {format(selectedDate, "dd.MM.yyyy")}
            </Badge>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Dock Content */}
      {isExpanded && (
        <div className="max-h-60 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="px-4 py-2 border-b border-border">
              <TabsList className="grid w-fit grid-cols-2">
                <TabsTrigger value="employees" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Employees
                </TabsTrigger>
                <TabsTrigger value="shifts" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Shifts
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="employees" className="mt-0">
              <ScrollArea className="h-48">
                <div className="p-4">
                  {activeEmployees.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground">
                      <div className="text-center">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No active employees available</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-auto-fit-120 gap-3">
                      {activeEmployees.map((employee) => (
                        <DraggableEmployee
                          key={employee.id}
                          employee={employee}
                          selectedDate={selectedDate}
                          currentVersion={currentVersion}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="shifts" className="mt-0">
              <ScrollArea className="h-48">
                <div className="p-4">
                  {availableShifts.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground">
                      <div className="text-center">
                        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No shifts available for this date</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-auto-fit-120 gap-3">
                      {availableShifts.map((shift) => (
                        <DraggableShift
                          key={shift.id}
                          shift={shift}
                          selectedDate={selectedDate}
                          currentVersion={currentVersion}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}; 