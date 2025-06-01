import React, { useState, useEffect, useRef, useMemo } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, PencilIcon, CheckSquare, Square, Edit3 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { CoverageEditorProps, DailyCoverage, StoreConfigProps, CoverageTimeSlot, BlockIdentifier, BulkEditData } from "../types";
import { DAYS_SHORT, GRID_CONSTANTS } from "../utils/constants";
import { DayRow } from "./DayRow";
import { BulkEditDialog } from "./BulkEditDialog";
import { timeToMinutes, minutesToTime } from "../utils/time";

const { TIME_COLUMN_WIDTH, TIME_ROW_HEIGHT, HEADER_HEIGHT } = GRID_CONSTANTS;

interface CoverageSlot {
  startTime: string;
  endTime: string;
  minEmployees: number;
  maxEmployees: number;
  employeeTypes: string[];
  requiresKeyholder: boolean;
  keyholderBeforeMinutes: number;
  keyholderAfterMinutes: number;
}

// Helper function to normalize store config
const normalizeStoreConfig = (config: any): StoreConfigProps => {
  // Handle undefined or null config
  if (!config) {
    return {
      store_opening: "09:00",
      store_closing: "20:00",
      opening_days: {
        "0": true, // Monday (now using Monday=0 convention)
        "1": true, // Tuesday
        "2": true, // Wednesday
        "3": true, // Thursday
        "4": true, // Friday
        "5": true, // Saturday
        "6": false, // Sunday
      },
      min_employees_per_shift: 1,
      max_employees_per_shift: 3,
      employee_types: [],
      keyholder_before_minutes: 30,
      keyholder_after_minutes: 30,
    };
  }

  // If the config has a 'general' property, it's using the Settings type
  if (config.general) {
    return {
      store_opening: config.general.store_opening || "09:00",
      store_closing: config.general.store_closing || "20:00",
      opening_days: config.general.opening_days || {
        "0": true,
        "1": true,
        "2": true,
        "3": true,
        "4": true,
        "5": true,
        "6": false,
      },
      min_employees_per_shift: config.scheduling?.min_employees_per_shift ?? 1,
      max_employees_per_shift: config.scheduling?.max_employees_per_shift ?? 3,
      employee_types: config.employee_groups?.employee_types ?? [],
      keyholder_before_minutes: config.general.keyholder_before_minutes ?? 30,
      keyholder_after_minutes: config.general.keyholder_after_minutes ?? 30,
    };
  }

  // If it's already in StoreConfigProps format, ensure all properties have values
  return {
    store_opening: config.store_opening || "09:00",
    store_closing: config.store_closing || "20:00",
    opening_days: config.opening_days || {
      "0": true,
      "1": true,
      "2": true,
      "3": true,
      "4": true,
      "5": true,
      "6": false,
    },
    min_employees_per_shift: config.min_employees_per_shift ?? 1,
    max_employees_per_shift: config.max_employees_per_shift ?? 3,
    employee_types: config.employee_types ?? [],
    keyholder_before_minutes: config.keyholder_before_minutes ?? 30,
    keyholder_after_minutes: config.keyholder_after_minutes ?? 30,
  };
};

// Helper function to create a default DailyCoverage item for a day
const createDefaultDailyCoverage = (dayIndex: number): DailyCoverage => ({
  dayIndex,
  timeSlots: [],
});

export const CoverageEditor: React.FC<CoverageEditorProps> = ({
  initialCoverage,
  storeConfig: rawStoreConfig,
  onChange,
}) => {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);
  
  // Selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedBlocks, setSelectedBlocks] = useState<Set<string>>(new Set());
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);

  const storeConfig = useMemo(
    () => normalizeStoreConfig(rawStoreConfig),
    [rawStoreConfig],
  );

  const [openingMinEmployees, setOpeningMinEmployees] = useState(
    storeConfig.min_employees_per_shift,
  );
  const [closingMinEmployees, setClosingMinEmployees] = useState(
    storeConfig.min_employees_per_shift,
  );

  // Calculate opening days from settings
  const openingDays = React.useMemo(() => {
    return Object.entries(storeConfig.opening_days)
      .filter(([dayName, isOpen]) => isOpen) // Filter for days that are open
      .map(([dayName]) => { // Map day names to numeric indices (Monday=0, Sunday=6)
        const lowerDayName = dayName.toLowerCase();
        switch (lowerDayName) {
          case 'monday': return 0;
          case 'tuesday': return 1;
          case 'wednesday': return 2;
          case 'thursday': return 3;
          case 'friday': return 4;
          case 'saturday': return 5;
          case 'sunday': return 6;
          default: return -1; // Should not happen with valid data
        }
      })
      .filter(dayIndex => dayIndex !== -1) // Remove any invalid entries
      .sort((a, b) => a - b);
  }, [storeConfig.opening_days]);

  useEffect(() => {
    // Log storeConfig.opening_days and openingDays after storeConfig is available
    if (storeConfig) {
      console.log('DEBUG: storeConfig.opening_days', storeConfig.opening_days);
      console.log('DEBUG: calculated openingDays', openingDays);
    }
  }, [storeConfig, openingDays]); // Depend on storeConfig and openingDays

  // Calculate hours array
  const hours = React.useMemo(() => {
    // Ensure we have valid store hours
    if (!storeConfig?.store_opening || !storeConfig?.store_closing) {
      return [
        "09:00",
        "10:00",
        "11:00",
        "12:00",
        "13:00",
        "14:00",
        "15:00",
        "16:00",
        "17:00",
        "18:00",
        "19:00",
        "20:00",
      ];
    }

    const [openingHour, openingMinute] = storeConfig.store_opening
      .split(":")
      .map(Number);
    const [closingHour, closingMinute] = storeConfig.store_closing
      .split(":")
      .map(Number);

    // Calculate the number of hours needed (including partial hours)
    const totalHours =
      closingHour - openingHour + (closingMinute >= openingMinute ? 1 : 0);

    return Array.from({ length: totalHours }, (_, i) => {
      const hour = (openingHour + i).toString().padStart(2, "0");
      return `${hour}:00`;
    });
  }, [storeConfig?.store_opening, storeConfig?.store_closing]);

  // Initialize coverage state, ensuring all days (0-6) are present
  const [coverage, setCoverage] = useState<DailyCoverage[]>(() => {
    const coverageMap = new Map<number, DailyCoverage>();
    if (initialCoverage) {
      // Use initialCoverage directly (assuming it's DailyCoverage[])
      initialCoverage.forEach(item => coverageMap.set(item.dayIndex, item));
    }
    // Ensure all 7 days are in the map, adding default if missing
    for (let i = 0; i < 7; i++) {
      if (!coverageMap.has(i)) {
        coverageMap.set(i, createDefaultDailyCoverage(i));
      }
    }
    // Sort by dayIndex to maintain consistent order
    return Array.from(coverageMap.values()).sort((a, b) => a.dayIndex - b.dayIndex);
  });

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setGridWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const handleAddSlot = (dayIndex: number, hour: number) => {
    const storeOpeningHour = parseInt(storeConfig.store_opening.split(":")[0]);
    const storeClosingHour = parseInt(storeConfig.store_closing.split(":")[0]);
    const storeOpeningMinutes = parseInt(
      storeConfig.store_opening.split(":")[1],
    );
    const storeClosingMinutes = parseInt(
      storeConfig.store_closing.split(":")[1],
    );

    // Get the hour from the hours array
    const hourString = hours[hour];
    const startHour = parseInt(hourString.split(":")[0]);
    const startMinutes = parseInt(hourString.split(":")[1] || "0");

    // Calculate start time
    const startTime = `${startHour.toString().padStart(2, "0")}:${startMinutes.toString().padStart(2, "0")}`;

    // Calculate end time - either next hour or store closing time
    const endHour = Math.min(startHour + 1, storeClosingHour);
    const endMinutes =
      endHour === storeClosingHour ? storeClosingMinutes : startMinutes;
    const endTime = `${endHour.toString().padStart(2, "0")}:${endMinutes.toString().padStart(2, "0")}`;

    if (startHour >= storeClosingHour) {
      return; // Don't add slots outside opening hours
    }

    // Determine if this is an opening or closing shift
    const isEarlyShift = startTime === storeConfig.store_opening;
    const isLateShift = endTime === storeConfig.store_closing;

    const newCoverage = [...coverage];
    const newSlot = {
      startTime,
      endTime,
      minEmployees: storeConfig.min_employees_per_shift,
      maxEmployees: storeConfig.max_employees_per_shift,
      employeeTypes: storeConfig.employee_types.map((t) => t.id),
      requiresKeyholder: isEarlyShift || isLateShift,
      keyholderBeforeMinutes: isEarlyShift
        ? storeConfig.keyholder_before_minutes
        : 0,
      keyholderAfterMinutes: isLateShift
        ? storeConfig.keyholder_after_minutes
        : 0,
    };

    // Check if there's already a slot at this time
    const hasConflict = newCoverage[dayIndex].timeSlots.some((slot) => {
      const slotStartMinutes = timeToMinutes(slot.startTime);
      const slotEndMinutes = timeToMinutes(slot.endTime);
      const newStartMinutes = timeToMinutes(startTime);
      const newEndMinutes = timeToMinutes(endTime);
      return (
        newStartMinutes < slotEndMinutes && newEndMinutes > slotStartMinutes
      );
    });

    if (!hasConflict) {
      newCoverage[dayIndex].timeSlots.push(newSlot);
      setCoverage(newCoverage);
      onChange?.(newCoverage);
    }
  };

  const handleUpdateSlot = (
    dayIndex: number,
    slotIndex: number,
    updates: Partial<CoverageTimeSlot>,
  ) => {
    const newCoverage = [...coverage];
    newCoverage[dayIndex].timeSlots[slotIndex] = { ...newCoverage[dayIndex].timeSlots[slotIndex], ...updates };
    setCoverage(newCoverage);
    if (onChange) {
      onChange(newCoverage);
    }
  };

  const handleDeleteSlot = (dayIndex: number, slotIndex: number) => {
    const newCoverage = [...coverage];
    newCoverage[dayIndex].timeSlots.splice(slotIndex, 1);
    setCoverage(newCoverage);
    if (onChange) {
      onChange(newCoverage);
    }
  };

  // Selection management functions
  const handleBlockSelect = (dayIndex: number, slotIndex: number, selected: boolean) => {
    const blockKey = `${dayIndex}-${slotIndex}`;
    const newSelected = new Set(selectedBlocks);
    
    if (selected) {
      newSelected.add(blockKey);
    } else {
      newSelected.delete(blockKey);
    }
    
    setSelectedBlocks(newSelected);
  };

  const handleSelectAll = () => {
    const allBlocks = new Set<string>();
    coverage.forEach((day) => {
      day.timeSlots.forEach((_, slotIndex) => {
        allBlocks.add(`${day.dayIndex}-${slotIndex}`);
      });
    });
    setSelectedBlocks(allBlocks);
  };

  const handleClearSelection = () => {
    setSelectedBlocks(new Set());
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    if (!selectionMode) {
      setSelectedBlocks(new Set());
    }
  };

  // Bulk edit functionality
  const handleBulkEdit = () => {
    if (selectedBlocks.size === 0) {
      toast({
        title: "No blocks selected",
        description: "Please select at least one coverage block to edit.",
        variant: "destructive",
      });
      return;
    }
    setShowBulkEditDialog(true);
  };

  const handleBulkUpdate = (updates: BulkEditData) => {
    const newCoverage = [...coverage];
    const selectedBlockIds: BlockIdentifier[] = Array.from(selectedBlocks).map(blockKey => {
      const [dayIndex, slotIndex] = blockKey.split('-').map(Number);
      return { dayIndex, slotIndex };
    });

    selectedBlockIds.forEach(({ dayIndex, slotIndex }) => {
      const dayData = newCoverage.find(d => d.dayIndex === dayIndex);
      if (dayData && dayData.timeSlots[slotIndex]) {
        const slot = dayData.timeSlots[slotIndex];
        
        if (updates.minEmployees !== undefined) {
          slot.minEmployees = updates.minEmployees;
        }
        if (updates.maxEmployees !== undefined) {
          slot.maxEmployees = updates.maxEmployees;
        }
        if (updates.employeeTypes !== undefined) {
          slot.employeeTypes = updates.employeeTypes;
        }
        if (updates.requiresKeyholder !== undefined) {
          slot.requiresKeyholder = updates.requiresKeyholder;
        }
      }
    });

    setCoverage(newCoverage);
    if (onChange) {
      onChange(newCoverage);
    }

    toast({
      title: "Bulk update successful",
      description: `Updated ${selectedBlockIds.length} coverage blocks.`,
    });

    setSelectedBlocks(new Set());
    setSelectionMode(false);
  };

  const handleUpdateOpeningMinEmployees = (value: number) => {
    const newValue = Math.max(1, value);
    setOpeningMinEmployees(newValue);

    const newCoverage = coverage.map((day) => ({
      ...day,
      timeSlots: day.timeSlots.map((slot) => {
        if (slot.startTime === storeConfig.store_opening) {
          return {
            ...slot,
            minEmployees: newValue,
            maxEmployees: Math.max(slot.maxEmployees, newValue),
          };
        }
        return slot;
      }),
    }));

    setCoverage(newCoverage);
    onChange?.(newCoverage);
  };

  const handleUpdateClosingMinEmployees = (value: number) => {
    const newValue = Math.max(1, value);
    setClosingMinEmployees(newValue);

    const newCoverage = coverage.map((day) => ({
      ...day,
      timeSlots: day.timeSlots.map((slot) => {
        if (slot.endTime === storeConfig.store_closing) {
          return {
            ...slot,
            minEmployees: newValue,
            maxEmployees: Math.max(slot.maxEmployees, newValue),
          };
        }
        return slot;
      }),
    }));

    setCoverage(newCoverage);
    onChange?.(newCoverage);
  };

  const handleAddDefaultSlots = () => {
    let newCoverage = [...coverage];
    // Logic to add default slots based on store hours and min/max employees
    // This is a simplified example; actual logic might be more complex
    for (const day of newCoverage) {
      if (day.timeSlots.length === 0) {
        // Add a default slot if none exist for the day
        const defaultStartTime = storeConfig.store_opening;
        const defaultEndTime = storeConfig.store_closing;
        day.timeSlots.push({
          startTime: defaultStartTime,
          endTime: defaultEndTime,
          minEmployees: storeConfig.min_employees_per_shift,
          maxEmployees: storeConfig.max_employees_per_shift,
          employeeTypes: storeConfig.employee_types.map((t) => t.id),
          requiresKeyholder: false, // Or determine based on time
          keyholderBeforeMinutes: 0,
          keyholderAfterMinutes: 0,
        });
      }
    }
    setCoverage(newCoverage);
    if (onChange) {
      onChange(newCoverage);
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-4">
        <Card className="p-6">
          <div className="flex items-center justify-between border-b p-4 bg-card">
            <h2 className="text-lg font-semibold">
              Employee Coverage Requirements
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant={isEditing ? "secondary" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => setIsEditing(!isEditing)}
              >
                <PencilIcon className="h-4 w-4" />
                {isEditing ? "Done" : "Edit"}
              </Button>
              
              <Button
                variant={selectionMode ? "secondary" : "outline"}
                size="sm"
                className="gap-2"
                onClick={toggleSelectionMode}
              >
                {selectionMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                {selectionMode ? "Exit Select" : "Select"}
              </Button>

              {selectionMode && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    disabled={selectedBlocks.size === coverage.reduce((total, day) => total + day.timeSlots.length, 0)}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearSelection}
                    disabled={selectedBlocks.size === 0}
                  >
                    Clear
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2"
                    onClick={handleBulkEdit}
                    disabled={selectedBlocks.size === 0}
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit ({selectedBlocks.size})
                  </Button>
                </>
              )}

              {isEditing && !selectionMode && (
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2"
                  onClick={handleAddDefaultSlots}
                >
                  <Plus className="h-4 w-4" />
                  Add All
                </Button>
              )}
            </div>
          </div>

          <div ref={containerRef} className="overflow-auto relative">
            {/* Time header */}
            <div className="flex" style={{ height: HEADER_HEIGHT }}>
              <div
                style={{ width: TIME_COLUMN_WIDTH }}
                className="shrink-0 border-r border-border/50"
              />
              <div className="flex-1 flex relative border-b border-border/50">
                {hours.map((hour, i) => (
                  <div
                    key={hour}
                    className="flex-1 relative border-r border-border/50 flex items-center justify-center text-sm font-medium text-muted-foreground"
                  >
                    {hour}
                  </div>
                ))}
              </div>
            </div>

            {/* Days grid */}
            {openingDays.map((dayIndex) => (
              <DayRow
                key={dayIndex}
                dayName={DAYS_SHORT[dayIndex]}
                dayIndex={dayIndex}
                slots={
                  coverage.find((c) => c.dayIndex === dayIndex)?.timeSlots || []
                }
                hours={hours}
                onAddSlot={(hourIndex) => handleAddSlot(dayIndex, hourIndex)}
                onUpdateSlot={(slotIndex, updates) =>
                  handleUpdateSlot(dayIndex, slotIndex, updates)
                }
                onDeleteSlot={(slotIndex) =>
                  handleDeleteSlot(dayIndex, slotIndex)
                }
                isEditing={isEditing}
                gridWidth={gridWidth}
                storeConfig={storeConfig}
                selectedBlocks={selectedBlocks}
                onBlockSelect={handleBlockSelect}
                selectionMode={selectionMode}
              />
            ))}
          </div>
        </Card>

        {/* Minimum Employee Requirements Section */}
        <Card className="p-4">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">
              Minimum Employee Requirements
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="openingMin"
                  className="text-sm text-muted-foreground"
                >
                  Opening (incl. 1 keyholder)
                </label>
                <input
                  id="openingMin"
                  type="number"
                  min="1"
                  value={openingMinEmployees}
                  onChange={(e) =>
                    handleUpdateOpeningMinEmployees(
                      parseInt(e.target.value) || 1,
                    )
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm text-foreground bg-background disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="closingMin"
                  className="text-sm text-muted-foreground"
                >
                  Closing (incl. 1 keyholder)
                </label>
                <input
                  id="closingMin"
                  type="number"
                  min="1"
                  value={closingMinEmployees}
                  onChange={(e) =>
                    handleUpdateClosingMinEmployees(
                      parseInt(e.target.value) || 1,
                    )
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm text-foreground bg-background disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!isEditing}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              These settings will be applied to all opening and closing shifts
              respectively.
            </p>
          </div>
        </Card>

        {/* Bulk Edit Dialog */}
        <BulkEditDialog
          isOpen={showBulkEditDialog}
          onClose={() => setShowBulkEditDialog(false)}
          selectedBlocks={Array.from(selectedBlocks).map(blockKey => {
            const [dayIndex, slotIndex] = blockKey.split('-').map(Number);
            return { dayIndex, slotIndex };
          })}
          coverage={coverage}
          onBulkUpdate={handleBulkUpdate}
          storeConfig={storeConfig}
        />
      </div>
    </DndProvider>
  );
};
