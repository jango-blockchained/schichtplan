import React, { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { PageHeader } from "@/components/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { ShiftEditor } from "@/components/shifts-editor/components/ShiftEditor";
import { Settings } from "@/types";
import {
  Shift,
  getShifts,
  createShift,
  updateShift,
  deleteShift,
} from "@/services/api";
import { getSettings } from "@/services/api";

// Helper function to convert active_days from object to array if needed
const convertActiveDaysToArray = (activeDays: {
  [key: string]: boolean;
}): number[] => {
  return Object.entries(activeDays)
    .filter(([_, isActive]) => isActive)
    .map(([day]) => parseInt(day));
};

// Helper function to convert active_days from array to object if needed
const convertActiveDaysToObject = (
  activeDays: number[],
): { [key: string]: boolean } => {
  const result: { [key: string]: boolean } = {};
  for (let i = 0; i < 7; i++) {
    result[i.toString()] = activeDays.includes(i);
  }
  return result;
};

export const ShiftsPage: React.FC = () => {
  const { toast } = useToast();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [shiftsData, settingsData] = await Promise.all([
          getShifts(),
          getSettings(),
        ]);
        setShifts(shiftsData);
        setSettings(settingsData);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: "Error",
          description: "Failed to load shifts and settings",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  const handleAddShift = async () => {
    if (!settings) return;

    try {
      // Get the first shift type from settings or use a default
      const defaultShiftTypeId =
        settings.shift_types && settings.shift_types.length > 0
          ? settings.shift_types[0].id
          : "EARLY";

      const defaultShift = {
        start_time: settings.general.store_opening,
        end_time: settings.general.store_closing,
        requires_break: true,
        active_days: settings.general.opening_days,
        shift_type_id: defaultShiftTypeId,
      };

      const newShift = await createShift(defaultShift);
      setShifts((prev) => [...prev, newShift]);
      toast({
        title: "Success",
        description: "Shift created successfully",
      });
    } catch (error) {
      console.error("Error creating shift:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create shift",
        variant: "destructive",
      });
    }
  };

  const handleUpdateShift = async (updatedShift: Shift) => {
    try {
      const result = await updateShift(updatedShift);
      setShifts((prev) =>
        prev.map((shift) => (shift.id === result.id ? result : shift)),
      );
      toast({
        title: "Success",
        description: "Shift updated successfully",
      });
    } catch (error) {
      console.error("Error updating shift:", error);
      toast({
        title: "Error",
        description: "Failed to update shift",
        variant: "destructive",
      });
    }
  };

  const handleDeleteShift = async (shiftId: number) => {
    try {
      await deleteShift(shiftId);
      setShifts((prev) => prev.filter((shift) => shift.id !== shiftId));
      toast({
        title: "Success",
        description: "Shift deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting shift:", error);
      toast({
        title: "Error",
        description: "Failed to delete shift",
        variant: "destructive",
      });
    }
  };

  if (loading || !settings) {
    return (
      <div className="container mx-auto py-6 space-y-8">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-8">
      <PageHeader
        title="Schichten"
        description="Verwalte die Schichten für deinen Betrieb"
      />

      <ShiftEditor
        shifts={shifts}
        settings={settings}
        onAddShift={handleAddShift}
        onUpdateShift={handleUpdateShift}
        onDeleteShift={handleDeleteShift}
      />
    </div>
  );
};
