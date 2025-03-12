import React, { useState } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Alert, AlertDescription } from './ui/alert';
import { Trash2, Plus, Pencil } from 'lucide-react';
import { ColorPicker } from './ui/color-picker';
import { useDebouncedCallback } from 'use-debounce';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "./ui/table";

export interface ShiftType {
    id: string;
    name: string;
    color: string;
    type: 'shift';
}

interface ShiftTypesEditorProps {
    shiftTypes: ShiftType[];
    onChange: (shiftTypes: ShiftType[]) => void;
}

export default function ShiftTypesEditor({ shiftTypes, onChange }: ShiftTypesEditorProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingType, setEditingType] = useState<ShiftType | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [localShiftTypes, setLocalShiftTypes] = useState<ShiftType[]>(shiftTypes);

    // Debounced update function
    const debouncedOnChange = useDebouncedCallback(
        (updatedTypes: ShiftType[]) => {
            onChange(updatedTypes);
        },
        1000 // 1 second delay
    );

    function getDefaultShiftType(): ShiftType {
        return {
            id: '',
            name: '',
            color: '#4CAF50',
            type: 'shift'
        };
    }

    const handleOpenModal = (type?: ShiftType) => {
        if (type) {
            setEditingType({ ...type });
        } else {
            setEditingType(getDefaultShiftType());
        }
        setIsModalOpen(true);
        setError(null);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingType(null);
        setError(null);
    };

    const handleSaveType = () => {
        if (!editingType?.id || !editingType?.name) {
            setError('ID and Name are required');
            return;
        }

        const existingIndex = localShiftTypes.findIndex(t => t.id === editingType.id);
        let updatedTypes: ShiftType[];

        if (existingIndex >= 0 && editingType.id === localShiftTypes[existingIndex].id) {
            // Update existing type
            updatedTypes = [...localShiftTypes];
            updatedTypes[existingIndex] = editingType;
        } else if (localShiftTypes.some(type => type.id === editingType.id)) {
            setError('Shift Type ID must be unique');
            return;
        } else {
            // Add new type
            updatedTypes = [...localShiftTypes, editingType];
        }

        setLocalShiftTypes(updatedTypes);
        onChange(updatedTypes);
        handleCloseModal();
    };

    const handleDeleteType = (typeId: string) => {
        const updatedTypes = localShiftTypes.filter(t => t.id !== typeId);
        setLocalShiftTypes(updatedTypes);
        onChange(updatedTypes);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Shift Types</h3>
                <Button
                    onClick={() => handleOpenModal()}
                    size="sm"
                >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Shift Type
                </Button>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Color</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {localShiftTypes.map((type) => (
                        <TableRow key={type.id}>
                            <TableCell>{type.id}</TableCell>
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
                            <TableCell>
                                <div className="flex space-x-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleOpenModal(type)}
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteType(type.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingType?.id ? 'Edit Shift Type' : 'Add Shift Type'}
                        </DialogTitle>
                    </DialogHeader>

                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>ID</Label>
                                <Input
                                    value={editingType?.id || ''}
                                    onChange={(e) => setEditingType(prev => prev ? { ...prev, id: e.target.value } : null)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Name</Label>
                                <Input
                                    value={editingType?.name || ''}
                                    onChange={(e) => setEditingType(prev => prev ? { ...prev, name: e.target.value } : null)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Color</Label>
                            <ColorPicker
                                color={editingType?.color || '#4CAF50'}
                                onChange={(color) => setEditingType(prev => prev ? { ...prev, color } : null)}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseModal}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveType}>
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
} 