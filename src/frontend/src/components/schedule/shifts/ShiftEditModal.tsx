import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Schedule, Shift } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { getShifts } from "@/services/api";
import { EmployeeSelect } from "@/components/schedule/shared/EmployeeSelect";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { TimePicker } from "@/components/ui/time-picker";

interface ShiftEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule?: Schedule;
  onSave: (scheduleData: Partial<Schedule>) => Promise<void>;
  date?: Date;
}

export const ShiftEditModal = ({
  isOpen,
  onClose,
  schedule,
  onSave,
  date,
}: ShiftEditModalProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [tab, setTab] = useState<string>("basic");

  // Form state
  const [shiftData, setShiftData] = useState<Partial<Schedule>>({
    employee_id: schedule?.employee_id || 0,
    shift_id: schedule?.shift_id,
    shift_start: schedule?.shift_start || "",
    shift_end: schedule?.shift_end || "",
    notes: schedule?.notes || "",
    is_keyholder: schedule?.is_keyholder || false,
    role: schedule?.role || "",
    status: schedule?.status || "PENDING",
  });

  // Fetch shifts data
  const { data: shifts } = useQuery({
    queryKey: ["shifts"],
    queryFn: getShifts,
  });

  // Update form data when schedule changes
  useEffect(() => {
    if (schedule) {
      setShiftData({
        employee_id: schedule.employee_id,
        shift_id: schedule.shift_id,
        shift_start: schedule.shift_start || "",
        shift_end: schedule.shift_end || "",
        notes: schedule.notes || "",
        is_keyholder: schedule.is_keyholder || false,
        role: schedule.role || "",
        status: schedule.status || "PENDING",
      });
    } else {
      // Reset form for new schedule
      setShiftData({
        employee_id: 0,
        shift_id: shifts && shifts.length > 0 ? shifts[0].id : undefined,
        shift_start: shifts && shifts.length > 0 ? shifts[0].start_time : "",
        shift_end: shifts && shifts.length > 0 ? shifts[0].end_time : "",
        notes: "",
        is_keyholder: false,
        role: "",
        status: "PENDING",
      });
    }
  }, [schedule, shifts]);

  // Update shift start/end times when shift_id changes
  useEffect(() => {
    if (shiftData.shift_id && shifts) {
      const selectedShift = shifts.find(
        (shift) => shift.id === shiftData.shift_id,
      );
      if (selectedShift) {
        setShiftData((prev) => ({
          ...prev,
          shift_start: selectedShift.start_time,
          shift_end: selectedShift.end_time,
        }));
      }
    }
  }, [shiftData.shift_id, shifts]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setShiftData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (name: string, checked: boolean) => {
    setShiftData((prev) => ({ ...prev, [name]: checked }));
  };

  const handleEmployeeChange = (employeeId: number) => {
    setShiftData((prev) => ({ ...prev, employee_id: employeeId }));
  };

  const handleShiftChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const shiftId = parseInt(e.target.value);
    setShiftData((prev) => ({ ...prev, shift_id: shiftId }));
  };

  const handleTimeChange = (name: string, value: string) => {
    setShiftData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!shiftData.employee_id || !shiftData.shift_id) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie einen Mitarbeiter und eine Schicht aus.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);

      // Include date if it's a new schedule
      const saveData = {
        ...shiftData,
        date: date ? format(date, "yyyy-MM-dd") : schedule?.date,
      };

      await onSave(saveData);

      toast({
        title: "Erfolg",
        description: schedule
          ? "Schicht wurde aktualisiert"
          : "Schicht wurde erstellt",
      });

      onClose();
    } catch (error) {
      toast({
        title: "Fehler",
        description:
          "Die Schicht konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>
            {schedule ? "Schicht bearbeiten" : "Neue Schicht"}
          </DialogTitle>
          <DialogDescription>
            {schedule
              ? "Bearbeiten Sie die Schichtdetails unten."
              : "Erstellen Sie eine neue Schicht für den ausgewählten Tag."}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">Grunddaten</TabsTrigger>
            <TabsTrigger value="advanced">Erweitert</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 pt-4">
            <div className="grid gap-4">
              {/* Employee selection */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="employee" className="text-right">
                  Mitarbeiter
                </Label>
                <div className="col-span-3">
                  <EmployeeSelect
                    value={shiftData.employee_id || null}
                    onChange={handleEmployeeChange}
                  />
                </div>
              </div>

              {/* Shift selection */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="shift" className="text-right">
                  Schichtvorlage
                </Label>
                <select
                  id="shift"
                  className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={shiftData.shift_id || ""}
                  onChange={handleShiftChange}
                >
                  {shifts?.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name} ({shift.start_time} - {shift.end_time})
                    </option>
                  ))}
                </select>
              </div>

              {/* Time inputs */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="shift_start" className="text-right">
                  Startzeit
                </Label>
                <div className="col-span-3">
                  <TimePicker
                    value={shiftData.shift_start || ""}
                    onChange={(value) => handleTimeChange("shift_start", value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="shift_end" className="text-right">
                  Endzeit
                </Label>
                <div className="col-span-3">
                  <TimePicker
                    value={shiftData.shift_end || ""}
                    onChange={(value) => handleTimeChange("shift_end", value)}
                  />
                </div>
              </div>

              {/* Notes input */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="notes" className="text-right">
                  Notizen
                </Label>
                <Input
                  id="notes"
                  name="notes"
                  value={shiftData.notes}
                  onChange={handleInputChange}
                  className="col-span-3"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 pt-4">
            <div className="grid gap-4">
              {/* Keyholder checkbox */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="is_keyholder" className="text-right">
                  Schlüsselträger
                </Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_keyholder"
                    checked={shiftData.is_keyholder}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange("is_keyholder", checked as boolean)
                    }
                  />
                  <label
                    htmlFor="is_keyholder"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Ist Schlüsselträger
                  </label>
                </div>
              </div>

              {/* Role input */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="role" className="text-right">
                  Rolle
                </Label>
                <Input
                  id="role"
                  name="role"
                  value={shiftData.role}
                  onChange={handleInputChange}
                  className="col-span-3"
                />
              </div>

              {/* Status selection */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">
                  Status
                </Label>
                <select
                  id="status"
                  className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={shiftData.status || "PENDING"}
                  onChange={(e) =>
                    setShiftData((prev) => ({
                      ...prev,
                      status: e.target.value,
                    }))
                  }
                >
                  <option value="PENDING">Ausstehend</option>
                  <option value="CONFIRMED">Bestätigt</option>
                  <option value="DECLINED">Abgelehnt</option>
                </select>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Abbrechen</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Speichern..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
