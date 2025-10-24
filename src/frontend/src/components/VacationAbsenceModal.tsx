import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Absence, AbsenceType, Employee } from "@/types";
import { format } from "date-fns";
import { useState, useEffect } from "react";

interface VacationAbsenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  absenceTypes: AbsenceType[];
  absence?: Absence;
  onSubmit: (data: Omit<Absence, "id">) => void;
  isLoading?: boolean;
}

export function VacationAbsenceModal({
  open,
  onOpenChange,
  employees,
  absenceTypes,
  absence,
  onSubmit,
  isLoading = false,
}: VacationAbsenceModalProps) {
  const [formData, setFormData] = useState<Omit<Absence, "id">>({
    employee_id: absence?.employee_id || 0,
    absence_type_id: absence?.absence_type_id || "",
    start_date: absence?.start_date || format(new Date(), "yyyy-MM-dd"),
    end_date: absence?.end_date || format(new Date(), "yyyy-MM-dd"),
    note: absence?.note || "",
  });

  useEffect(() => {
    if (absence) {
      setFormData({
        employee_id: absence.employee_id,
        absence_type_id: absence.absence_type_id,
        start_date: absence.start_date,
        end_date: absence.end_date,
        note: absence.note || "",
      });
    }
  }, [absence]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.employee_id || !formData.absence_type_id) {
      return;
    }

    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      return;
    }

    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {absence ? "Abwesenheit bearbeiten" : "Neue Abwesenheit"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="employee">Mitarbeiter</Label>
              <Select
                value={formData.employee_id.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, employee_id: Number(value) })
                }
                disabled={!!absence}
              >
                <SelectTrigger id="employee">
                  <SelectValue placeholder="Mitarbeiter auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id.toString()}>
                      {emp.first_name} {emp.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="absence_type">Typ</Label>
              <Select
                value={formData.absence_type_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, absence_type_id: value })
                }
              >
                <SelectTrigger id="absence_type">
                  <SelectValue placeholder="Typ auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {absenceTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Von</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date">Bis</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) =>
                    setFormData({ ...formData, end_date: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Notiz (optional)</Label>
              <Textarea
                id="note"
                value={formData.note}
                onChange={(e) =>
                  setFormData({ ...formData, note: e.target.value })
                }
                placeholder="Zusätzliche Informationen..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isLoading}>
              {absence ? "Speichern" : "Erstellen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
