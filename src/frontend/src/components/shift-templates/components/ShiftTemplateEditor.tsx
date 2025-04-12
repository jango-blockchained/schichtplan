import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { Settings } from "@/types";
import { Shift } from "@/services/api";
import { ShiftTemplateForm } from "./ShiftTemplateForm";
import { ShiftTemplateEditorProps } from "../types";

export const ShiftTemplateEditor: React.FC<ShiftTemplateEditorProps> = ({
  shifts,
  settings,
  onAddShift,
  onUpdateShift,
  onDeleteShift,
  onEmployeeCountChange,
}) => {
  const [editingShift, setEditingShift] = useState<Shift | null>(null);

  const formatTime = (time: string) => {
    // Ensure time is in a proper format for new Date()
    let timeString = time;
    if (!timeString.includes(':')) return ''; // Invalid time
    
    // Add seconds if needed for Date constructor
    if (timeString.split(':').length === 2) {
      timeString = `${timeString}:00`;
    }
    
    try {
      return new Date(`2000-01-01T${timeString}`).toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch (error) {
      console.error("Error formatting time:", error);
      return time; // Return the original time string as fallback
    }
  };

  const getDayNames = (activeDays: { [key: string]: boolean }) => {
    const days = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    return Object.entries(activeDays)
      .filter(([_, isActive]) => isActive)
      .map(([day]) => days[parseInt(day)])
      .join(", ");
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        {onAddShift && (
          <Button onClick={onAddShift}>
            <Plus className="mr-2 h-4 w-4" /> Add Shift
          </Button>
        )}
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {Array.isArray(shifts) && shifts.map((shift) => (
          <Card key={shift.id} className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg">Schicht {shift.id}</CardTitle>
              <CardDescription>
                {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Active Days:</span>{" "}
                  {getDayNames(shift.active_days)}
                </div>
                <div>
                  <span className="font-medium">Break Required:</span>{" "}
                  {shift.requires_break ? "Yes" : "No"}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2 mt-auto">
              {onDeleteShift && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDeleteShift(shift.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              {onUpdateShift && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingShift(shift)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      {Array.isArray(shifts) && shifts.length === 0 && (
        <Card>
          <CardContent className="text-center py-8 text-muted-foreground">
            No shifts defined. Click "Add Shift" to create one.
          </CardContent>
        </Card>
      )}

      {!Array.isArray(shifts) && (
        <Card>
          <CardContent className="text-center py-8 text-muted-foreground">
            Loading shifts...
          </CardContent>
        </Card>
      )}

      {editingShift && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Edit Shift {editingShift.id}</CardTitle>
            </CardHeader>
            <CardContent>
              <ShiftTemplateForm
                settings={settings}
                shift={editingShift}
                onSave={(updatedData) => {
                  if (onUpdateShift) {
                    // Preserve all important properties from the original shift
                    const updatedShift = {
                      ...editingShift,
                      ...updatedData,
                      id: editingShift.id, // Ensure ID is preserved
                      created_at: editingShift.created_at,
                      updated_at: editingShift.updated_at,
                    };
                    
                    // Ensure shift_type_id is uppercase
                    if (updatedShift.shift_type_id) {
                      updatedShift.shift_type_id = updatedShift.shift_type_id.toUpperCase();
                      // Ensure type field matches shift_type_id in lowercase
                      updatedShift.type = updatedShift.shift_type_id.toLowerCase();
                    }
                    
                    // Remove shift_type property if it exists
                    if ('shift_type' in updatedShift) {
                      delete updatedShift.shift_type;
                    }
                    
                    // Ensure a name is present
                    if (!updatedShift.name) {
                      const shiftTypeObj = settings?.shift_types?.find(
                        type => type.id === updatedShift.shift_type_id
                      );
                      updatedShift.name = shiftTypeObj?.name || `Shift ${updatedShift.id}`;
                    }
                    
                    // Ensure time values are properly formatted (HH:MM:SS for API)
                    if (updatedShift.start_time && updatedShift.start_time.includes(':')) {
                      if (updatedShift.start_time.split(':').length === 2) {
                        updatedShift.start_time = `${updatedShift.start_time}:00`;
                      }
                    }
                    
                    if (updatedShift.end_time && updatedShift.end_time.includes(':')) {
                      if (updatedShift.end_time.split(':').length === 2) {
                        updatedShift.end_time = `${updatedShift.end_time}:00`;
                      }
                    }
                    
                    // Calculate break duration if not already present
                    if (updatedShift.requires_break && !updatedShift.break_duration) {
                      if (updatedShift.duration_hours >= 8) {
                        updatedShift.break_duration = 60;
                      } else if (updatedShift.duration_hours >= 6) {
                        updatedShift.break_duration = 30;
                      }
                    }
                    
                    // Log the data being sent to the API
                    console.log("Updating shift with data:", updatedShift);
                    
                    onUpdateShift(updatedShift);
                  }
                  setEditingShift(null);
                }}
              />
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button variant="outline" onClick={() => setEditingShift(null)}>
                Cancel
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </>
  );
};

// Helper function to calculate duration in hours
const calculateDuration = (start_time: string, end_time: string): number => {
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const startMinutes = timeToMinutes(start_time);
  const endMinutes = timeToMinutes(end_time);
  let duration = endMinutes - startMinutes;
  if (duration < 0) duration += 24 * 60; // Handle overnight shifts
  return duration / 60;
};
