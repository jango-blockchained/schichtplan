import React, { useEffect, useState } from "react";
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
  EmployeeAvailability,
} from "@/services/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AvailabilityTypeSelect } from "@/components/common/AvailabilityTypeSelect";

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

// Helper function to convert backend day index (0=Sunday) to frontend index (0=Monday)
const convertBackendDayToFrontend = (backendDay: number): number => {
  return (backendDay + 6) % 7; // Shifts Sunday (0) to position 6
};

// Helper function to convert frontend day index (0=Monday) to backend index (0=Sunday)
const convertFrontendDayToBackend = (frontendDay: number): number => {
  return (frontendDay + 1) % 7; // Shifts Monday (0) to position 1
};

export const EmployeeAvailabilityModal: React.FC<
  EmployeeAvailabilityModalProps
> = ({
  employeeId,
  employeeName,
  employeeGroup,
  contractedHours,
  isOpen,
  onClose,
}) => {
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedCells, setSelectedCells] = useState<Map<string, string>>(
    new Map(),
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dailyHours, setDailyHours] = useState<{ [key: string]: number }>({});
  const [weeklyHours, setWeeklyHours] = useState(0);
  const [activeDays, setActiveDays] = useState<string[]>([]);
  const [currentType, setCurrentType] = useState<string>("AVL");

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  // Set initial availability type to the first available type from settings
  useEffect(() => {
    if (settings?.availability_types?.types) {
      const availableTypes = settings.availability_types.types.filter(
        (type) => type.is_available,
      );
      if (availableTypes.length > 0) {
        setCurrentType(availableTypes[0].id);
      }
    }
  }, [settings]);

  const { data: availabilities, refetch: refetchAvailabilities } = useQuery({
    queryKey: ["employee-availabilities", employeeId],
    queryFn: () => getEmployeeAvailabilities(employeeId),
  });

  useEffect(() => {
    // Initialize with empty selection and hours immediately
    setSelectedCells(new Map());
    setDailyHours({});
    setWeeklyHours(0);

    if (settings) {
      // Convert opening days from backend format (0=Sunday) to frontend format (0=Monday)
      const activeWeekDays = ALL_DAYS.filter((_, frontendIndex) => {
        const backendIndex = convertFrontendDayToBackend(frontendIndex);
        return settings.general.opening_days[backendIndex.toString()];
      });

      setActiveDays(activeWeekDays);

      const { store_opening, store_closing } = settings.general;
      const [startHour] = store_opening.split(":").map(Number);
      const [endHour] = store_closing.split(":").map(Number);

      const slots: TimeSlot[] = [];
      for (let hour = startHour; hour < endHour; hour++) {
        const nextHour = hour + 1;
        slots.push({
          time: `${format(new Date().setHours(hour, 0), TIME_FORMAT)} - ${format(new Date().setHours(nextHour, 0), TIME_FORMAT)}`,
          hour: hour,
          days: activeWeekDays.reduce(
            (acc, day) => ({ ...acc, [day]: false }),
            {},
          ),
        });
      }
      setTimeSlots(slots);
    }
  }, [settings]);

  useEffect(() => {
    if (!activeDays.length) return;

    const dayHours: { [key: string]: number } = {};
    activeDays.forEach((day) => {
      dayHours[day] = 0;
    });
    setDailyHours(dayHours);

    if (availabilities) {
      const newSelectedCells = new Map<string, string>();
      availabilities.forEach((availability) => {
        const frontendDayIndex = convertBackendDayToFrontend(
          availability.day_of_week,
        );
        const day = ALL_DAYS[frontendDayIndex];

        if (activeDays.includes(day)) {
          const hour = format(
            new Date().setHours(availability.hour, 0),
            TIME_FORMAT,
          );
          const nextHour = format(
            new Date().setHours(availability.hour + 1, 0),
            TIME_FORMAT,
          );
          const cellId = `${day}-${hour} - ${nextHour}`;
          // Only create entries for available hours with their specific type
          if (availability.is_available) {
            newSelectedCells.set(cellId, availability.availability_type);
          }
        }
      });
      setSelectedCells(newSelectedCells);
      calculateHours(newSelectedCells);
    }
  }, [availabilities, activeDays]);

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
    setIsDragging(true);
    const cellId = `${day}-${time}`;
    setDragStart(cellId);
    toggleCell(cellId);
  };

  const handleCellMouseEnter = (day: string, time: string) => {
    if (isDragging && dragStart) {
      const cellId = `${day}-${time}`;
      toggleCell(cellId);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
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

    // Count how many cells are selected for this day
    const dayCells = timeSlots.map(({ time }) => `${day}-${time}`);
    const selectedDayCells = dayCells.filter((cellId) =>
      selectedCells.has(cellId),
    );
    const selectedRatio = selectedDayCells.length / dayCells.length;

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
    // Create a Set of all possible cell IDs for quick lookup
    const allPossibleCellIds = new Set<string>();
    timeSlots.forEach(({ time }) => {
      activeDays.forEach((day) => {
        allPossibleCellIds.add(`${day}-${time}`);
      });
    });

    // Get all time slots that were not selected
    const unselectedCellIds = Array.from(allPossibleCellIds).filter(
      (cellId) => !selectedCells.has(cellId),
    );

    // Prepare availability data for selected cells
    const selectedAvailabilityData = Array.from(selectedCells.entries()).map(
      ([cellId, type]) => {
        const [day, timeRange] = cellId.split("-");
        const frontendDayIndex = ALL_DAYS.indexOf(day);
        const backendDayIndex = convertFrontendDayToBackend(frontendDayIndex);
        const [startTime] = timeRange.trim().split(" - ");
        const [hour] = startTime.split(":").map(Number);

        return {
          employee_id: employeeId,
          day_of_week: backendDayIndex,
          hour: hour,
          is_available: true,
          availability_type: type,
        };
      },
    );

    // Prepare availability data for unselected cells
    const unavailableAvailabilityData = unselectedCellIds.map((cellId) => {
      const [day, timeRange] = cellId.split("-");
      const frontendDayIndex = ALL_DAYS.indexOf(day);
      const backendDayIndex = convertFrontendDayToBackend(frontendDayIndex);
      const [startTime] = timeRange.trim().split(" - ");
      const [hour] = startTime.split(":").map(Number);

      return {
        employee_id: employeeId,
        day_of_week: backendDayIndex,
        hour: hour,
        is_available: false, // Mark as unavailable explicitly through the flag
        availability_type: "UNV", // Also set type to UNV for clarity
      };
    });

    // Combine both selected and unselected availability data
    const availabilityData = [
      ...selectedAvailabilityData,
      ...unavailableAvailabilityData,
    ];

    // Send the combined data to the backend
    await updateEmployeeAvailability(employeeId, availabilityData);
    await refetchAvailabilities();
    onClose();
  };

  const getCellColor = (cellId: string) => {
    if (!selectedCells.has(cellId)) return "";
    const type = selectedCells.get(cellId);
    const availabilityType = settings?.availability_types?.types.find(
      (t) => t.id === type,
    );
    return availabilityType?.color || "#22c55e";
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
      const [startTime] = time.split(" - ")[0].split(":").map(Number);
      if (startTime <= currentHour) {
        const cellId = `${day}-${time}`;
        const type = selectedCells.get(cellId);
        if (type) {
          stats.set(type, (stats.get(type) || 0) + 1);
        }
      }
    });
    return stats;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl" onMouseUp={handleMouseUp}>
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
                Array.from(calculateTypeStats()).map(([type, hours]) => {
                  const availabilityType =
                    settings.availability_types.types.find(
                      (t) => t.id === type,
                    );
                  return (
                    availabilityType && (
                      <div
                        key={type}
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
                        className="w-full"
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
                      const isSelected = selectedCells.has(cellId);
                      const cellType = isSelected
                        ? selectedCells.get(cellId)
                        : "UNV";
                      const cellColor = isSelected
                        ? getCellColor(cellId)
                        : settings?.availability_types?.types.find(
                            (t) => t.id === "UNV",
                          )?.color || "#ef4444";

                      // Calculate cumulative hours for this day up to current hour for the selected type
                      const cumulativeHours = calculateCumulativeHours(
                        day,
                        hour,
                      );

                      return (
                        <TableCell
                          key={`${day}-${time}`}
                          className={cn(
                            "relative p-0 h-12 w-12 transition-colors cursor-pointer",
                            isSelected
                              ? "border-2 border-primary"
                              : "border border-muted",
                          )}
                          style={{
                            backgroundColor: isSelected
                              ? `${cellColor}80` // Selected cells with 50% opacity
                              : `${cellColor}20`, // Unselected cells with 12.5% opacity to indicate "unavailable"
                          }}
                          onMouseDown={() => handleCellMouseDown(day, time)}
                          onMouseEnter={() => handleCellMouseEnter(day, time)}
                        >
                          {isSelected ? (
                            <>
                              <Check className="h-4 w-4 mx-auto text-white" />
                              <div className="absolute bottom-0 right-1 text-[10px] text-white">
                                {Array.from(cumulativeHours)
                                  .map(([type, count]) =>
                                    type === cellType ? count : null,
                                  )
                                  .filter(Boolean)
                                  .join("")}
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
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
