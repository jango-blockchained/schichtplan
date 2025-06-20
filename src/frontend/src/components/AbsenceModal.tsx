import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { AbsenceType, Absence } from "@/types"; // Changed: Imported Absence directly from @/types
import { getAbsences, createAbsence, deleteAbsence } from "@/services/api";
import { DateTimePicker } from "@/components/ui/date-time-picker";

interface AbsenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: number;
  absenceTypes: AbsenceType[];
}

export default function AbsenceModal({
  isOpen,
  onClose,
  employeeId,
  absenceTypes,
}: AbsenceModalProps) {
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [newAbsence, setNewAbsence] = useState<Omit<Absence, "id">>({
    employee_id: employeeId,
    absence_type_id: "",
    start_date: "",
    end_date: "",
    note: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadAbsences();
    }
  }, [isOpen, employeeId]);

  const loadAbsences = async () => {
    try {
      const data = await getAbsences(employeeId);
      setAbsences(data);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to load absences",
        variant: "destructive",
      });
    }
  };

  const handleAddAbsence = async () => {
    try {
      await createAbsence(newAbsence);
      await loadAbsences();
      setNewAbsence({
        employee_id: employeeId,
        absence_type_id: "",
        start_date: "",
        end_date: "",
        note: "",
      });
      toast({
        title: "Success",
        description: "Absence added successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to add absence",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAbsence = async (absenceId: number) => {
    try {
      await deleteAbsence(absenceId, employeeId);
      await loadAbsences();
      toast({
        title: "Success",
        description: "Absence deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete absence",
        variant: "destructive",
      });
    }
  };

  const getAbsenceTypeName = (typeId: string) => {
    return absenceTypes.find((type) => type.id === typeId)?.name || "Unknown";
  };

  const getAbsenceTypeColor = (typeId: string) => {
    return absenceTypes.find((type) => type.id === typeId)?.color || "#000000";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Absences</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Absence Type</Label>
              {absenceTypes.length === 0 ? (
                <div className="text-sm text-muted-foreground p-2 border rounded">
                  No absence types configured. Please configure absence types in settings first.
                </div>
              ) : (
                <Select
                  value={newAbsence.absence_type_id}
                  onValueChange={(value) =>
                    setNewAbsence({
                      ...newAbsence,
                      absence_type_id: value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select absence type" />
                  </SelectTrigger>
                  <SelectContent>
                    {absenceTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: type.color }}
                          />
                          <span>{type.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <DateTimePicker
                date={
                  newAbsence.start_date && newAbsence.start_date.trim() !== ""
                    ? new Date(newAbsence.start_date)
                    : new Date()
                }
                setDate={(date) =>
                  setNewAbsence({
                    ...newAbsence,
                    start_date: date.toISOString().split("T")[0],
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <DateTimePicker
                date={
                  newAbsence.end_date && newAbsence.end_date.trim() !== ""
                    ? new Date(newAbsence.end_date)
                    : new Date()
                }
                setDate={(date) =>
                  setNewAbsence({
                    ...newAbsence,
                    end_date: date.toISOString().split("T")[0],
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Note</Label>
              <Input
                type="text"
                value={newAbsence.note || ""}
                onChange={(e) =>
                  setNewAbsence({
                    ...newAbsence,
                    note: e.target.value,
                  })
                }
                placeholder="Optional note"
              />
            </div>

            <Button
              onClick={handleAddAbsence}
              disabled={
                absenceTypes.length === 0 ||
                !newAbsence.absence_type_id ||
                !newAbsence.start_date ||
                !newAbsence.end_date
              }
            >
              Add Absence
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {absences.map((absence) => (
                <TableRow key={absence.id}>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor: getAbsenceTypeColor(
                            absence.absence_type_id,
                          ),
                        }}
                      />
                      <span>{getAbsenceTypeName(absence.absence_type_id)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(parseISO(absence.start_date), "P", { locale: de })}
                  </TableCell>
                  <TableCell>
                    {format(parseISO(absence.end_date), "P", { locale: de })}
                  </TableCell>
                  <TableCell>{absence.note}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAbsence(absence.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
