import { Loader2, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { ColorPicker } from "./ui/color-picker";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "./ui/table";

export interface ShiftType {
  id: "EARLY" | "MIDDLE" | "LATE" | "NO_WORK" | "UNAVAILABLE";
  name: string;
  color: string;
  type: "shift_type";
  autoAssignOnly?: boolean;
}

const defaultShiftTypes: ShiftType[] = [
  { id: "EARLY", name: "Früh", color: "#22c55e", type: "shift_type" },
  { id: "MIDDLE", name: "Mitte", color: "#3b82f6", type: "shift_type" },
  { id: "LATE", name: "Spät", color: "#f59e0b", type: "shift_type" },
  {
    id: "NO_WORK",
    name: "Kein Dienst",
    color: "#9E9E9E",
    type: "shift_type",
    autoAssignOnly: true,
  },
  {
    id: "UNAVAILABLE",
    name: "Nicht verfügbar",
    color: "#ef4444",
    type: "shift_type",
    autoAssignOnly: true,
  },
];

interface ShiftTypesEditorProps {
  shiftTypes: ShiftType[];
  onChange: (shiftTypes: ShiftType[]) => void;
  isLoading?: boolean; // Add isLoading prop
}

export default function ShiftTypesEditor({
  shiftTypes = defaultShiftTypes,
  onChange,
  isLoading, // Destructure isLoading
}: ShiftTypesEditorProps) {
  const [localShiftTypes, setLocalShiftTypes] =
    useState<ShiftType[]>(shiftTypes);
  const [editingType, setEditingType] = useState<ShiftType | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce onChange to prevent too many updates
  const debouncedOnChange = useDebouncedCallback((newTypes: ShiftType[]) => {
    onChange(newTypes);
  }, 500);

  // Update parent when local state changes
  React.useEffect(() => {
    debouncedOnChange(localShiftTypes);
  }, [localShiftTypes, debouncedOnChange]);

  // Update local state when props change
  React.useEffect(() => {
    setLocalShiftTypes(shiftTypes);
  }, [shiftTypes]);

  const handleEditType = (type: ShiftType) => {
    // Don't allow editing of autoAssignOnly shift types
    if (type.autoAssignOnly) {
      return;
    }
    setEditingType({ ...type });
    setShowDialog(true);
  };

  const handleSaveType = () => {
    if (!editingType) return;

    if (!editingType.id || !editingType.name) {
      setError("ID and Name are required.");
      return;
    }

    setError(null);
    const updatedTypes = localShiftTypes.map((t) =>
      t.id === editingType.id ? editingType : t,
    );

    setLocalShiftTypes(updatedTypes);
    setShowDialog(false);
    setEditingType(null);
  };

  const handleDeleteType = (
    typeId: "EARLY" | "MIDDLE" | "LATE" | "NO_WORK" | "UNAVAILABLE",
  ) => {
    // Don't allow deletion of autoAssignOnly shift types
    const typeToDelete = localShiftTypes.find((t) => t.id === typeId);
    if (typeToDelete?.autoAssignOnly) {
      return;
    }

    const updatedTypes = localShiftTypes.filter((t) => t.id !== typeId);
    setLocalShiftTypes(updatedTypes);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Schichttypen</h3>
        <Button
          onClick={() => {
            setEditingType({ id: "EARLY", name: "", color: "#000000", type: "shift_type" });
            setShowDialog(true);
          }}
          disabled={isLoading} // Disable if loading
        >
          {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Neuen Typ hinzufügen
        </Button>
      </div>

      <Table>
        <caption className="sr-only">Table of Shift Types</caption>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Farbe</TableHead>
            <TableHead>Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {localShiftTypes.map((type) => (
            <TableRow key={type.id}>
              <TableCell>{type.id}</TableCell>
              <TableCell>
                <span style={{ display: "flex", alignItems: "center" }}>
                  {type.name}
                  {type.autoAssignOnly && (
                    <Lock
                      className="ml-2 h-4 w-4 text-gray-400"
                      title="Nur für automatische Zuweisung" // Standard HTML title attribute
                    />
                  )}
                </span>
              </TableCell>
              <TableCell>
                <div
                  className="w-6 h-6 rounded"
                  style={{ backgroundColor: type.color }}
                ></div>
              </TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditType(type)}
                    disabled={!!type.autoAssignOnly}
                    title={
                      type.autoAssignOnly
                        ? "Dieser Schichttyp kann nicht bearbeitet werden"
                        : "Bearbeiten"
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteType(type.id)}
                    disabled={!!type.autoAssignOnly}
                    title={
                      type.autoAssignOnly
                        ? "Dieser Schichttyp kann nicht gelöscht werden"
                        : "Löschen"
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Schichttyp {editingType?.id ? "bearbeiten" : "hinzufügen"}
            </DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="shiftId" className="text-right">
                ID
              </Label>
              <Input
                id="shiftId"
                value={editingType?.id || ""}
                onChange={(e) =>
                  setEditingType((prev) =>
                    prev
                      ? {
                          ...prev,
                          id: e.target.value as
                            | "EARLY"
                            | "MIDDLE"
                            | "LATE"
                            | "NO_WORK",
                        }
                      : null,
                  )
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="shiftName" className="text-right">
                Name
              </Label>
              <Input
                id="shiftName"
                value={editingType?.name || ""}
                onChange={(e) =>
                  setEditingType((prev) =>
                    prev ? { ...prev, name: e.target.value } : null,
                  )
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="shiftColor" className="text-right">
                Farbe
              </Label>
              <ColorPicker
                color={editingType?.color || "#000000"} // Changed 'value' to 'color'
                onChange={(color) =>
                  setEditingType((prev) => (prev ? { ...prev, color } : null))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDialog(false);
                setEditingType(null);
                setError(null);
              }}
              disabled={isLoading} // Disable if loading
            >
              Abbrechen
            </Button>
            <Button onClick={handleSaveType} disabled={isLoading}> {/* Disable if loading */}
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
