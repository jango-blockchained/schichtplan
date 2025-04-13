import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { getEmployees, getShifts } from "@/services/api";
import { Calendar } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/components/ui/use-toast";

interface AddScheduleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSchedule: (data: {
    employee_id: number;
    date: string;
    shift_id: number;
    version: number;
  }) => Promise<void>;
  version: number;
  defaultDate?: Date;
}

// Definiere das Formularschema mit Zod
const formSchema = z.object({
  employee_id: z.string().min(1, "Ein Mitarbeiter muss ausgewählt werden"),
  date: z.date({
    required_error: "Ein Datum muss ausgewählt werden",
  }),
  shift_id: z.string().min(1, "Eine Schicht muss ausgewählt werden"),
});

export function AddScheduleDialog({
  isOpen,
  onClose,
  onAddSchedule,
  version,
  defaultDate,
}: AddScheduleDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // Fetche Mitarbeiter
  const { data: employees, isLoading: isLoadingEmployees } = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
  });
  
  // Fetche Schichten
  const { data: shifts, isLoading: isLoadingShifts } = useQuery({
    queryKey: ["shifts"],
    queryFn: getShifts,
  });

  // Setup Form mit react-hook-form und zod validator
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employee_id: "",
      date: defaultDate || new Date(),
      shift_id: "",
    },
  });

  // Setze das Standarddatum, wenn es sich ändert
  useEffect(() => {
    if (defaultDate) {
      form.setValue("date", defaultDate);
    }
  }, [defaultDate, form]);

  // Handle Form Submit
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsLoading(true);

      if (!version) {
        throw new Error("Keine Version ausgewählt");
      }

      // Konvertiere Werte zu den richtigen Typen
      const scheduleData = {
        employee_id: parseInt(values.employee_id),
        date: format(values.date, "yyyy-MM-dd"),
        shift_id: parseInt(values.shift_id),
        version: version,
      };

      // Validiere die Daten vor dem Senden
      if (isNaN(scheduleData.employee_id) || scheduleData.employee_id <= 0) {
        throw new Error("Ungültige Mitarbeiter-ID");
      }

      if (isNaN(scheduleData.shift_id) || scheduleData.shift_id <= 0) {
        throw new Error("Ungültige Schicht-ID");
      }

      // Prüfe, ob ein gültiges Datumsformat vorliegt
      if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduleData.date)) {
        throw new Error("Ungültiges Datumsformat");
      }

      console.log("Sende Schichtplan-Daten:", scheduleData);

      // Rufe die Callback-Funktion mit den Daten auf
      await onAddSchedule(scheduleData);
      
      // Zeige Erfolgsmeldung
      toast({
        title: "Schicht hinzugefügt",
        description: `Eine neue Schicht wurde für ${values.date.toLocaleDateString()} erstellt.`,
      });
      
      // Schließe Dialog und setze Form zurück
      resetAndClose();
    } catch (error) {
      console.error("Fehler beim Hinzufügen der Schicht:", error);
      
      // Zeige Fehlermeldung
      toast({
        title: "Fehler",
        description: error instanceof Error 
          ? error.message 
          : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Reset Form und schließe Dialog
  const resetAndClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && resetAndClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Neue Schicht hinzufügen</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Mitarbeiter Auswahl */}
            <FormField
              control={form.control}
              name="employee_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mitarbeiter</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoading || isLoadingEmployees}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Mitarbeiter auswählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {employees?.map((employee) => (
                        <SelectItem
                          key={employee.id}
                          value={employee.id.toString()}
                        >
                          {employee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Datum Auswahl */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Datum</FormLabel>
                  <DatePicker
                    date={field.value}
                    setDate={field.onChange}
                    disabled={isLoading}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Schicht Auswahl */}
            <FormField
              control={form.control}
              name="shift_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Schicht</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoading || isLoadingShifts}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Schicht auswählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {shifts?.map((shift) => (
                        <SelectItem
                          key={shift.id}
                          value={shift.id.toString()}
                        >
                          {shift.name || `${shift.start_time} - ${shift.end_time} (${shift.shift_type_id || 'Schicht'})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Debug Info - zeigt die Version an */}
            <div className="text-xs text-muted-foreground">
              Version: {version || 'Keine Version ausgewählt'}
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={resetAndClose}
                disabled={isLoading}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Wird hinzugefügt..." : "Hinzufügen"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
} 