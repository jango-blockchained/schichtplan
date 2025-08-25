import { PageHeader } from "@/components/PageHeader";
import { ShiftTable } from "@/components/tables";
import { useToast } from "@/components/ui/use-toast";
import { DEFAULT_SETTINGS } from "@/hooks/useSettings";
import {
  Shift,
  createShift,
  deleteShift,
  getSettings,
  getShifts,
  updateShift,
} from "@/services/api";
import { Settings } from "@/types";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import React, { useEffect, useState } from "react";

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
    if (!settings || !settings.employee_groups) {
      toast({
        title: "Error",
        description: "Settings not loaded completely. Cannot add shift.",
        variant: "destructive",
      });
      return;
    }

    try {
      const defaultShiftTypeId =
        settings.employee_groups.shift_types && settings.employee_groups.shift_types.length > 0
          ? settings.employee_groups.shift_types[0].id
          : "EARLY";

      const generalSettings = settings.general || DEFAULT_SETTINGS.general;

      const defaultShift = {
        start_time: generalSettings.store_opening || "09:00",
        end_time: generalSettings.store_closing || "17:00",
        requires_break: true,
        active_days: Object.keys(generalSettings.opening_days || {})
          .filter(key => generalSettings.opening_days?.[key])
          .map(key => parseInt(key)),
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

  const handleDeleteShift = async (shift: Shift) => {
    if (window.confirm(`Delete shift ${shift.start_time} - ${shift.end_time}?`)) {
      try {
        await deleteShift(shift.id);
        setShifts((prev) => prev.filter((s) => s.id !== shift.id));
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
    }
  };

  const handleDuplicateShift = async (shift: Shift) => {
    try {
      const duplicatedShift = {
        start_time: shift.start_time,
        end_time: shift.end_time,
        requires_break: shift.requires_break,
        active_days: shift.active_days,
        shift_type_id: shift.shift_type_id,
      };

      const newShift = await createShift(duplicatedShift);
      setShifts((prev) => [...prev, newShift]);
      toast({
        title: "Success",
        description: "Shift duplicated successfully",
      });
    } catch (error) {
      console.error("Error duplicating shift:", error);
      toast({
        title: "Error",
        description: "Failed to duplicate shift",
        variant: "destructive",
      });
    }
  };

  const shiftTypes = settings?.employee_groups?.shift_types || [];

  return (
    <div className="container mx-auto py-6 space-y-8">
      <PageHeader
        title="Schichten"
        description="Verwalte die Schichten für deinen Betrieb"
        actions={
          <Button onClick={handleAddShift}>
            <Plus className="mr-2 h-4 w-4" />
            Schicht hinzufügen
          </Button>
        }
      />

      <ShiftTable
        shifts={shifts}
        shiftTypes={shiftTypes}
        loading={loading}
        error={loading ? null : ""}
        onEdit={handleUpdateShift}
        onDelete={handleDeleteShift}
        onDuplicate={handleDuplicateShift}
      />
    </div>
  );
};
