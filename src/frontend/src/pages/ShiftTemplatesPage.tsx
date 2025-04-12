import React, { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { ShiftTemplateEditor } from "@/components/shift-templates/components/ShiftTemplateEditor";
import { Shift, getShiftTemplates, createShiftTemplate, updateShiftTemplate, deleteShiftTemplate } from "@/services/api";
import { useSettings } from "@/hooks/useSettings";

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

export default function ShiftTemplatesPage() {
  const [shiftTemplates, setShiftTemplates] = useState<Shift[]>([]);
  const { settings } = useSettings();
  const { toast } = useToast();

  useEffect(() => {
    const fetchShiftTemplates = async () => {
      try {
        const data = await getShiftTemplates();
        setShiftTemplates(data);
      } catch (error) {
        console.error("Failed to fetch shift templates:", error);
        toast({
          title: "Error",
          description: "Failed to fetch shift templates",
          variant: "destructive",
        });
      }
    };

    fetchShiftTemplates();
  }, [toast]);

  const handleAddShiftTemplate = async () => {
    if (!settings) return;

    try {
      // Default shift type
      const defaultShiftTypeId = "EARLY";

      // Ensure store times are in HH:MM format
      const formatTime = (time: string): string => {
        if (!time) return "";
        if (time.split(':').length > 2) {
          const parts = time.split(':');
          return `${parts[0]}:${parts[1]}`;
        }
        return time;
      };

      const defaultShiftTemplate = {
        start_time: formatTime(settings.store_opening),
        end_time: formatTime(settings.store_closing),
        requires_break: true,
        active_days: settings.opening_days,
        shift_type_id: defaultShiftTypeId,
      };

      const newShiftTemplate = await createShiftTemplate(defaultShiftTemplate);
      setShiftTemplates((prev) => [...prev, newShiftTemplate]);
      toast({
        title: "Success",
        description: "Shift template created successfully",
      });
    } catch (error) {
      console.error("Failed to create shift template:", error);
      toast({
        title: "Error",
        description: "Failed to create shift template",
        variant: "destructive",
      });
    }
  };

  const handleUpdateShiftTemplate = async (updatedShiftTemplate: Shift) => {
    try {
      console.log("Sending shift template update to API:", updatedShiftTemplate);
      
      // Ensure all required fields are present
      if (!updatedShiftTemplate.id) {
        throw new Error("Shift template ID is required for update");
      }
      
      const data = await updateShiftTemplate(updatedShiftTemplate);
      console.log("Shift template update successful, response:", data);
      
      setShiftTemplates((prevShiftTemplates) =>
        prevShiftTemplates.map((template) => (template.id === data.id ? data : template))
      );
      
      toast({
        title: "Success",
        description: "Shift template updated successfully",
      });
    } catch (error) {
      console.error("Failed to update shift template:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update shift template",
        variant: "destructive",
      });
    }
  };

  const handleDeleteShiftTemplate = async (id: number) => {
    try {
      await deleteShiftTemplate(id);
      setShiftTemplates((prevShiftTemplates) => prevShiftTemplates.filter((template) => template.id !== id));
      toast({
        title: "Success",
        description: "Shift template deleted successfully",
      });
    } catch (error) {
      console.error("Failed to delete shift template:", error);
      toast({
        title: "Error",
        description: "Failed to delete shift template",
        variant: "destructive",
      });
    }
  };

  if (!settings) {
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
        title="Schicht-Vorlagen"
        description="Verwalte die Schicht-Vorlagen für deinen Betrieb"
      />

      <ShiftTemplateEditor
        shifts={shiftTemplates}
        settings={settings}
        onAddShift={handleAddShiftTemplate}
        onUpdateShift={handleUpdateShiftTemplate}
        onDeleteShift={handleDeleteShiftTemplate}
      />
    </div>
  );
} 