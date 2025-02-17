import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, Plus } from 'lucide-react';

export interface EmployeeGroup {
    id: string;
    name: string;
    description: string;
    minHours: number;
    maxHours: number;
    isFullTime: boolean;
}

interface EmployeeSettingsEditorProps {
    groups: EmployeeGroup[];
    onChange: (groups: EmployeeGroup[]) => void;
}

const DEFAULT_GROUPS: EmployeeGroup[] = [
    {
        id: 'VL',
        name: 'Vollzeit',
        description: 'Full-time employee',
        minHours: 40,
        maxHours: 40,
        isFullTime: true
    },
    {
        id: 'TZ',
        name: 'Teilzeit',
        description: 'Part-time employee',
        minHours: 10,
        maxHours: 30,
        isFullTime: false
    },
    {
        id: 'GFB',
        name: 'Geringfügig Beschäftigt',
        description: 'Mini-job employee',
        minHours: 0,
        maxHours: 40,
        isFullTime: false
    },
    {
        id: 'TL',
        name: 'Team Leader',
        description: 'Team leader (full-time)',
        minHours: 40,
        maxHours: 40,
        isFullTime: true
    }
];

const EmployeeSettingsEditor: React.FC<EmployeeSettingsEditorProps> = ({
    groups = DEFAULT_GROUPS,
    onChange
}) => {
    const [employeeGroups, setEmployeeGroups] = useState<EmployeeGroup[]>(groups);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newGroup, setNewGroup] = useState<EmployeeGroup>({
        id: '',
        name: '',
        description: '',
        minHours: 0,
        maxHours: 40,
        isFullTime: false
    });
    const [error, setError] = useState<string | null>(null);

    const handleAddGroup = () => {
        if (!newGroup.id || !newGroup.name) {
            setError('ID and Name are required');
            return;
        }

        if (employeeGroups.some(group => group.id === newGroup.id)) {
            setError('Group ID must be unique');
            return;
        }

        if (newGroup.minHours < 0 || newGroup.maxHours > 168) {
            setError('Hours must be between 0 and 168');
            return;
        }

        if (newGroup.minHours > newGroup.maxHours) {
            setError('Minimum hours cannot be greater than maximum hours');
            return;
        }

        const updatedGroups = [...employeeGroups, newGroup];
        setEmployeeGroups(updatedGroups);
        onChange(updatedGroups);
        setIsAddDialogOpen(false);
        setNewGroup({
            id: '',
            name: '',
            description: '',
            minHours: 0,
            maxHours: 40,
            isFullTime: false
        });
        setError(null);
    };

    const handleDeleteGroup = (groupId: string) => {
        const updatedGroups = employeeGroups.filter(group => group.id !== groupId);
        setEmployeeGroups(updatedGroups);
        onChange(updatedGroups);
    };

    const handleUpdateGroup = (index: number, field: keyof EmployeeGroup, value: any) => {
        const updatedGroups = [...employeeGroups];
        updatedGroups[index] = {
            ...updatedGroups[index],
            [field]: value
        };
        setEmployeeGroups(updatedGroups);
        onChange(updatedGroups);
    };

    return (
        <Card className="p-4 border">
            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Employee Groups</h2>

                <div className="space-y-4">
                    {employeeGroups.map((group, index) => (
                        <div key={group.id} className="p-4 border rounded-lg space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>ID</Label>
                                    <Input
                                        value={group.id}
                                        onChange={(e) => handleUpdateGroup(index, 'id', e.target.value)}
                                        disabled
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

                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Input
                                    value={group.description}
                                    onChange={(e) => handleUpdateGroup(index, 'description', e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Min Hours</Label>
                                    <Input
                                        type="number"
                                        value={group.minHours}
                                        onChange={(e) => handleUpdateGroup(index, 'minHours', Number(e.target.value))}
                                        min={0}
                                        max={168}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Max Hours</Label>
                                    <Input
                                        type="number"
                                        value={group.maxHours}
                                        onChange={(e) => handleUpdateGroup(index, 'maxHours', Number(e.target.value))}
                                        min={0}
                                        max={168}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Full Time</Label>
                                    <Select
                                        value={group.isFullTime.toString()}
                                        onValueChange={(value) =>
                                            handleUpdateGroup(index, 'isFullTime', value === 'true')}
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

                            <div className="flex justify-end">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteGroup(group.id)}
                                    disabled={employeeGroups.length <= 1}
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
                    onClick={() => setIsAddDialogOpen(true)}
                >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Employee Group
                </Button>
            </div>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Employee Group</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

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

                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                                value={newGroup.description}
                                onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Min Hours</Label>
                                <Input
                                    type="number"
                                    value={newGroup.minHours}
                                    onChange={(e) => setNewGroup({ ...newGroup, minHours: Number(e.target.value) })}
                                    min={0}
                                    max={168}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Max Hours</Label>
                                <Input
                                    type="number"
                                    value={newGroup.maxHours}
                                    onChange={(e) => setNewGroup({ ...newGroup, maxHours: Number(e.target.value) })}
                                    min={0}
                                    max={168}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Full Time</Label>
                                <Select
                                    value={newGroup.isFullTime.toString()}
                                    onValueChange={(value) =>
                                        setNewGroup({ ...newGroup, isFullTime: value === 'true' })}
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
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleAddGroup}>
                            Create Group
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
};

export default EmployeeSettingsEditor; 