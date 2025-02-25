import React, { useState, useCallback } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Alert, AlertDescription } from './ui/alert';
import { Trash2, Plus, Pencil } from 'lucide-react';
import { ColorPicker } from './ui/color-picker';
import { BaseEmployeeType, BaseAbsenceType } from '@/types';
import { useDebouncedCallback } from 'use-debounce';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "./ui/table";

export interface EmployeeType extends BaseEmployeeType {
    type: 'employee';
}

export interface AbsenceType extends BaseAbsenceType {
    type: 'absence';
}

type GroupType = EmployeeType | AbsenceType;

interface EmployeeSettingsEditorProps {
    type: GroupType['type'];
    groups: GroupType[];
    onChange: (groups: GroupType[]) => void;
}

export default function EmployeeSettingsEditor<T extends keyof GroupType>({ groups, onChange, type }: EmployeeSettingsEditorProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<GroupType | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [localGroups, setLocalGroups] = useState<GroupType[]>(groups);

    // Debounced update function
    const debouncedOnChange = useDebouncedCallback(
        (updatedGroups: GroupType[]) => {
            onChange(updatedGroups);
        },
        1000 // 1 second delay
    );

    function getDefaultGroup(): GroupType {
        switch (type) {
            case 'employee':
                return {
                    type: 'employee',
                    id: '',
                    name: '',
                    min_hours: 0,
                    max_hours: 40
                } as EmployeeType;
            case 'absence':
                return {
                    type: 'absence',
                    id: '',
                    name: '',
                    color: '#FF9800'
                } as AbsenceType;
        }
    }

    const handleOpenModal = (group?: GroupType) => {
        if (group) {
            setEditingGroup({ ...group });
        } else {
            setEditingGroup(getDefaultGroup());
        }
        setIsModalOpen(true);
        setError(null);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingGroup(null);
        setError(null);
    };

    const handleSaveGroup = () => {
        if (!editingGroup?.id || !editingGroup?.name) {
            setError('ID and Name are required');
            return;
        }

        const existingIndex = localGroups.findIndex(g => g.id === editingGroup.id);
        let updatedGroups: GroupType[];

        if (existingIndex >= 0 && editingGroup.id === localGroups[existingIndex].id) {
            // Update existing group
            updatedGroups = [...localGroups];
            updatedGroups[existingIndex] = editingGroup;
        } else if (localGroups.some(group => group.id === editingGroup.id)) {
            setError('Group ID must be unique');
            return;
        } else {
            // Add new group
            updatedGroups = [...localGroups, editingGroup];
        }

        setLocalGroups(updatedGroups);
        onChange(updatedGroups);
        handleCloseModal();
    };

    const handleDeleteGroup = (groupId: string) => {
        const updatedGroups = localGroups.filter(g => g.id !== groupId);
        setLocalGroups(updatedGroups);
        onChange(updatedGroups);
    };

    const renderModalContent = () => {
        if (!editingGroup) return null;

        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>ID</Label>
                        <Input
                            value={editingGroup.id}
                            onChange={(e) => setEditingGroup({ ...editingGroup, id: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                            value={editingGroup.name}
                            onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                        />
                    </div>
                </div>

                {type === 'employee' && editingGroup.type === 'employee' && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Min Hours</Label>
                            <Input
                                type="number"
                                value={editingGroup.min_hours}
                                onChange={(e) => setEditingGroup({
                                    ...editingGroup,
                                    min_hours: Number(e.target.value)
                                } as EmployeeType)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Max Hours</Label>
                            <Input
                                type="number"
                                value={editingGroup.max_hours}
                                onChange={(e) => setEditingGroup({
                                    ...editingGroup,
                                    max_hours: Number(e.target.value)
                                } as EmployeeType)}
                            />
                        </div>
                    </div>
                )}

                {type === 'absence' && editingGroup.type === 'absence' && (
                    <div className="space-y-2">
                        <Label>Color</Label>
                        <ColorPicker
                            id={`group-color-${editingGroup.id}`}
                            color={editingGroup.color}
                            onChange={(color) => setEditingGroup({
                                ...editingGroup,
                                color
                            } as AbsenceType)}
                        />
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">
                    {type === 'employee' ? 'Employee Types' : 'Absence Types'}
                </h3>
                <Button
                    onClick={() => handleOpenModal()}
                    size="sm"
                >
                    <Plus className="h-4 w-4 mr-1" />
                    Add {type === 'employee' ? 'Employee Type' : 'Absence Type'}
                </Button>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Name</TableHead>
                        {type === 'employee' && (
                            <>
                                <TableHead>Min Hours</TableHead>
                                <TableHead>Max Hours</TableHead>
                            </>
                        )}
                        {type === 'absence' && (
                            <TableHead>Color</TableHead>
                        )}
                        <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {localGroups.map((group) => (
                        <TableRow key={group.id}>
                            <TableCell>{group.id}</TableCell>
                            <TableCell>{group.name}</TableCell>
                            {type === 'employee' && group.type === 'employee' && (
                                <>
                                    <TableCell>{group.min_hours}</TableCell>
                                    <TableCell>{group.max_hours}</TableCell>
                                </>
                            )}
                            {type === 'absence' && group.type === 'absence' && (
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-6 h-6 rounded border"
                                            style={{ backgroundColor: group.color }}
                                        />
                                        {group.color}
                                    </div>
                                </TableCell>
                            )}
                            <TableCell>
                                <div className="flex space-x-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleOpenModal(group)}
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteGroup(group.id)}
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingGroup?.id ? 'Edit' : 'Add'} {type === 'employee' ? 'Employee Type' : 'Absence Type'}
                        </DialogTitle>
                    </DialogHeader>

                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {renderModalContent()}

                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseModal}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveGroup}>
                            {editingGroup?.id ? 'Save' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
} 