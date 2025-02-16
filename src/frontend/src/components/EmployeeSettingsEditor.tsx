import React, { useState } from 'react';
import {
    Paper,
    Stack,
    Typography,
    TextField,
    Select,
    MenuItem,
    FormControl,
    FormLabel,
    Button,
    IconButton,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Alert,
    SelectChangeEvent
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';

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
        <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
            <Stack spacing={2}>
                <Typography variant="h6">Employee Groups</Typography>

                <List>
                    {employeeGroups.map((group, index) => (
                        <ListItem key={group.id} divider>
                            <Stack spacing={2} sx={{ width: '100%' }}>
                                <Stack direction="row" spacing={2}>
                                    <FormControl fullWidth>
                                        <FormLabel>ID</FormLabel>
                                        <TextField
                                            value={group.id}
                                            onChange={(e) => handleUpdateGroup(index, 'id', e.target.value)}
                                            size="small"
                                            disabled
                                        />
                                    </FormControl>

                                    <FormControl fullWidth>
                                        <FormLabel>Name</FormLabel>
                                        <TextField
                                            value={group.name}
                                            onChange={(e) => handleUpdateGroup(index, 'name', e.target.value)}
                                            size="small"
                                        />
                                    </FormControl>
                                </Stack>

                                <FormControl fullWidth>
                                    <FormLabel>Description</FormLabel>
                                    <TextField
                                        value={group.description}
                                        onChange={(e) => handleUpdateGroup(index, 'description', e.target.value)}
                                        size="small"
                                    />
                                </FormControl>

                                <Stack direction="row" spacing={2}>
                                    <FormControl fullWidth>
                                        <FormLabel>Min Hours</FormLabel>
                                        <TextField
                                            type="number"
                                            value={group.minHours}
                                            onChange={(e) => handleUpdateGroup(index, 'minHours', Number(e.target.value))}
                                            size="small"
                                            inputProps={{ min: 0, max: 168 }}
                                        />
                                    </FormControl>

                                    <FormControl fullWidth>
                                        <FormLabel>Max Hours</FormLabel>
                                        <TextField
                                            type="number"
                                            value={group.maxHours}
                                            onChange={(e) => handleUpdateGroup(index, 'maxHours', Number(e.target.value))}
                                            size="small"
                                            inputProps={{ min: 0, max: 168 }}
                                        />
                                    </FormControl>

                                    <FormControl fullWidth>
                                        <FormLabel>Full Time</FormLabel>
                                        <Select
                                            value={group.isFullTime.toString()}
                                            onChange={(e: SelectChangeEvent) =>
                                                handleUpdateGroup(index, 'isFullTime', e.target.value === 'true')}
                                            size="small"
                                        >
                                            <MenuItem value="true">Yes</MenuItem>
                                            <MenuItem value="false">No</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Stack>
                            </Stack>

                            <ListItemSecondaryAction>
                                <IconButton
                                    edge="end"
                                    aria-label="delete"
                                    onClick={() => handleDeleteGroup(group.id)}
                                    disabled={employeeGroups.length <= 1}
                                >
                                    <DeleteIcon />
                                </IconButton>
                            </ListItemSecondaryAction>
                        </ListItem>
                    ))}
                </List>

                <Button
                    startIcon={<AddIcon />}
                    onClick={() => setIsAddDialogOpen(true)}
                    variant="outlined"
                >
                    Add Employee Group
                </Button>
            </Stack>

            <Dialog open={isAddDialogOpen} onClose={() => setIsAddDialogOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>Add Employee Group</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 2 }}>
                        {error && (
                            <Alert severity="error" onClose={() => setError(null)}>
                                {error}
                            </Alert>
                        )}

                        <Stack direction="row" spacing={2}>
                            <FormControl fullWidth>
                                <FormLabel>ID</FormLabel>
                                <TextField
                                    value={newGroup.id}
                                    onChange={(e) => setNewGroup({ ...newGroup, id: e.target.value })}
                                    size="small"
                                    required
                                />
                            </FormControl>

                            <FormControl fullWidth>
                                <FormLabel>Name</FormLabel>
                                <TextField
                                    value={newGroup.name}
                                    onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                                    size="small"
                                    required
                                />
                            </FormControl>
                        </Stack>

                        <FormControl fullWidth>
                            <FormLabel>Description</FormLabel>
                            <TextField
                                value={newGroup.description}
                                onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                                size="small"
                            />
                        </FormControl>

                        <Stack direction="row" spacing={2}>
                            <FormControl fullWidth>
                                <FormLabel>Min Hours</FormLabel>
                                <TextField
                                    type="number"
                                    value={newGroup.minHours}
                                    onChange={(e) => setNewGroup({ ...newGroup, minHours: Number(e.target.value) })}
                                    size="small"
                                    inputProps={{ min: 0, max: 168 }}
                                />
                            </FormControl>

                            <FormControl fullWidth>
                                <FormLabel>Max Hours</FormLabel>
                                <TextField
                                    type="number"
                                    value={newGroup.maxHours}
                                    onChange={(e) => setNewGroup({ ...newGroup, maxHours: Number(e.target.value) })}
                                    size="small"
                                    inputProps={{ min: 0, max: 168 }}
                                />
                            </FormControl>

                            <FormControl fullWidth>
                                <FormLabel>Full Time</FormLabel>
                                <Select
                                    value={newGroup.isFullTime.toString()}
                                    onChange={(e: SelectChangeEvent) =>
                                        setNewGroup({ ...newGroup, isFullTime: e.target.value === 'true' })}
                                    size="small"
                                >
                                    <MenuItem value="true">Yes</MenuItem>
                                    <MenuItem value="false">No</MenuItem>
                                </Select>
                            </FormControl>
                        </Stack>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddGroup} variant="contained">Add</Button>
                </DialogActions>
            </Dialog>
        </Paper>
    );
};

export default EmployeeSettingsEditor; 