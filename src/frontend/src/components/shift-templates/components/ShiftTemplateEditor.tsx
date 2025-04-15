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
import { Plus, Edit2, Trash2, BugPlay } from "lucide-react";
import { Settings } from "@/types";
import { Shift, testShiftUpdate } from "@/services/api";
import { ShiftTemplateForm } from "./ShiftTemplateForm";
import { ShiftTemplateEditorProps } from "../types";
import LogService from "@/services/logService";

// Create an instance of the logger
const logger = new LogService();
const MODULE_NAME = "ShiftTemplateEditor";

export const ShiftTemplateEditor: React.FC<ShiftTemplateEditorProps> = ({
  shifts,
  settings,
  onAddShift,
  onUpdateShift,
  onDeleteShift,
  onEmployeeCountChange,
}) => {
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [isDebugMode, setIsDebugMode] = useState(false);

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
      logger.error(MODULE_NAME, "formatTime", "Error formatting time", error);
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

  // Helper function to debug API calls
  const debugApiCall = async (updatedShift: Shift) => {
    try {
      // Ensure active_days is a proper JavaScript object
      let activeDays = updatedShift.active_days;
      if (typeof activeDays === 'string') {
        try {
          activeDays = JSON.parse(activeDays);
        } catch (e) {
          logger.error(MODULE_NAME, "debugApiCall", "Failed to parse active_days string", e);
        }
      }
      
      // Create a simplified payload for testing that matches exactly what the backend expects
      const testPayload = {
        // Format times as plain HH:MM format without seconds - the backend validation expects this
        start_time: updatedShift.start_time.split(":").slice(0, 2).join(":"),
        end_time: updatedShift.end_time.split(":").slice(0, 2).join(":"),
        // Convert boolean to integer (0/1) for SQLite compatibility
        requires_break: updatedShift.requires_break ? 1 : 0,
        // Keep active_days as a JavaScript object (not a string)
        active_days: activeDays,
        // Include shift_type_id if present
        ...(updatedShift.shift_type_id && { shift_type_id: updatedShift.shift_type_id }),
        // Include name if present
        ...(updatedShift.name && { name: updatedShift.name }),
        // Include type if present (lowercase shift_type_id)
        ...(updatedShift.shift_type_id && { type: updatedShift.shift_type_id.toLowerCase() }),
        // Include duration_hours if present
        ...(updatedShift.duration_hours && { duration_hours: updatedShift.duration_hours }),
        // Include break_duration if present
        ...(updatedShift.break_duration && { break_duration: updatedShift.break_duration })
      };
      
      logger.debug(MODULE_NAME, "debugApiCall", "Attempting debug API call with payload", testPayload);
      const result = await testShiftUpdate(updatedShift.id, testPayload);
      logger.debug(MODULE_NAME, "debugApiCall", "Debug API call result", result);
      
      // If successful, update the UI
      if (result && (result.success || result.id)) {
        alert("Debug save successful! See console for details.");
        onUpdateShift && onUpdateShift(updatedShift);
        setEditingShift(null);
      } else {
        alert("Debug save failed. See console for details.");
      }
    } catch (error) {
      logger.error(MODULE_NAME, "debugApiCall", "Debug API call failed", error);
      alert("Debug API call error: " + (error instanceof Error ? error.message : String(error)));
    }
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
                    
                    // Create a properly formatted API payload following the successful debug pattern
                    const apiPayload = {
                      ...updatedShift,
                      // Format times as HH:MM (without seconds) to match backend validation
                      start_time: updatedShift.start_time.split(":").slice(0, 2).join(":"),
                      end_time: updatedShift.end_time.split(":").slice(0, 2).join(":"),
                      // SQLite expects requires_break as integer (0/1)
                      requires_break: updatedShift.requires_break ? 1 : 0,
                    };
                    
                    // Recalculate duration_hours based on current times
                    apiPayload.duration_hours = calculateDuration(
                      apiPayload.start_time,
                      apiPayload.end_time
                    );
                    
                    // Calculate break duration if not already present
                    if (apiPayload.requires_break && !apiPayload.break_duration) {
                      if (apiPayload.duration_hours >= 8) {
                        apiPayload.break_duration = 60;
                      } else if (apiPayload.duration_hours >= 6) {
                        apiPayload.break_duration = 30;
                      } else {
                        apiPayload.break_duration = 0;
                      }
                    } else if (!apiPayload.requires_break) {
                      apiPayload.break_duration = 0; // Explicitly set to 0 when no break is required
                    }
                    
                    // Ensure active_days is properly formatted
                    if (apiPayload.active_days && typeof apiPayload.active_days === 'object') {
                      // Make sure all days (0-6) have a boolean value
                      for (let i = 0; i < 7; i++) {
                        if (apiPayload.active_days[i.toString()] === undefined) {
                          apiPayload.active_days[i.toString()] = false;
                        }
                      }
                    }
                    
                    // Log the data being sent to the API
                    logger.debug(MODULE_NAME, "updateShift", "Updating shift with data", apiPayload);
                    
                    onUpdateShift(apiPayload);
                  }
                  setEditingShift(null);
                }}
              />
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button variant="outline" onClick={() => setEditingShift(null)} className="mr-2">
                Cancel
              </Button>
              {isDebugMode && (
                <Button 
                  variant="secondary"
                  onClick={() => editingShift && debugApiCall(editingShift)}
                  className="mr-2"
                >
                  Debug Save
                </Button>
              )}
              <Button 
                variant="default" 
                onClick={() => setIsDebugMode(!isDebugMode)}
                className="mr-2"
              >
                {isDebugMode ? "Normal Mode" : "Debug Mode"}
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
