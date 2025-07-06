import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { getEmployees, getSchedules, getSettings, getShifts, updateEmployee } from "@/services/api";
import {
    createRequiredConsecutiveShifts,
    validateConsecutiveShiftRequirements
} from "@/services/scheduleUtils";
import { Employee, Schedule, ScheduleUpdate, Settings } from "@/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChangeEvent, useCallback, useEffect, useState } from "react";

interface ShiftEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: Schedule;
  onSave: (scheduleId: number, updates: ScheduleUpdate) => Promise<void>;
  currentVersion?: number; // Add current version prop
}

export function ShiftEditModal({
  isOpen,
  onClose,
  schedule,
  onSave,
  currentVersion,
}: ShiftEditModalProps) {
  const [selectedShiftId, setSelectedShiftId] = useState<string>(
    schedule.shift_id?.toString() ?? "",
  );
  const [shiftStartTime, setShiftStartTime] = useState<string>(
    schedule.shift_start || "09:00",
  );
  const [shiftEndTime, setShiftEndTime] = useState<string>(
    schedule.shift_end || "17:00",
  );
  const [breakDuration, setBreakDuration] = useState<number>(
    0,
  );
  const [notes, setNotes] = useState(schedule.notes ?? "");
  const [isKeyholder, setIsKeyholder] = useState<boolean>(false);
  
  // Auto/Manual mode states
  const [isAutoBreakDuration, setIsAutoBreakDuration] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showKeyholderConflict, setShowKeyholderConflict] = useState(false);
  const [conflictingKeyholder, setConflictingKeyholder] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shifts } = useQuery({
    queryKey: ["shifts"],
    queryFn: getShifts,
  });

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const { data: allSchedules } = useQuery({
    queryKey: ["schedules", schedule.date],
    queryFn: () => {
      // Get schedules for the current schedule's date and a small window around it
      const scheduleDate = new Date(schedule.date);
      const startDate = new Date(scheduleDate);
      startDate.setDate(startDate.getDate() - 1); // Previous day
      const endDate = new Date(scheduleDate);
      endDate.setDate(endDate.getDate() + 1); // Next day
      
      return getSchedules(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        undefined, // version
        true // includeEmpty
      ).then(response => response.schedules || []);
    },
    enabled: !!schedule.date, // Only run when we have a schedule date
  });

  console.log("ShiftEditModal editing schedule:", {
    schedule_id: schedule.id,
    shift_id: schedule.shift_id,
    employee_id: schedule.employee_id,
    date: schedule.date,
    has_shift_start: !!schedule.shift_start,
    shift_start: schedule.shift_start,
    shift_end: schedule.shift_end,
  });

  // Enhanced break calculation function for keyholders
  const calculateAutoBreakDuration = useCallback((
    startTime: string, 
    endTime: string, 
    employeeData: Employee | undefined, 
    settingsData: Settings | undefined
  ): number => {
    try {
      if (!startTime || !endTime) return 0;
      
      // Calculate base working hours
      const startMinutes = timeToMinutes(startTime);
      let endMinutes = timeToMinutes(endTime);
      
      // Handle overnight shifts
      if (endMinutes < startMinutes) {
        endMinutes += 24 * 60;
      }
      
      const baseWorkingHours = (endMinutes - startMinutes) / 60;
      
      // Standard break for >6h working time
      let totalBreakMinutes = baseWorkingHours > 6 ? 30 : 0;
      
      // Add keyholder extra time as break
      if (employeeData?.is_keyholder && settingsData?.general) {
        const { 
          keyholder_before_minutes = 5, 
          keyholder_after_minutes = 10, 
          store_opening, 
          store_closing 
        } = settingsData.general;
        
        // Early shift (opening) - add before minutes as break
        if (store_opening && startTime <= store_opening) {
          totalBreakMinutes += keyholder_before_minutes;
        }
        
        // Late shift (closing) - add after minutes as break  
        if (store_closing && endTime >= store_closing) {
          totalBreakMinutes += keyholder_after_minutes;
        }
      }
      
      return totalBreakMinutes;
    } catch (error) {
      console.error("Error calculating auto break duration:", error);
      return 0;
    }
  }, []);

  // Helper function to convert time string to minutes
  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  };

  useEffect(() => {
    if (schedule.shift_id) {
      setSelectedShiftId(schedule.shift_id.toString());
    }
    setShiftStartTime(schedule.shift_start || "09:00");
    setShiftEndTime(schedule.shift_end || "17:00");
    setNotes(schedule.notes ?? "");
    
    // Initialize auto/manual flags (default to auto for backward compatibility)
    const hasManualBreak = schedule.break_duration != null && schedule.break_duration > 0;
    setIsAutoBreakDuration(!hasManualBreak);
    
    // Calculate and set break duration
    const currentEmployee = employees?.find(emp => emp.id === schedule.employee_id);
    
    if (hasManualBreak) {
      // Use existing manual break duration
      setBreakDuration(schedule.break_duration);
    } else {
      // Calculate auto break duration
      const startTime = schedule.shift_start || "09:00";
      const endTime = schedule.shift_end || "17:00";
      const autoBreak = calculateAutoBreakDuration(startTime, endTime, currentEmployee, settings);
      setBreakDuration(autoBreak);
    }
    
    // Default keyholder to false for assignments (don't auto-check based on employee status)
    setIsKeyholder(false);
    
    console.log(
      "📋 ShiftEditModal initialized with break calculation:",
      {
        schedule_id: schedule.id,
        hasManualBreak,
        break_duration: schedule.break_duration,
        calculated_auto_break: calculateAutoBreakDuration(
          schedule.shift_start || "09:00", 
          schedule.shift_end || "17:00", 
          currentEmployee, 
          settings
        ),
        availability_type: schedule.availability_type || "AVAILABLE",
      }
    );
  }, [schedule, employees, settings, calculateAutoBreakDuration]);

  // Recalculate break duration when times or keyholder status change (in auto mode)
  useEffect(() => {
    if (isAutoBreakDuration && shiftStartTime && shiftEndTime) {
      const currentEmployee = employees?.find(emp => emp.id === schedule.employee_id);
      if (isKeyholder) {
        // Use keyholder status from state (might be different from DB)
        const keyholderEmployee = { ...currentEmployee, is_keyholder: true };
        const autoBreak = calculateAutoBreakDuration(shiftStartTime, shiftEndTime, keyholderEmployee, settings);
        setBreakDuration(autoBreak);
      } else {
        const autoBreak = calculateAutoBreakDuration(shiftStartTime, shiftEndTime, currentEmployee, settings);
        setBreakDuration(autoBreak);
      }
    }
  }, [isAutoBreakDuration, shiftStartTime, shiftEndTime, isKeyholder, employees, settings, schedule.employee_id, calculateAutoBreakDuration]);

  const handleShiftTemplateChange = (shiftId: string) => {
    setSelectedShiftId(shiftId);
    
    // Auto-populate times from selected shift template
    const selectedShift = shifts?.find((s) => s.id === parseInt(shiftId));
    if (selectedShift) {
      setShiftStartTime(selectedShift.start_time);
      setShiftEndTime(selectedShift.end_time);
    }
  };

  const checkKeyholderConflict = () => {
    console.log("🔍 checkKeyholderConflict called:", {
      isKeyholder,
      hasAllSchedules: !!allSchedules,
      hasEmployees: !!employees,
      allSchedulesLength: allSchedules?.length || 0,
      employeesLength: employees?.length || 0
    });
    
    if (!isKeyholder || !allSchedules || !employees) {
      console.log("🔍 Early return from conflict check - missing data");
      return null;
    }
    
    const scheduleDate = schedule.date;
    const currentEmployee = employees.find(emp => emp.id === schedule.employee_id);
    
    console.log("🔍 Checking conflicts for:", {
      scheduleDate,
      currentEmployeeId: schedule.employee_id,
      currentEmployeeName: currentEmployee ? `${currentEmployee.first_name} ${currentEmployee.last_name}` : "Unknown"
    });
    
    // Find other keyholder shifts on the same date
    const conflictingSchedule = allSchedules.find(s => {
      const matchesDate = s.date === scheduleDate;
      const differentSchedule = s.id !== schedule.id;
      const differentEmployee = s.employee_id !== schedule.employee_id;
      const employeeIsKeyholder = employees.find(emp => emp.id === s.employee_id)?.is_keyholder;
      
      console.log("🔍 Checking schedule:", {
        scheduleId: s.id,
        employeeId: s.employee_id,
        date: s.date,
        matchesDate,
        differentSchedule,
        differentEmployee,
        employeeIsKeyholder
      });
      
      return matchesDate && differentSchedule && differentEmployee && employeeIsKeyholder;
    });
    
    if (conflictingSchedule) {
      const conflictingEmployee = employees.find(emp => emp.id === conflictingSchedule.employee_id);
      const conflictName = `${conflictingEmployee?.first_name} ${conflictingEmployee?.last_name}`;
      console.log("🔍 Found keyholder conflict:", conflictName);
      return conflictName;
    }
    
    console.log("🔍 No keyholder conflict found");
    return null;
  };

  const handleSave = async () => {
    console.log("🟢 ShiftEditModal handleSave called");
    console.log("🔍 Debug info:", {
      isKeyholder,
      allSchedules: allSchedules?.length || 0,
      employees: employees?.length || 0,
      scheduleDate: schedule.date,
      currentEmployeeId: schedule.employee_id
    });
    
    // Check for keyholder conflicts if trying to set as keyholder
    if (isKeyholder) {
      const conflictEmployee = checkKeyholderConflict();
      console.log("🔍 Keyholder conflict check result:", conflictEmployee);
      if (conflictEmployee) {
        setConflictingKeyholder(conflictEmployee);
        setShowKeyholderConflict(true);
        return; // Don't proceed with save
      }
    }
    
    await performSave();
  };

  const handleKeyholderConflictConfirm = async () => {
    setShowKeyholderConflict(false);
    await performSave(); // Force save with keyholder change
  };

  const performSave = async () => {
    setIsSubmitting(true);
    
    try {
      console.log("🟢 Starting save process...");
      
      // Step 1: Prepare schedule updates
      const updates: ScheduleUpdate = {
        shift_id: selectedShiftId ? parseInt(selectedShiftId, 10) : null,
        shift_start: shiftStartTime,
        shift_end: shiftEndTime,
        break_duration: isAutoBreakDuration ? null : (breakDuration || null), // null = auto-calculate
        notes: notes || null,
        availability_type: schedule.availability_type || "AVAILABLE",
      };

      // Add template times if missing
      if (updates.shift_id && (!updates.shift_start || !updates.shift_end)) {
        const selectedShift = shifts?.find((s) => s.id === updates.shift_id);
        if (selectedShift) {
          updates.shift_start = updates.shift_start || selectedShift.start_time;
          updates.shift_end = updates.shift_end || selectedShift.end_time;
        }
      }

      console.log("🟢 Schedule updates:", {
        ...updates,
        isAutoBreakDuration,
        calculatedBreakDuration: breakDuration
      });

      // Step 2: Save the schedule
      await onSave(schedule.id, updates);
      console.log("🟢 Schedule saved successfully");

      // Step 2.5: Handle consecutive shift requirements for ALL employees
      const currentEmployee = employees?.find(emp => emp.id === schedule.employee_id);
      if (currentEmployee) {
        try {
          console.log("🔄 Processing consecutive shift requirements...");
          await handleConsecutiveDayRequirements(currentEmployee, updates);
          console.log("✅ Consecutive shift requirements processed successfully");
        } catch (error) {
          console.error("❌ Error handling consecutive shift requirements:", error);
          // Show warning but don't fail the entire operation
          toast({
            title: "Warning",
            description: "Shift updated but failed to create required consecutive shifts: " + (error instanceof Error ? error.message : "Unknown error"),
            variant: "destructive",
          });
        }
      }

      // Step 3: Handle keyholder status changes
      if (currentEmployee && currentEmployee.is_keyholder !== isKeyholder) {
        console.log("🔑 Processing keyholder status change...");
        
        try {
          if (isKeyholder) {
            console.log("🔑 Setting employee as keyholder...");
            
            // First, unset all other keyholders
            const otherKeyholders = employees?.filter(emp => 
              emp.id !== schedule.employee_id && emp.is_keyholder
            ) || [];
            
            console.log("🔑 Found other keyholders to unset:", otherKeyholders.length);
            
            for (const keyholder of otherKeyholders) {
              console.log("🔑 Unsetting keyholder:", keyholder.first_name, keyholder.last_name);
              await updateEmployee(keyholder.id, { 
                ...keyholder, 
                is_keyholder: false 
              });
            }
          }
          
          // Update current employee's keyholder status
          console.log("🔑 Updating current employee keyholder status...");
          await updateEmployee(currentEmployee.id, { 
            ...currentEmployee, 
            is_keyholder: isKeyholder 
          });
          
          console.log("🔑 Keyholder status updated successfully");
        } catch (error) {
          console.error("❌ Error updating keyholder status:", error);
          throw new Error("Failed to update keyholder status: " + (error instanceof Error ? error.message : "Unknown error"));
        }
      }

      // Step 5: Invalidate caches to trigger UI reload
      console.log("🔄 Invalidating caches...");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["schedules"] }),
        queryClient.invalidateQueries({ queryKey: ["employees"] }),
        queryClient.invalidateQueries({ queryKey: ["shifts"] })
      ]);
      
      console.log("✅ Save process completed successfully");
      
      toast({
        title: "Success",
        description: "Shift updated successfully",
      });
      
      onClose();
      
    } catch (error) {
      console.error("❌ Error in performSave:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update shift",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle consecutive day requirements for ALL employees
  const handleConsecutiveDayRequirements = async (employee: Employee, scheduleUpdates: ScheduleUpdate) => {
    if (!shifts) return;
    
    const selectedShift = shifts.find(s => s.id === scheduleUpdates.shift_id);
    if (!selectedShift) return;
    
    console.log("� Checking consecutive day requirements for all employees:", {
      employeeId: employee.id,
      shiftType: selectedShift.shift_type_id,
      date: schedule.date
    });
    
    try {
      // Validate consecutive shift requirements first
      const settings = await getSettings();
      const openingDays = settings?.general?.opening_days;
      
      const validation = await validateConsecutiveShiftRequirements(
        employee.id,
        selectedShift,
        new Date(schedule.date),
        openingDays
      );
      
      if (!validation.isValid) {
        throw new Error(`Consecutive shift requirements conflict: ${validation.conflicts.join(". ")}`);
      }
      
      // Create required consecutive shifts
      await createRequiredConsecutiveShifts(
        employee.id,
        selectedShift,
        new Date(schedule.date),
        currentVersion || schedule.version || 1,
        shifts,
        openingDays
      );
      
      console.log("✅ Consecutive day requirements handled successfully");
      
    } catch (error) {
      console.error("❌ Error handling consecutive day requirements:", error);
      throw error; // Re-throw to let the caller handle the error
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {schedule.shift_id
                ? "Schicht bearbeiten"
                : "Neue Schicht erstellen"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="shift">Schicht</Label>
              <Select value={selectedShiftId} onValueChange={handleShiftTemplateChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Schicht auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {shifts?.map((shift) => (
                    <SelectItem key={shift.id} value={shift.id.toString()}>
                      {shift.start_time} - {shift.end_time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Startzeit</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={shiftStartTime}
                  onChange={(e) => setShiftStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">Endzeit</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={shiftEndTime}
                  onChange={(e) => setShiftEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="keyholder"
                checked={isKeyholder}
                onCheckedChange={(checked) => setIsKeyholder(checked as boolean)}
              />
              <Label 
                htmlFor="keyholder" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Als Schlüsselträger markieren
              </Label>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="autoBreakDuration"
                  checked={isAutoBreakDuration}
                  onCheckedChange={(checked) => setIsAutoBreakDuration(checked as boolean)}
                />
                <Label 
                  htmlFor="autoBreakDuration" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Pausenlänge automatisch berechnen
                </Label>
              </div>
              
              {isAutoBreakDuration ? (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Berechnete Pausenlänge: {breakDuration} Minuten
                    {breakDuration > 30 && (
                      <span className="text-xs block text-blue-600">
                        (30min Standard + {breakDuration - 30}min Schlüsselträger-Zeit)
                      </span>
                    )}
                  </Label>
                  <div className="text-xs text-muted-foreground">
                    Automatische Berechnung: 30min für Schichten &gt;6h, plus Schlüsselträger-Zeit
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="breakDuration">
                    Pausenlänge: {breakDuration} Minuten
                  </Label>
                  <Slider
                    id="breakDuration"
                    value={[breakDuration]}
                    min={0}
                    max={60}
                    step={5}
                    onValueChange={(values) => setBreakDuration(values[0])}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notizen</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                  setNotes(e.target.value)
                }
                placeholder="Notizen zur Schicht..."
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting ? "Speichern..." : "Speichern"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <KeyholderConflictDialog
        isOpen={showKeyholderConflict}
        onClose={() => setShowKeyholderConflict(false)}
        conflictingKeyholder={conflictingKeyholder}
        onConfirm={handleKeyholderConflictConfirm}
      />
    </>
  );
}

// Keyholder Conflict Dialog Component
function KeyholderConflictDialog({
  isOpen,
  onClose,
  conflictingKeyholder,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  conflictingKeyholder: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schlüsselträger-Konflikt</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p>
            Es ist bereits ein anderer Schlüsselträger für diesen Tag eingeteilt: <strong>{conflictingKeyholder}</strong>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Es kann nur einen Schlüsselträger pro Tag geben. Möchten Sie den aktuellen Schlüsselträger ersetzen?
          </p>
        </div>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={onConfirm}>
            Schlüsselträger ersetzen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
