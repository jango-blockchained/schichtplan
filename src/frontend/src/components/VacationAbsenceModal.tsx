import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { validateVacationDates, type VacationValidationResult } from "@/services/api";
import { Absence, AbsenceType, Employee } from "@/types";
import { format } from "date-fns";
import { AlertTriangle, Calendar, Check, Clock, FileText, User, X } from "lucide-react";
import { useEffect, useState } from "react";

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
    status: absence?.status || "requested",
    note: absence?.note || "",
  });
  const [validation, setValidation] = useState<VacationValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    if (absence) {
      setFormData({
        employee_id: absence.employee_id,
        absence_type_id: absence.absence_type_id,
        start_date: absence.start_date,
        end_date: absence.end_date,
        status: absence.status,
        note: absence.note || "",
      });
      // Validate existing absence dates
      if (absence.start_date && absence.end_date) {
        validateDates(absence.start_date, absence.end_date);
      }
    }
  }, [absence]);

  const validateDates = async (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return;

    try {
      setIsValidating(true);
      const result = await validateVacationDates(startDate, endDate);
      setValidation(result);
    } catch (error) {
      console.error("Validation failed:", error);
      setValidation(null);
    } finally {
      setIsValidating(false);
    }
  };

  const handleDateChange = (field: "start_date" | "end_date", value: string) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    // Validate if both dates are set
    if (newFormData.start_date && newFormData.end_date) {
      validateDates(newFormData.start_date, newFormData.end_date);
    } else {
      setValidation(null);
    }
  };

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <Check className="h-4 w-4 text-emerald-600" />;
      case "declined":
        return <X className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-amber-600" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Calendar className="h-5 w-5" />
            {absence ? "Abwesenheit bearbeiten" : "Neue Abwesenheit"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="employee" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Mitarbeiter
              </Label>
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
              <Label htmlFor="absence_type" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Typ
              </Label>
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
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: type.color }}
                        />
                        {type.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Von
                </Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleDateChange("start_date", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Bis
                </Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => handleDateChange("end_date", e.target.value)}
                  required
                />
              </div>
            </div>

            {validation && validation.warnings.length > 0 && (
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-sm text-yellow-800">
                  <div className="font-medium mb-2">
                    {validation.working_days} Arbeitstag(e) von {validation.total_days} Tagen
                  </div>
                  {validation.closed_days > 0 && (
                    <div className="text-xs">
                      <div className="font-medium mb-1">Geschlossene Tage ({validation.closed_days}):</div>
                      {Object.entries(validation.closed_day_list).slice(0, 3).map(([date, info]) => (
                        <div key={date}>
                          {date} - {info.description}
                        </div>
                      ))}
                      {Object.keys(validation.closed_day_list).length > 3 && (
                        <div>... und {Object.keys(validation.closed_day_list).length - 3} weitere</div>
                      )}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="status" className="flex items-center gap-2">
                {getStatusIcon(formData.status)}
                Status
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Status auswählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="requested">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-600" />
                      Beantragt
                    </div>
                  </SelectItem>
                  <SelectItem value="approved">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-600" />
                      Genehmigt
                    </div>
                  </SelectItem>
                  <SelectItem value="declined">
                    <div className="flex items-center gap-2">
                      <X className="h-4 w-4 text-red-600" />
                      Abgelehnt
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Notiz (optional)
              </Label>
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
