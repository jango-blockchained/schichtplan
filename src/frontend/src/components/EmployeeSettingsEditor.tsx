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

export interface ShiftType {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
    color: string;
}

export interface EmployeeType {
    id: string;
    name: string;
    min_hours: number;
    max_hours: number;
}

export interface AbsenceType {
    id: string;
    name: string;
    color: string;
    paid: boolean;
}

type GroupType = ShiftType | EmployeeType | AbsenceType;

interface EmployeeSettingsEditorProps {
    groups: GroupType[];
    onChange: (groups: GroupType[]) => void;
    type: 'shift' | 'employee' | 'absence';
}

export default function EmployeeSettingsEditor({ groups, onChange, type }: EmployeeSettingsEditorProps) {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newGroup, setNewGroup] = useState<GroupType>(getDefaultGroup());
    const [error, setError] = useState<string | null>(null);

    function getDefaultGroup(): GroupType {
        switch (type) {
            case 'shift':
                return {
                    id: '',
                    name: '',
                    start_time: '09:00',
                    end_time: '17:00',
                    color: '#4CAF50'
                };
            case 'employee':
                return {
                    id: '',
                    name: '',
                    min_hours: 0,
                    max_hours: 40
                };
            case 'absence':
                return {
                    id: '',
                    name: '',
                    color: '#FF9800',
                    paid: true
                };
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

        const updatedGroups = [...groups, newGroup];
        onChange(updatedGroups);
        setIsAddDialogOpen(false);
        setNewGroup(getDefaultGroup());
        setError(null);
    };

    const handleDeleteGroup = (groupId: string) => {
        const updatedGroups = groups.filter(group => group.id !== groupId);
        onChange(updatedGroups);
    };

    const handleUpdateGroup = (index: number, field: keyof GroupType, value: any) => {
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
                                        onChange={(e) => handleUpdateGroup(index, 'id', e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Name</Label>
                                    <Input
                                        value={group.name}
                                        onChange={(e) => handleUpdateGroup(index, 'name', e.target.value)}
                                    />
                                </div>
                            </div>

                            {type === 'shift' && 'start_time' in group && (
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>Start Time</Label>
                                        <Input
                                            type="time"
                                            value={group.start_time}
                                            onChange={(e) => handleUpdateGroup(index, 'start_time', e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>End Time</Label>
                                        <Input
                                            type="time"
                                            value={group.end_time}
                                            onChange={(e) => handleUpdateGroup(index, 'end_time', e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Color</Label>
                                        <ColorPicker
                                            color={group.color}
                                            onChange={(color) => handleUpdateGroup(index, 'color', color)}
                                        />
                                    </div>
                                </div>
                            )}

                            {type === 'employee' && 'min_hours' in group && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Min Hours</Label>
                                        <Input
                                            type="number"
                                            value={group.min_hours}
                                            onChange={(e) => handleUpdateGroup(index, 'min_hours', Number(e.target.value))}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Max Hours</Label>
                                        <Input
                                            type="number"
                                            value={group.max_hours}
                                            onChange={(e) => handleUpdateGroup(index, 'max_hours', Number(e.target.value))}
                                        />
                                    </div>
                                </div>
                            )}

                            {type === 'absence' && 'paid' in group && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Color</Label>
                                        <ColorPicker
                                            color={group.color}
                                            onChange={(color) => handleUpdateGroup(index, 'color', color)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Paid</Label>
                                        <Select
                                            value={group.paid.toString()}
                                            onValueChange={(value) =>
                                                handleUpdateGroup(index, 'paid', value === 'true')}
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
                    Add {type === 'shift' ? 'Shift Type' : type === 'employee' ? 'Employee Type' : 'Absence Type'}
                </Button>
            </CardContent>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Add {type === 'shift' ? 'Shift Type' : type === 'employee' ? 'Employee Type' : 'Absence Type'}
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
                                    onChange={(e) => setNewGroup({ ...newGroup, id: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Name</Label>
                                <Input
                                    value={newGroup.name}
                                    onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                                />
                            </div>
                        </div>

                        {type === 'shift' && 'start_time' in newGroup && (
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Start Time</Label>
                                    <Input
                                        type="time"
                                        value={newGroup.start_time}
                                        onChange={(e) =>
                                            setNewGroup({ ...newGroup, start_time: e.target.value })
                                        }
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>End Time</Label>
                                    <Input
                                        type="time"
                                        value={newGroup.end_time}
                                        onChange={(e) =>
                                            setNewGroup({ ...newGroup, end_time: e.target.value })
                                        }
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Color</Label>
                                    <ColorPicker
                                        color={newGroup.color}
                                        onChange={(color) =>
                                            setNewGroup({ ...newGroup, color })
                                        }
                                    />
                                </div>
                            </div>
                        )}

                        {type === 'employee' && 'min_hours' in newGroup && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Min Hours</Label>
                                    <Input
                                        type="number"
                                        value={newGroup.min_hours}
                                        onChange={(e) =>
                                            setNewGroup({ ...newGroup, min_hours: Number(e.target.value) })
                                        }
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Max Hours</Label>
                                    <Input
                                        type="number"
                                        value={newGroup.max_hours}
                                        onChange={(e) =>
                                            setNewGroup({ ...newGroup, max_hours: Number(e.target.value) })
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
                                        color={newGroup.color}
                                        onChange={(color) =>
                                            setNewGroup({ ...newGroup, color })
                                        }
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Paid</Label>
                                    <Select
                                        value={newGroup.paid.toString()}
                                        onValueChange={(value) =>
                                            setNewGroup({ ...newGroup, paid: value === 'true' })
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