import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Shift } from "@/services/api";
import { Edit2, Plus, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { ShiftEditorProps } from "../types";
import { ShiftForm } from "./ShiftForm";
import ShiftListTable from "./ShiftListTable";

export const ShiftEditor: React.FC<ShiftEditorProps> = ({
  shifts,
  settings,
  onAddShift,
  onUpdateShift,
  onDeleteShift,
}) => {
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  // IMPORTANT: The application uses the Python convention where Monday=0, Sunday=6
  // This is different from JavaScript's Date where Sunday=0
  const getDayNames = (activeDays: number[] | { [key: string]: boolean }) => {
    // Days ordered to match the Python/backend convention where Monday=0 through Sunday=6
    const days = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
    if (Array.isArray(activeDays)) {
      return activeDays.map(idx => days[idx]).join(", ");
    }
    return Object.entries(activeDays)
      .filter(([, isActive]) => isActive)
      .map(([day]) => days[parseInt(day)])
      .join(", ");
  };

  return (
    <>
      <div className="flex justify-between mb-4 items-center">
        <div className="flex items-center gap-2">
          <SegmentedControl
            value={viewMode}
            onChange={(val) => setViewMode(val as "cards" | "table")}
            className="bg-muted"
          >
            <SegmentedControl.Item value="cards">Cards</SegmentedControl.Item>
            <SegmentedControl.Item value="table">Table</SegmentedControl.Item>
          </SegmentedControl>
        </div>

        <div className="flex items-center gap-2">
          {onAddShift && (
            <Button onClick={onAddShift}>
              <Plus className="mr-2 h-4 w-4" /> Add Shift
            </Button>
          )}
        </div>
      </div>

      {viewMode === "cards" ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {shifts.map((shift) => (
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
      ) : (
        // Lazy-load a simple table view for shifts
        <div>
          {/* Import local component to avoid circular deps */}
          <ShiftListTable
            shifts={shifts}
            onEdit={(s) => setEditingShift(s)}
            onDelete={onDeleteShift}
          />
        </div>
      )}

      {shifts.length === 0 && (
        <Card>
          <CardContent className="text-center py-8 text-muted-foreground">
            No shifts defined. Click "Add Shift" to create one.
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
              <ShiftForm
                settings={settings}
                shift={editingShift}
                onSave={(data) => {
                  if (onUpdateShift) {
                    // Convert active_days object back to number[] if needed
                    const activeDays = Array.isArray(data.active_days)
                      ? data.active_days
                      : Object.entries(data.active_days || {})
                        .filter(([, v]) => v)
                        .map(([k]) => parseInt(k, 10));

                    onUpdateShift({
                      ...editingShift,
                      ...data,
                      active_days: activeDays,
                    });
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

// (no local helpers needed)
