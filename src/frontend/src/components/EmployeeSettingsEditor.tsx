import React, { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Alert, AlertDescription } from './ui/alert';
import { Trash2, Plus } from 'lucide-react';
import { ColorPicker } from './ui/color-picker';
import { BaseEmployeeType, BaseAbsenceType } from '@/types';

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
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newGroup, setNewGroup] = useState<GroupType>(getDefaultGroup());
    const [error, setError] = useState<string | null>(null);

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
                    color: '#FF9800',
                    paid: true
                } as AbsenceType;
        }
    }

    const handleAddGroup = () => {
        if (!newGroup.id || !newGroup.name) {
            setError('ID and Name are required');
            return;
        }

        if (groups.some(group => group.id === newGroup.id)) {
            setError('Group ID must be unique');
            return;
        }

        const groupToAdd = {
            ...newGroup,
            type: type
        } as GroupType;

        const updatedGroups = [...groups, groupToAdd];
        onChange(updatedGroups);
        setIsAddDialogOpen(false);
        setNewGroup(getDefaultGroup());
        setError(null);
    };

    const handleDeleteGroup = (groupId: string) => {
        const updatedGroups = groups.filter(group => group.id !== groupId);
        onChange(updatedGroups);
    };

    const handleUpdateEmployeeGroup = (index: number, field: keyof EmployeeType, value: string | number) => {
        const updatedGroups = [...groups];
        const updatedGroup = {
            ...updatedGroups[index],
            [field]: value
        };
        updatedGroups[index] = updatedGroup;
        onChange(updatedGroups);
    };

    const handleUpdateAbsenceGroup = (index: number, field: keyof AbsenceType, value: string | boolean) => {
        const updatedGroups = [...groups];
        const updatedGroup = {
            ...updatedGroups[index],
            [field]: value
        };
        updatedGroups[index] = updatedGroup;
        onChange(updatedGroups);
    };

    return (
        <Card>
            <CardContent className="pt-6">
                <div className="space-y-4">
                    {groups.map((group, index) => (
                        <div key={group.id} className="p-4 border rounded-lg space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>ID</Label>
                                    <Input
                                        value={group.id}
                                        onChange={(e) => {
                                            if (type === 'employee') {
                                                handleUpdateEmployeeGroup(index, 'id', e.target.value);
                                            } else {
                                                handleUpdateAbsenceGroup(index, 'id', e.target.value);
                                            }
                                        }}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Name</Label>
                                    <Input
                                        value={group.name}
                                        onChange={(e) => {
                                            if (type === 'employee') {
                                                handleUpdateEmployeeGroup(index, 'name', e.target.value);
                                            } else {
                                                handleUpdateAbsenceGroup(index, 'name', e.target.value);
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            {type === 'employee' && 'min_hours' in group && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Min Hours</Label>
                                        <Input
                                            type="number"
                                            value={group.min_hours}
                                            onChange={(e) => handleUpdateEmployeeGroup(index, 'min_hours', Number(e.target.value))}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Max Hours</Label>
                                        <Input
                                            type="number"
                                            value={group.max_hours}
                                            onChange={(e) => handleUpdateEmployeeGroup(index, 'max_hours', Number(e.target.value))}
                                        />
                                    </div>
                                </div>
                            )}

                            {type === 'absence' && 'paid' in group && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Color</Label>
                                        <ColorPicker
                                            id={`absence-color-${group.id}`}
                                            color={group.color}
                                            onChange={(color) => handleUpdateAbsenceGroup(index, 'color', color)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Paid</Label>
                                        <Select
                                            value={group.paid.toString()}
                                            onValueChange={(value) =>
                                                handleUpdateAbsenceGroup(index, 'paid', value === 'true')}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="true">Yes</SelectItem>
                                                <SelectItem value="false">No</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteGroup(group.id)}
                                    disabled={groups.length <= 1}
                                >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setIsAddDialogOpen(true)}
                >
                    <Plus className="h-4 w-4 mr-1" />
                    Add {type === 'employee' ? 'Employee Type' : 'Absence Type'}
                </Button>
            </CardContent>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Add {type === 'employee' ? 'Employee Type' : 'Absence Type'}
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
                                    value={newGroup.id}
                                    onChange={(e) => setNewGroup({ ...newGroup, id: e.target.value } as GroupType)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Name</Label>
                                <Input
                                    value={newGroup.name}
                                    onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value } as GroupType)}
                                />
                            </div>
                        </div>

                        {type === 'employee' && 'min_hours' in newGroup && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Min Hours</Label>
                                    <Input
                                        type="number"
                                        value={newGroup.min_hours}
                                        onChange={(e) =>
                                            setNewGroup({ ...newGroup, min_hours: Number(e.target.value) } as EmployeeType)
                                        }
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Max Hours</Label>
                                    <Input
                                        type="number"
                                        value={newGroup.max_hours}
                                        onChange={(e) =>
                                            setNewGroup({ ...newGroup, max_hours: Number(e.target.value) } as EmployeeType)
                                        }
                                    />
                                </div>
                            </div>
                        )}

                        {type === 'absence' && 'paid' in newGroup && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Color</Label>
                                    <ColorPicker
                                        id={`new-absence-color`}
                                        color={newGroup.color}
                                        onChange={(color) =>
                                            setNewGroup({ ...newGroup, color } as AbsenceType)
                                        }
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Paid</Label>
                                    <Select
                                        value={newGroup.paid.toString()}
                                        onValueChange={(value) =>
                                            setNewGroup({ ...newGroup, paid: value === 'true' } as AbsenceType)
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="true">Yes</SelectItem>
                                            <SelectItem value="false">No</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleAddGroup}>Create</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
} 