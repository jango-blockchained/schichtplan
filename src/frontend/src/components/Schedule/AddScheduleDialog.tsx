import { format } from "date-fns";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  Check,
  Clock,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
// Removed unused useQuery, useMutation, useQueryClient for now, can be added back if other parts need them
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  getApplicableShiftsForEmployee,
  getEmployeeAvailabilityByDate,
  getEmployees,
  getSettings,
  getShifts,
  updateEmployee,
} from "@/services/api";
import {
  createRequiredConsecutiveShifts,
  validateConsecutiveShiftRequirements,
} from "@/services/scheduleUtils";
import {
  ApplicableShift,
  AvailabilityTypeStrings,
  EmployeeAvailabilityStatus,
} from "@/types";

interface AddScheduleDialogProps {
  isOpen: boolean;
  // Support both onClose and onOpenChange(open:boolean)
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  onAddSchedule: (scheduleData: {
    employee_id: number;
    date: string;
    shift_id: number;
    version: number;
    availability_type: AvailabilityTypeStrings | null;
    is_keyholder?: boolean;
  }) => Promise<void>;
  version: number;
  defaultDate?: Date;
  defaultEmployeeId?: number;
  // Optional props used by tests
  defaultShiftId?: number | null;
  scheduleId?: number | null;
}

export function AddScheduleDialog({
  isOpen,
  onClose,
  onOpenChange,
  onAddSchedule,
  version,
  defaultDate: initialDefaultDate, // Renamed to avoid conflict in useEffect
  defaultEmployeeId: initialDefaultEmployeeId, // Renamed
  defaultShiftId,
  scheduleId,
}: AddScheduleDialogProps) {
  const { toast } = useToast();

  // Initialize state with default values from props
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedShift, setSelectedShift] = useState<number | null>(null);
  const [isKeyholder, setIsKeyholder] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [employeeStatusList, setEmployeeStatusList] = useState<
    EmployeeAvailabilityStatus[]
  >([]);
  const [isLoadingEmployeeStatus, setIsLoadingEmployeeStatus] = useState(false);

  const [applicableShiftsList, setApplicableShiftsList] = useState<
    ApplicableShift[]
  >([]);
  const [isLoadingApplicableShifts, setIsLoadingApplicableShifts] =
    useState(false);

  const [selectedAvailabilityType, setSelectedAvailabilityType] =
    useState<AvailabilityTypeStrings | null>(null);

  // Debug logging for props and state
  useEffect(() => {
    console.log("AddScheduleDialog props and state:", {
      initialDefaultDate,
      initialDefaultEmployeeId,
      selectedDate,
      selectedEmployee,
      isOpen,
    });
  }, [
    initialDefaultDate,
    initialDefaultEmployeeId,
    selectedDate,
    selectedEmployee,
    isOpen,
  ]);

  // Reset state when dialog opens with default values
  useEffect(() => {
    if (isOpen) {
      // Set default date and employee when dialog opens
      setSelectedDate(initialDefaultDate || new Date());

      if (initialDefaultEmployeeId) {
        setSelectedEmployee(initialDefaultEmployeeId);
      } else {
        setSelectedEmployee(null);
      }

      // Reset shift selection
      setSelectedShift(defaultShiftId ?? null);
      setSelectedAvailabilityType(null);
      setIsKeyholder(false);
    }
  }, [isOpen, initialDefaultDate, initialDefaultEmployeeId, defaultShiftId]);

  // Fetch employee availability status when selectedDate changes or dialog opens
  useEffect(() => {
    if (selectedDate && isOpen) {
      setIsLoadingEmployeeStatus(true);

      getEmployeeAvailabilityByDate(format(selectedDate, "yyyy-MM-dd"))
        .then((data) => {
          setEmployeeStatusList(data);

          // Check if default employee is in the list and still valid
          if (initialDefaultEmployeeId) {
            const defaultEmployeeInList = data.find(
              (emp) => emp.employee_id === initialDefaultEmployeeId,
            );

            if (defaultEmployeeInList) {
              setSelectedEmployee(initialDefaultEmployeeId);
            } else {
              // Don't clear selection if it was explicitly set
            }
          }
        })
        .catch((error) => {
          console.error("Error fetching employee availability status:", error);
          toast({
            title: "Fehler",
            description: `Mitarbeiterverfügbarkeit konnte nicht geladen werden: ${(error as Error).message}`,
            variant: "destructive",
          });
          setEmployeeStatusList([]);
        })
        .finally(() => {
          setIsLoadingEmployeeStatus(false);
        });
    }
  }, [selectedDate, isOpen, toast, initialDefaultEmployeeId]);

  // Load shifts when employee or date selection changes
  useEffect(() => {
    if (selectedDate && selectedEmployee && isOpen) {
      setIsLoadingApplicableShifts(true);
      // Reset shift selection when employee/date changes
      setSelectedShift(null);
      setSelectedAvailabilityType(null);

      console.log(
        "Fetching shifts for employee:",
        selectedEmployee,
        "on date:",
        format(selectedDate, "yyyy-MM-dd"),
      );

      getApplicableShiftsForEmployee(
        format(selectedDate, "yyyy-MM-dd"),
        selectedEmployee,
      )
        .then((data) => {
          console.log("Loaded shifts with availability:", data);
          setApplicableShiftsList(data);

          // Auto-select if there's only one available shift
          const availableShifts = data.filter((shift) => shift.is_available);
          if (availableShifts.length === 1) {
            setSelectedShift(availableShifts[0].shift_id);
            setSelectedAvailabilityType(availableShifts[0].availability_type);
          }
          // If there's a currently assigned shift, select it
          const currentAssignment = data.find(
            (shift) => shift.is_currently_assigned,
          );
          if (currentAssignment) {
            setSelectedShift(currentAssignment.shift_id);
            setSelectedAvailabilityType(currentAssignment.availability_type);
          }
        })
        .catch((error) => {
          console.error("Error fetching shift templates:", error);
          toast({
            title: "Fehler",
            description: `Schichtvorlagen konnten nicht geladen werden: ${(error as Error).message}`,
            variant: "destructive",
          });
          setApplicableShiftsList([]);
        })
        .finally(() => {
          setIsLoadingApplicableShifts(false);
        });
    }
  }, [selectedDate, selectedEmployee, isOpen, toast]);

  const handleSubmit = async () => {
    if (
      !selectedEmployee ||
      !selectedDate ||
      !selectedShift ||
      !selectedAvailabilityType
    ) {
      toast({
        title: "Missing Information",
        description: "Please select a date, an employee, and a shift.",
        variant: "default", // Changed from "warning"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Get shift details for consecutive shift validation
      const selectedShiftDetails = applicableShiftsList.find(s => s.shift_id === selectedShift);

      if (selectedShiftDetails) {
        // Validate consecutive shift requirements
        const settings = await getSettings();
        const openingDays = settings?.general?.opening_days;

        const validation = await validateConsecutiveShiftRequirements(
          selectedEmployee,
          selectedShiftDetails,
          selectedDate,
          openingDays
        );

        if (!validation.isValid) {
          toast({
            title: "Consecutive Shift Requirement Conflict",
            description: validation.conflicts.join(". "),
            variant: "destructive",
          });
          return;
        }
      }

      // Handle keyholder status if selected
      if (isKeyholder) {
        try {
          // Get all employees to find other keyholders
          const employees = await getEmployees();
          // Find and unset other keyholders
          const otherKeyholders = employees.filter(emp =>
            emp.id !== selectedEmployee && emp.is_keyholder
          );
          for (const keyholder of otherKeyholders) {
            await updateEmployee(keyholder.id, {
              ...keyholder,
              is_keyholder: false
            });
          }
          // Set the selected employee as keyholder
          const currentEmployee = employees.find(emp => emp.id === selectedEmployee);
          if (currentEmployee && !currentEmployee.is_keyholder) {
            await updateEmployee(currentEmployee.id, {
              ...currentEmployee,
              is_keyholder: true
            });
          }
        } catch (error) {
          toast({
            title: "Warning",
            description: "Schedule will be created but keyholder status update failed: " + (error instanceof Error ? error.message : "Unknown error"),
            variant: "destructive",
          });
        }
      }

      // Create the schedule
      await onAddSchedule({
        employee_id: selectedEmployee,
        date: format(selectedDate, "yyyy-MM-dd"),
        shift_id: selectedShift,
        version,
        availability_type: selectedAvailabilityType,
        is_keyholder: isKeyholder,
      });

      // Create required consecutive shifts after successful schedule creation
      if (selectedShiftDetails) {
        try {
          const settings = await getSettings();
          const shifts = await getShifts();
          const openingDays = settings?.general?.opening_days;

          await createRequiredConsecutiveShifts(
            selectedEmployee,
            selectedShiftDetails,
            selectedDate,
            version,
            shifts,
            openingDays
          );
        } catch (error) {
          console.error("Failed to create consecutive shifts:", error);
          toast({
            title: "Warning",
            description: "Schedule created but failed to create required consecutive shifts: " + (error instanceof Error ? error.message : "Unknown error"),
            variant: "destructive",
          });
        }
      }

      onClose(); // Close dialog on success
    } catch (error) {
      toast({
        title: "Fehler beim Speichern",
        description:
          error instanceof Error
            ? error.message
            : "Ein unbekannter Fehler ist aufgetreten.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmployeeChange = (value: string) => {
    const employeeId = value ? Number(value) : null;
    setSelectedEmployee(employeeId);
  };

  const handleShiftChange = (value: string) => {
    const shiftId = value ? Number(value) : null;
    console.log("Shift selection changed to:", shiftId);
    setSelectedShift(shiftId);
    if (shiftId) {
      const chosenShift = applicableShiftsList.find(
        (s) => s.shift_id === shiftId,
      );
      if (chosenShift) {
        setSelectedAvailabilityType(chosenShift.availability_type);
      } else {
        setSelectedAvailabilityType(null);
      }
    } else {
      setSelectedAvailabilityType(null);
    }
  };

  // Helper function to render shift info with availability indicators
  const renderShiftItem = (shift: ApplicableShift) => {
    const getAvailabilityColor = () => {
      if (!shift.is_available) return "text-red-500";
      switch (shift.availability_type) {
        case "FIXED":
          return "text-green-600 font-medium";
        case "PREFERRED":
          return "text-blue-600";
        case "AVAILABLE":
          return "text-gray-600";
        default:
          return "text-gray-600";
      }
    };

    const getAvailabilityIcon = () => {
      if (!shift.is_available) return <X className="h-4 w-4 text-red-500" />;
      switch (shift.availability_type) {
        case "FIXED":
          return <Check className="h-4 w-4 text-green-600" />;
        case "PREFERRED":
          return <Check className="h-4 w-4 text-blue-600" />;
        case "AVAILABLE":
          return <Check className="h-4 w-4 text-gray-600" />;
        default:
          return null;
      }
    };

    // Create status badges
    const badges = [];

    if (shift.is_currently_assigned) {
      badges.push(
        <Badge
          key="assigned"
          variant="outline"
          className="bg-green-100 text-green-800 border-green-300 ml-1"
        >
          Zugewiesen
        </Badge>,
      );
    }

    if (shift.is_assigned_to_other) {
      badges.push(
        <Badge
          key="conflict"
          variant="outline"
          className="bg-amber-100 text-amber-800 border-amber-300 ml-1"
        >
          Belegt
        </Badge>,
      );
    }

    if (!shift.is_available) {
      badges.push(
        <Badge
          key="unavailable"
          variant="outline"
          className="bg-red-100 text-red-800 border-red-300 ml-1"
        >
          Nicht verfügbar
        </Badge>,
      );
    }

    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="mr-2">{getAvailabilityIcon()}</span>
          <span className={cn(getAvailabilityColor())}>
            {shift.name} ({shift.start_time} - {shift.end_time})
          </span>
        </div>
        <div className="flex gap-1">{badges}</div>
      </div>
    );
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      if (onClose) onClose();
      if (onOpenChange) onOpenChange(false);
    } else if (onOpenChange) {
      onOpenChange(true);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Neuen Schichtplan hinzufügen</DialogTitle>
          <DialogDescription>
            Fügen Sie einen neuen Schichtplan für einen Mitarbeiter hinzu.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Date Input */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="date-picker" className="text-right">
              Datum
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date-picker"
                  variant="outline"
                  className={cn(
                    "col-span-3 justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground",
                  )}
                  disabled={isSubmitting}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? (
                    format(selectedDate, "dd.MM.yyyy")
                  ) : (
                    <span>Datum auswählen</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Employee Input */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="employee-select" className="text-right">
              Mitarbeiter
            </Label>
            <Select
              value={selectedEmployee?.toString() || ""}
              onValueChange={handleEmployeeChange}
              disabled={
                isLoadingEmployeeStatus || !selectedDate || isSubmitting
              }
            >
              <SelectTrigger className="col-span-3" id="employee-select">
                <SelectValue
                  placeholder={
                    isLoadingEmployeeStatus
                      ? "Lädt Mitarbeiter..."
                      : !selectedDate
                        ? "Bitte Datum wählen"
                        : "Mitarbeiter auswählen"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {isLoadingEmployeeStatus && (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Lädt Mitarbeiter...
                  </div>
                )}
                {!isLoadingEmployeeStatus &&
                  selectedDate &&
                  employeeStatusList.length === 0 && (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      Keine Mitarbeiter für dieses Datum.
                    </div>
                  )}
                {employeeStatusList.map((empStatus) => (
                  <SelectItem
                    key={empStatus.employee_id}
                    value={empStatus.employee_id.toString()}
                  >
                    {empStatus.employee_name}
                    <span
                      className={cn(
                        "text-xs opacity-80 ml-2",
                        empStatus.status.startsWith("Absence") &&
                        "text-red-500",
                        empStatus.status.startsWith("Shift") && "text-blue-500",
                        empStatus.status === "Available" && "text-green-500",
                      )}
                    >
                      ({empStatus.status})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Shift Input */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="shift-select" className="text-right">
              Schicht
            </Label>
            <Select
              value={selectedShift?.toString() || ""}
              onValueChange={handleShiftChange}
              disabled={
                isLoadingApplicableShifts || !selectedEmployee || isSubmitting
              }
            >
              <SelectTrigger className="col-span-3" id="shift-select">
                <SelectValue
                  placeholder={
                    isLoadingApplicableShifts
                      ? "Lädt Schichten..."
                      : !selectedEmployee
                        ? "Bitte Mitarbeiter wählen"
                        : "Schicht auswählen"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {isLoadingApplicableShifts && (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    <Clock className="h-4 w-4 animate-spin inline mr-2" />
                    Lädt Schichten...
                  </div>
                )}
                {!isLoadingApplicableShifts &&
                  selectedEmployee &&
                  applicableShiftsList.length === 0 && (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      <AlertTriangle className="h-4 w-4 inline mr-2 text-yellow-500" />
                      Keine Schichten für diesen Tag definiert.
                    </div>
                  )}
                {/* First show available shifts */}
                {applicableShiftsList
                  .filter((s) => s.is_available)
                  .map((shift) => (
                    <SelectItem
                      key={`available-${shift.shift_id}`}
                      value={shift.shift_id.toString()}
                      className="py-2"
                    >
                      {renderShiftItem(shift)}
                    </SelectItem>
                  ))}

                {/* Then show unavailable shifts (if any) */}
                {applicableShiftsList.filter((s) => !s.is_available).length >
                  0 && (
                    <div className="py-1 px-2 text-xs text-muted-foreground border-t">
                      Nicht verfügbare Schichten:
                    </div>
                  )}
                {applicableShiftsList
                  .filter((s) => !s.is_available)
                  .map((shift) => (
                    <SelectItem
                      key={`unavailable-${shift.shift_id}`}
                      value={shift.shift_id.toString()}
                      className="py-2"
                    >
                      {renderShiftItem(shift)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Keyholder Checkbox */}
          <div className="grid grid-cols-4 items-center gap-4">
            <div></div> {/* Empty cell for alignment */}
            <div className="col-span-3 flex items-center space-x-2">
              <Checkbox
                id="keyholder"
                checked={isKeyholder}
                onCheckedChange={(checked) => setIsKeyholder(checked as boolean)}
                disabled={isSubmitting}
              />
              <Label
                htmlFor="keyholder"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Als Schlüsselträger markieren
              </Label>
            </div>
          </div>

          {/* Show selected availability type if one is selected */}
          {selectedShift && selectedAvailabilityType && (
            <div className="p-2 bg-slate-50 rounded border mt-2">
              <div className="text-sm text-center">
                <strong>Verfügbarkeitstyp:</strong> {selectedAvailabilityType}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !selectedEmployee ||
              !selectedDate ||
              !selectedShift ||
              !selectedAvailabilityType ||
              isSubmitting
            }
          >
            {isSubmitting ? "Speichert..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
