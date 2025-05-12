import React, { useState, useEffect } from 'react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter
} from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ColorPicker } from '@/components/ui/color-picker';
import { Input } from '@/components/ui/input';
import { Pencil, Loader2 } from 'lucide-react';
import type { Settings } from '@/types/index';

// Correct type for an item in settings.availability_types.types
// This is the structure defined in Settings type in @/types/index.ts
type AvailabilityTypeFromSettings = Settings['availability_types']['types'][number];

// Frontend representation, similar to OptionsPage
interface FrontendAvailabilityType {
  id: string; 
  name: string;
  color: string;
  description: string;
  originalPriority?: number; 
  originalIsAvailable?: boolean;
}

interface AvailabilityConfigurationSectionProps {
  localSettings: Partial<Settings>;
  handleSave: (category: 'availability_types', updates: Partial<Settings['availability_types']>) => void;
  handleImmediateUpdate: () => void;
  updateMutationIsPending: boolean;
}

const mapToFrontend = (backendTypes: AvailabilityTypeFromSettings[] = []): FrontendAvailabilityType[] => {
  return backendTypes.map(bt => ({
    id: bt.id,
    name: bt.name,
    color: bt.color,
    description: bt.description,
    originalPriority: bt.priority,
    originalIsAvailable: bt.is_available,
  }));
};

const mapToBackend = (frontendTypes: FrontendAvailabilityType[]): AvailabilityTypeFromSettings[] => {
  return frontendTypes.map(ft => ({
    id: ft.id,
    name: ft.name,
    color: ft.color,
    description: ft.description,
    priority: ft.originalPriority ?? (ft.id === 'UNV' ? 4 : ft.id === 'FIX' ? 1 : ft.id === 'AVL' ? 2 : 3),
    is_available: ft.originalIsAvailable ?? (ft.id !== 'UNV'),
  }));
};

export const AvailabilityConfigurationSection: React.FC<AvailabilityConfigurationSectionProps> = ({
  localSettings,
  handleSave,
  handleImmediateUpdate,
  updateMutationIsPending,
}) => {
  const [displayableTypes, setDisplayableTypes] = useState<FrontendAvailabilityType[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<FrontendAvailabilityType | null>(null);

  useEffect(() => {
    setDisplayableTypes(mapToFrontend(localSettings.availability_types?.types));
  }, [localSettings.availability_types]);

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

    const updatedDisplayableTypes = displayableTypes.map(dt => 
      dt.id === editingType.id ? { ...dt, color: editingType.color } : dt
    );
    setDisplayableTypes(updatedDisplayableTypes);

    const backendFormattedTypes = mapToBackend(updatedDisplayableTypes);
    handleSave('availability_types', { types: backendFormattedTypes });
    handleCloseModal();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Availability Types</CardTitle>
          <CardDescription>Configure availability status types and their colors. Other properties like name, description, priority, and availability status are managed by the system or in other configuration areas and are not directly editable here.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Color</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(displayableTypes || []).map((type) => (
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
                  <TableCell className="hidden md:table-cell">{type.description}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => handleOpenModal(type)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="flex justify-end">
            <Button onClick={handleImmediateUpdate} disabled={updateMutationIsPending}>
                {updateMutationIsPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Availability Configuration
            </Button>
        </CardFooter>
      </Card>

      {editingType && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Color for {editingType.name} ({editingType.id})</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor={`availability-color-${editingType.id}`}>Color</Label>
                <ColorPicker
                  id={`availability-color-${editingType.id}`}
                  color={editingType.color}
                  onChange={handleColorChangeInModal}
                />
                <Input 
                    value={editingType.color} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleColorChangeInModal(e.target.value)} 
                    className="mt-2"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseModal}>Cancel</Button>
              <Button onClick={handleSaveColor}>Apply Color</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}; 