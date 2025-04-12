import React, { useEffect, useState, useMemo } from "react";
import { format } from "date-fns";
import { Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import {
  getSettings,
  updateEmployeeAvailability,
  getEmployeeAvailabilities,
  addEmployeeAvailability,
  updateAvailability,
  deleteAvailability,
  EmployeeAvailability,
  Availability,
} from "@/services/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AvailabilityTypeSelect } from "@/components/common/AvailabilityTypeSelect";
import type { AvailabilityTypeSetting } from "@/types";
import { AvailabilityType } from "@/types/index";

interface EmployeeAvailabilityModalProps {
  employeeId: number;
  employeeName: string;
  employeeGroup: string;
  contractedHours: number;
  isOpen: boolean;
  onClose: () => void;
}

type TimeSlot = {
  time: string;
  hour: number;
  days: { [key: string]: boolean };
};

type CellState = {
  selected: boolean;
  type: string;
};

// Define days starting with Monday (1) to Sunday (7)
const ALL_DAYS = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
];
const TIME_FORMAT = "HH:mm";

export const EmployeeAvailabilityModal = ({
  employeeId,
  employeeName,
  employeeGroup,
  contractedHours,
  isOpen,
  onClose,
}: EmployeeAvailabilityModalProps): React.ReactElement => {
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedCells, setSelectedCells] = useState<Map<string, string>>(
    new Map(),
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dailyHours, setDailyHours] = useState<{ [key: string]: number }>({});
  const [weeklyHours, setWeeklyHours] = useState(0);
  const [activeDays, setActiveDays] = useState<string[]>([]);
  const [currentType, setCurrentType] = useState<string>("AVAILABLE");

  const [pendingCellToggles, setPendingCellToggles] = useState<Map<string, 'select' | 'delete'>>(new Map());
  const [dragAction, setDragAction] = useState<'select' | 'delete' | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const { data: availabilities, refetch: refetchAvailabilities, isLoading: isLoadingAvailabilities } = useQuery({
    queryKey: ["employee-availabilities", employeeId],
    queryFn: () => getEmployeeAvailabilities(employeeId),
    enabled: isOpen,
  });

  // Map availability type IDs (e.g., 'AVAILABLE') to enum values (e.g., AvailabilityType.AVAILABLE)
  const availabilityTypeIdToEnumMap = useMemo(() => {
    const map = new Map<string, AvailabilityType>();
    if (settings?.availability_types) {
      settings.availability_types.forEach(t => {
        const enumKey = t.id.toUpperCase() as keyof typeof AvailabilityType;
        if (AvailabilityType[enumKey]) {
          map.set(t.id, AvailabilityType[enumKey]);
        } else {
          console.warn(`Could not map availability type ID '${t.id}' to enum.`);
        }
      });
    }
     // Ensure UNAVAILABLE is mapped if it exists in settings or add manually
     if (!map.has('UNAVAILABLE') && AvailabilityType.UNAVAILABLE) { // Check enum exists
         map.set('UNAVAILABLE', AvailabilityType.UNAVAILABLE);
     }
    return map;
  }, [settings]);

  // Memoize existing availabilities mapped by day and hour for quick lookup
  const existingAvailabilityMap = useMemo(() => {
    const map = new Map<string, EmployeeAvailability>();
    if (availabilities) {
      availabilities.forEach((avail) => {
        const key = `${avail.day_of_week}-${avail.hour}`;
        map.set(key, avail);
      });
    }
    return map;
  }, [availabilities]);

  useEffect(() => {
    if (settings) {
      console.log("⚙️ Settings received:", settings);
      console.log("⚙️ Settings opening_days:", settings.opening_days);

      const days = Object.entries(settings.opening_days)
        .filter(([, isOpen]) => isOpen)
        .map(([dayIndex]) => ALL_DAYS[parseInt(dayIndex, 10)]);
      
      console.log("⚙️ Calculated active days:", days);
      setActiveDays(days);

      // Initialize time slots based on store hours
      const startHour = parseInt(settings.store_opening.split(":")[0], 10);
      const endHour = parseInt(settings.store_closing.split(":")[0], 10);
      const slots: TimeSlot[] = [];
      for (let hour = startHour; hour < endHour; hour++) {
        const time = `${hour.toString().padStart(2, "0")}:00 - ${(hour + 1).toString().padStart(2, "0")}:00`;
        slots.push({ time, hour, days: {} });
      }
      setTimeSlots(slots);

       // Set initial availability type to the first *available* type from settings
       if (settings?.availability_types) {
         const availableTypes = settings.availability_types.filter(
           (type: AvailabilityTypeSetting) => type.is_available,
         );
         if (availableTypes.length > 0) {
           setCurrentType(availableTypes[0].id);
         }
       }
    }
  }, [settings]);

  useEffect(() => {
    if (!activeDays.length || !availabilities) return;

    const dayHours: { [key: string]: number } = {};
    activeDays.forEach((day) => {
      dayHours[day] = 0;
    });
    setDailyHours(dayHours);

    const newSelectedCells = new Map<string, string>();
    
    // Process each availability entry
    availabilities.forEach((availability) => {
      // Convert backend day index (0=Mon) to frontend day name
      const dayName = ALL_DAYS[availability.day_of_week];
      
      if (activeDays.includes(dayName)) {
        // Find the time slot that corresponds to this hour
        const timeSlot = timeSlots.find(slot => {
          const [slotStartHour] = slot.time.split(" - ")[0].split(":").map(Number);
          return slotStartHour === availability.hour;
        });

        if (timeSlot) {
          const cellId = `${dayName}-${timeSlot.time}`;
          
          // Map the availability type to the correct type ID
          let typeId;
          switch (availability.availability_type) {
            case "UNAVAILABLE":
              typeId = "unavailable";
              break;
            case "AVAILABLE":
              typeId = "available";
              break;
            case "PREFERRED":
              typeId = "preferred";
              break;
            case "FIXED":
              typeId = "fixed";
              break;
            default:
              console.warn(`Unknown availability type: ${availability.availability_type}`);
              return;
          }
          
          if (availability.is_available) {
            newSelectedCells.set(cellId, typeId);
          }
        }
      }
    });

    setSelectedCells(newSelectedCells);
    calculateHours(newSelectedCells);
  }, [availabilities, activeDays, timeSlots]);

  const calculateHours = (cells: Map<string, string>) => {
    if (!activeDays.length) return;

    const dayHours: { [key: string]: number } = {};
    activeDays.forEach((day) => {
      dayHours[day] = 0;
    });

    Array.from(cells.keys()).forEach((cellId) => {
      const dayMatch = cellId.match(/^([^-]+)-/);
      if (dayMatch && dayMatch[1] && dayHours.hasOwnProperty(dayMatch[1])) {
        dayHours[dayMatch[1]]++;
      }
    });

    const totalHours = Object.values(dayHours).reduce(
      (sum, hours) => sum + hours,
      0,
    );

    setDailyHours(dayHours);
    setWeeklyHours(totalHours);
  };

  const handleCellMouseDown = (day: string, time: string) => {
    const cellId = `${day}-${time}`;
    setIsDragging(true);
    setDragStart(cellId);

    const newPendingToggles = new Map<string, 'select' | 'delete'>();
    const currentAction: 'select' | 'delete' = selectedCells.has(cellId) ? 'delete' : 'select';
    setDragAction(currentAction);
    newPendingToggles.set(cellId, currentAction);

    setPendingCellToggles(newPendingToggles);
  };

  const handleCellMouseEnter = (day: string, time: string) => {
    if (isDragging && dragAction) {
      const cellId = `${day}-${time}`;
      setPendingCellToggles(prev => new Map(prev).set(cellId, dragAction));
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      const wasDrag = pendingCellToggles.size > 1 || (dragStart && !selectedCells.has(dragStart) && pendingCellToggles.size > 0);

      if (pendingCellToggles.size > 0) {
         if (wasDrag) {
             const newSelectedCells = new Map(selectedCells);
             pendingCellToggles.forEach((action, cellId) => {
               if (action === 'select') {
                 newSelectedCells.set(cellId, currentType);
               } else {
                 newSelectedCells.delete(cellId);
               }
             });
             setSelectedCells(newSelectedCells);
             calculateHours(newSelectedCells);
         } else if (dragStart) {
             toggleCell(dragStart);
         }
      }

      setIsDragging(false);
      setDragStart(null);
      setPendingCellToggles(new Map());
      setDragAction(null);
    }
  };

  const toggleCell = (cellId: string) => {
    const newSelectedCells = new Map(selectedCells);
    if (newSelectedCells.has(cellId)) {
      newSelectedCells.delete(cellId);
    } else {
      newSelectedCells.set(cellId, currentType);
    }
    setSelectedCells(newSelectedCells);
    calculateHours(newSelectedCells);
  };

  const handleSelectAll = () => {
    const newSelectedCells = new Map<string, string>();
    timeSlots.forEach(({ time }) => {
      activeDays.forEach((day) => {
        newSelectedCells.set(`${day}-${time}`, currentType);
      });
    });
    setSelectedCells(newSelectedCells);
    calculateHours(newSelectedCells);
  };

  const handleDeselectAll = () => {
    setSelectedCells(new Map());
    calculateHours(new Map());
  };

  const handleToggleDay = (day: string) => {
    const newSelectedCells = new Map(selectedCells);

    // Find all cell IDs for this day based on timeSlots
    const dayCells = timeSlots.map(({ time }) => `${day}-${time}`);

    // Count how many cells are selected for this day
    const selectedDayCellsCount = dayCells.filter((cellId) =>
      selectedCells.has(cellId),
    ).length;

    const totalDayCells = dayCells.length;
    if (totalDayCells === 0) return; // Avoid division by zero

    const selectedRatio = selectedDayCellsCount / totalDayCells;

    // If more than 50% are selected, deselect all cells for the day
    // Otherwise, select all cells for the day with current type
    const shouldClear = selectedRatio >= 0.5;

    dayCells.forEach((cellId) => {
      if (shouldClear) {
        newSelectedCells.delete(cellId);
      } else {
        newSelectedCells.set(cellId, currentType);
      }
    });

    setSelectedCells(newSelectedCells);
    calculateHours(newSelectedCells);
  };

  const handleSave = async () => {
    if (!settings?.availability_types || isLoadingAvailabilities) {
      console.error("Settings or existing availabilities not loaded/loading.");
      return;
    }
    console.log("💾 [handleSave] Starting save process...");
    console.log("💾 [handleSave] Existing availabilities map:", existingAvailabilityMap);

    // 1. Prepare the desired state
    const desiredState = new Map<string, { typeEnum: AvailabilityType; isAvailable: boolean }>();
    timeSlots.forEach(({ hour }) => {
      activeDays.forEach((day) => {
        const frontendDayIndex = ALL_DAYS.indexOf(day);
        // Use the direct backendDayIndex for the key
        const backendDayIndex = frontendDayIndex; // No conversion needed
        const timeSlot = timeSlots.find(slot => slot.hour === hour);

        if (timeSlot) {
            const cellId = `${day}-${timeSlot.time}`;
            const selectedTypeId = selectedCells.get(cellId);
            // Use the direct backendDayIndex for the key
            const key = `${backendDayIndex}-${hour}`;
            const typeEnum = selectedTypeId ? availabilityTypeIdToEnumMap.get(selectedTypeId) : availabilityTypeIdToEnumMap.get('UNAVAILABLE');

            if (!typeEnum) {
                console.error(`[handleSave] Could not map type ID for key ${key}: TypeID='${selectedTypeId || 'UNAVAILABLE'}'`);
                return;
            }

            if (selectedTypeId) {
              desiredState.set(key, { typeEnum: typeEnum, isAvailable: true });
            } else {
              desiredState.set(key, { typeEnum: typeEnum, isAvailable: false });
            }
        } else {
            console.warn(`[handleSave] Could not find timeSlot for hour: ${hour} while building desired state.`);
        }
      });
    });
    console.log("💾 [handleSave] Desired state map:", desiredState);

    // 2. Calculate differences and prepare API calls
    const promises: Promise<any>[] = [];
    const processedExistingKeys = new Set<string>();

    console.log("💾 [handleSave] Comparing desired state with existing...");
    for (const [key, desired] of desiredState.entries()) {
       // day_of_week is parsed directly from key, which now uses correct index
      const [dayOfWeekStr, hourStr] = key.split('-'); 
      const day_of_week = parseInt(dayOfWeekStr, 10);
      const hour = parseInt(hourStr, 10);
      const existing = existingAvailabilityMap.get(key);

      processedExistingKeys.add(key);
      console.log(`💾 [handleSave] Processing key: ${key}`, { desired, existing });

      if (existing && typeof existing.id === 'number') {
        // --- Entry exists --- 
        if (desired.isAvailable) {
          // Desired: AVAILABLE
          if (existing.is_available) {
            // Existing: AVAILABLE - Check if type changed
            if (existing.availability_type !== desired.typeEnum) {
              console.log(`🔄 [handleSave] Action: UPDATE Type for ID ${existing.id} (key ${key}) to ${desired.typeEnum}`);
              const typeString = Object.keys(AvailabilityType).find(k => AvailabilityType[k as keyof typeof AvailabilityType] === desired.typeEnum) as "AVAILABLE" | "FIXED" | "PREFFERED" | "UNAVAILABLE";
              if (typeString) {
                  const updatePayload: Partial<Availability> = { availability_type: typeString };
                  promises.push(updateAvailability(existing.id, updatePayload));
              } else {
                   console.error(`[handleSave] Could not map enum ${desired.typeEnum} back to string for update.`);
              }
            } else {
                 console.log(`⏭️ [handleSave] Action: NO CHANGE needed (already available with same type) for key ${key}`);
            }
          } else {
            // Existing: UNAVAILABLE - Need to delete old and create new available one
            console.log(`🗑️ [handleSave] Action: DELETE unavailable ID ${existing.id} (key ${key})`);
            promises.push(deleteAvailability(existing.id));
            console.log(`➕ [handleSave] Action: CREATE available (key ${key}) with type ${desired.typeEnum}`);
            // Ensure payload uses correct day_of_week from key
            const createPayload = {
              day_of_week: day_of_week, 
              hour: hour,
              availability_type: desired.typeEnum,
              is_available: true,
              is_recurring: true,
            };
             promises.push(addEmployeeAvailability(employeeId, createPayload));
          }
        } else {
          // Desired: UNAVAILABLE
          if (existing.is_available) {
            // Existing: AVAILABLE - Need to delete it
            console.log(`🗑️ [handleSave] Action: DELETE available ID ${existing.id} (key ${key})`);
            promises.push(deleteAvailability(existing.id));
          } else {
            // Existing: UNAVAILABLE - Do nothing
            console.log(`⏭️ [handleSave] Action: NO CHANGE needed (already unavailable) for key ${key}`);
          }
        }
      } else {
        // --- Entry does NOT exist (or existing.id was invalid) --- 
        if (desired.isAvailable) {
           // Desired: AVAILABLE - Create it
            console.log(`➕ [handleSave] Action: CREATE available (key ${key}) with type ${desired.typeEnum}`);
             // Ensure payload uses correct day_of_week from key
            const createPayload = {
              day_of_week: day_of_week,
              hour: hour,
              availability_type: desired.typeEnum,
              is_available: true,
              is_recurring: true,
            };
            promises.push(addEmployeeAvailability(employeeId, createPayload));
        } else {
             // Desired: UNAVAILABLE - Do nothing (absence of record means unavailable)
             console.log(`⏭️ [handleSave] Action: NO CHANGE needed (implicitly unavailable) for key ${key}`);
        }
      }
    }

    // Check for obsolete entries
    console.log("💾 [handleSave] Checking for obsolete existing entries...");
     for (const [key, existing] of existingAvailabilityMap.entries()) {
       if (!processedExistingKeys.has(key)) {
           if (existing && typeof existing.id === 'number' && existing.is_available) {
               console.log(`🗑️ [handleSave] Action: DELETE obsolete available ID ${existing.id} (key ${key})`);
               promises.push(deleteAvailability(existing.id));
           } else {
               console.log(`⏭️ [handleSave] Obsolete key ${key} is already unavailable or invalid, no action needed.`);
           }
       }
     }

    // 3. Execute all API calls
    if (promises.length > 0) {
        console.log(`💾 [handleSave] Executing ${promises.length} API calls...`, promises);
        try {
            await Promise.all(promises);
            console.log("✅ [handleSave] All availability changes saved successfully.");
            await refetchAvailabilities();
            onClose();
        } catch (error) {
            console.error("❌ [handleSave] Failed to save one or more availability changes:", error);
            // TODO: Add user feedback (toast)
        }
    } else {
        console.log("💾 [handleSave] No availability changes detected.");
        onClose();
    }
  };

  const getCellColor = (cellId: string) => {
    const pendingAction = pendingCellToggles.get(cellId);
    let isPendingSelected: boolean | null = null;
    if (pendingAction !== undefined) {
        isPendingSelected = pendingAction === 'select';
    }

    const isCurrentlySelected = selectedCells.has(cellId);
    const displaySelected = isPendingSelected !== null ? isPendingSelected : isCurrentlySelected;

    if (!displaySelected) {
        const typeId = isCurrentlySelected ? selectedCells.get(cellId) : currentType;
        const availabilityType = settings?.availability_types?.find(t => t.id === typeId);
        if (isPendingSelected === true) {
            return availabilityType?.color ? `${availabilityType.color}40` : `#22c55e40`;
        }
        return "";
    }

    const typeId = isCurrentlySelected ? selectedCells.get(cellId) : currentType;
    const availabilityType = settings?.availability_types?.find(t => t.id === typeId);

    return availabilityType?.color || "#22c55e";
  };

  const getCellStyle = (cellId: string) => {
      const pendingAction = pendingCellToggles.get(cellId);
      const isCurrentlySelected = selectedCells.has(cellId);

      const displaySelected = pendingAction === 'select' || (pendingAction !== 'delete' && isCurrentlySelected);
      const cellTypeId = displaySelected
          ? (pendingAction === 'select' ? currentType : selectedCells.get(cellId))
          : 'unavailable';

      const cellTypeSetting = settings?.availability_types?.find(t => t.id === cellTypeId);

      let backgroundColor = "#ffffff";
      let opacity = 0.1;

      if (displaySelected) {
          backgroundColor = cellTypeSetting?.color || "#22c55e";
          opacity = 0.5;
      } else if (pendingAction === 'delete') {
          backgroundColor = cellTypeSetting?.color || "#ef4444";
          opacity = 0.2;
      } else {
          backgroundColor = "#ef4444";
          opacity = 0.1;
      }

      return {
          backgroundColor: `${backgroundColor}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
      };
  };

  const calculateTypeStats = () => {
    const stats = new Map<string, number>();
    selectedCells.forEach((type) => {
      stats.set(type, (stats.get(type) || 0) + 1);
    });
    return stats;
  };

  const calculateCumulativeHours = (day: string, currentHour: number) => {
    const stats = new Map<string, number>();
    timeSlots.forEach(({ time }) => {
        const [startHourStr] = time.split(" - ")[0].split(":");
        const slotStartHour = parseInt(startHourStr, 10);
        if (!isNaN(slotStartHour) && slotStartHour <= currentHour) {
            const cellId = `${day}-${time}`;
            const typeId = selectedCells.get(cellId);
            if (typeId) {
                stats.set(typeId, (stats.get(typeId) || 0) + 1);
            }
        }
    });
    return stats;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl">
        <div onMouseUp={handleMouseUp} onMouseLeave={isDragging ? handleMouseUp : undefined}>
          <DialogHeader>
            <DialogTitle>Availability for {employeeName}</DialogTitle>
            <div className="flex flex-col gap-2 mt-2">
              <div className="text-sm text-muted-foreground mb-2">
                Select time slots when the employee is available. Unselected time
                slots will be marked as unavailable.
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-sm">
                  {employeeGroup}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Contracted: {contractedHours}h/week
                </span>
                <span className="text-sm text-muted-foreground">
                  Selected: {weeklyHours}h/week
                </span>
                {settings &&
                  Array.from(calculateTypeStats()).map(([typeId, hours]) => {
                    const availabilityType =
                      settings?.availability_types?.find(
                        (t: AvailabilityTypeSetting) => t.id === typeId,
                      );
                    return (
                      availabilityType && (
                        <div
                          key={typeId}
                          className="flex items-center gap-1 text-sm"
                          style={{ color: availabilityType.color }}
                        >
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: availabilityType.color }}
                          />
                          {availabilityType.name}: {hours}h
                        </div>
                      )
                    );
                  })}
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Type:</span>
                  <AvailabilityTypeSelect
                    value={currentType}
                    onChange={setCurrentType}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={handleSelectAll} variant="outline" size="sm">
                    Select All
                  </Button>
                  <Button onClick={handleDeselectAll} variant="outline" size="sm">
                    Clear All
                  </Button>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="overflow-x-auto">
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Zeit</TableHead>
                    {activeDays.map((day) => (
                      <TableHead key={day} className="text-center">
                        <Button
                          variant="ghost"
                          className="w-full h-full p-1 text-left"
                          onClick={() => handleToggleDay(day)}
                        >
                          <div>
                            {day}
                            <div className="text-xs text-muted-foreground mt-1">
                              {dailyHours[day] || 0}h
                            </div>
                          </div>
                        </Button>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeSlots.map(({ time, hour }) => (
                    <TableRow key={time}>
                      <TableCell className="font-medium">{time}</TableCell>
                      {activeDays.map((day) => {
                        const cellId = `${day}-${time}`;
                        const pendingAction = pendingCellToggles.get(cellId);
                        const isCurrentlySelected = selectedCells.has(cellId);
                        const displaySelected = pendingAction === 'select' || (pendingAction !== 'delete' && isCurrentlySelected);
                        const displayAsPendingDelete = pendingAction === 'delete';

                        const cellTypeId = displaySelected ? (pendingAction === 'select' ? currentType : selectedCells.get(cellId)) : 'unavailable';
                        const cellTypeSetting = settings?.availability_types?.find(t => t.id === cellTypeId);
                        const cellColor = displaySelected ? (cellTypeSetting?.color || '#22c55e') : '#ef4444';

                        const cumulativeHours = calculateCumulativeHours(day, hour);

                        return (
                          <TableCell
                            key={cellId}
                            className={cn(
                              "relative p-0 h-12 w-12 transition-colors cursor-pointer select-none",
                              "border border-muted",
                              (displaySelected || displayAsPendingDelete) && "border-primary",
                              displayAsPendingDelete && "opacity-75"
                            )}
                            style={{
                                backgroundColor: `${cellColor}${displaySelected ? '80' : (displayAsPendingDelete ? '40' : '20')}`
                            }}
                            onMouseDown={(e) => { e.preventDefault(); handleCellMouseDown(day, time); }}
                            onMouseEnter={() => handleCellMouseEnter(day, time)}
                          >
                            {displaySelected ? (
                              <>
                                <Check className="h-4 w-4 mx-auto text-white" />
                                <div className="absolute bottom-0 right-1 text-[10px] text-white">
                                   {cumulativeHours.get(selectedCells.get(cellId) || '') || 0}
                                </div>
                              </>
                            ) : (
                              <X className="h-3 w-3 mx-auto text-gray-400 opacity-25" />
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isLoadingAvailabilities}>
              {isLoadingAvailabilities ? "Loading..." : "Save"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
