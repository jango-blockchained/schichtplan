import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { Pencil, Loader2 } from "lucide-react";
import type { Settings } from "@/types/index";

// Correct type for an item in settings.availability_types.types
// This is the structure defined in Settings type in @/types/index.ts
type AvailabilityTypeFromSettings = {
  id: string;
  name: string;
  description?: string;
  color: string;
  priority?: number;
  is_available: boolean;
  type?: 'availability_type';
};

// Frontend representation, similar to OptionsPage
interface FrontendAvailabilityType {
  id: string;
  name: string;
  color: string;
  description?: string;
  originalPriority?: number;
  originalIsAvailable?: boolean;
}

interface AvailabilityConfigurationSectionProps {
  settings?: Settings["availability_types"]; // Match the prop name being passed from UnifiedSettingsPage
  onUpdate: (updatedTypes: AvailabilityTypeFromSettings[]) => void;
  onImmediateUpdate: () => void;
  isLoading?: boolean;
}

const mapToFrontend = (
  backendTypes: AvailabilityTypeFromSettings[] = [],
): FrontendAvailabilityType[] => {
  return backendTypes.map((bt) => ({
    id: bt.id,
    name: bt.name,
    color: bt.color,
    description: bt.description,
    originalPriority: bt.priority,
    originalIsAvailable: bt.is_available,
  }));
};

const mapToBackend = (
  frontendTypes: FrontendAvailabilityType[],
): AvailabilityTypeFromSettings[] => {
  return frontendTypes.map((ft) => ({
    id: ft.id,
    name: ft.name,
    color: ft.color,
    description: ft.description ?? null,
    priority:
      ft.originalPriority !== undefined && ft.originalPriority !== null
        ? ft.originalPriority
        : ft.id === "UNAVAILABLE"
          ? 4
          : ft.id === "FIXED"
            ? 1
            : ft.id === "AVAILABLE"
              ? 2
              : 3,
    is_available: ft.originalIsAvailable !== undefined && ft.originalIsAvailable !== null
      ? ft.originalIsAvailable
      : ft.id !== "UNAVAILABLE",
  }));
};

export const AvailabilityConfigurationSection: React.FC<
  AvailabilityConfigurationSectionProps
> = ({ settings, onUpdate, onImmediateUpdate, isLoading = false }) => {
  const [displayableTypes, setDisplayableTypes] = useState<
    FrontendAvailabilityType[]
  >([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] =
    useState<FrontendAvailabilityType | null>(null);

  useEffect(() => {
    // Ensure settings and types are not undefined
    const availabilityTypes = settings?.types || [];
    setDisplayableTypes(mapToFrontend(availabilityTypes));
  }, [settings]);

  const handleOpenModal = (type: FrontendAvailabilityType) => {
    setEditingType({ ...type });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingType(null);
  };

  const handleColorChangeInModal = (newColor: string) => {
    if (editingType) {
      setEditingType({ ...editingType, color: newColor });
    }
  };

  const handleSaveColor = () => {
    if (!editingType) return;

    const updatedDisplayableTypes = displayableTypes.map((dt) =>
      dt.id === editingType.id ? { ...dt, color: editingType.color } : dt,
    );
    setDisplayableTypes(updatedDisplayableTypes);

    const backendFormattedTypes = mapToBackend(updatedDisplayableTypes);
    onUpdate(backendFormattedTypes);
    onImmediateUpdate();
    handleCloseModal();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span>Loading availability types...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Availability Types</CardTitle>
          <CardDescription>
            Configure availability status types and their colors. Other
            properties like name, description, priority, and availability status
            are managed by the system or in other configuration areas and are
            not directly editable here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {displayableTypes.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              No availability types found. Default types will be created automatically.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Description
                  </TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayableTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.id}</TableCell>
                    <TableCell>{type.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded border"
                          style={{ backgroundColor: type.color }}
                        />
                        {type.color}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {type.description || "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenModal(type)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter className="flex justify-end">
          {/* Auto-save: Save button removed */}
        </CardFooter>
      </Card>

      {editingType && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Edit Color for {editingType.name} ({editingType.id})
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor={`availability-color-${editingType.id}`}>
                  Color
                </Label>
                <ColorPicker
                  id={`availability-color-${editingType.id}`}
                  color={editingType.color}
                  onChange={handleColorChangeInModal}
                  onBlur={onImmediateUpdate}
                />
                <Input
                  value={editingType.color}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleColorChangeInModal(e.target.value)
                  }
                  className="mt-2"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseModal}>
                Cancel
              </Button>
              <Button onClick={handleSaveColor}>Apply Color</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
