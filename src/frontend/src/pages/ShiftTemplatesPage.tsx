import React, { useState, useEffect } from 'react';
import {
    Box,
    Container,
    Typography,
    Paper,
    Grid,
    Card,
    CardContent,
    CardActions,
    Button,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import type { ShiftTemplate, ShiftType } from '../types';
import { ColorPicker } from '../components/ColorPicker';

interface ShiftTemplatesPageProps { }

const ShiftTemplatesPage: React.FC<ShiftTemplatesPageProps> = () => {
    const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
    const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
    const [loading, setLoading] = useState(true);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null);
    const { enqueueSnackbar } = useSnackbar();

    useEffect(() => {
        fetchTemplates();
        fetchShiftTypes();
    }, []);

    const fetchTemplates = async () => {
        try {
            const response = await fetch('/api/shift-templates');
            const data = await response.json();
            setTemplates(data);
            setLoading(false);
        } catch (error) {
            enqueueSnackbar('Error loading templates', { variant: 'error' });
        }
    };

    const fetchShiftTypes = async () => {
        try {
            const response = await fetch('/api/settings');
            const data = await response.json();
            setShiftTypes(data.shift_types.shift_types || []);
        } catch (error) {
            enqueueSnackbar('Error loading shift types', { variant: 'error' });
        }
    };

    const handleAddTemplate = () => {
        setEditingTemplate(null);
        setEditDialogOpen(true);
    };

    const handleEditTemplate = (template: ShiftTemplate) => {
        setEditingTemplate(template);
        setEditDialogOpen(true);
    };

    const handleDeleteTemplate = async (templateId: string) => {
        try {
            const response = await fetch(`/api/shift-templates/${templateId}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                fetchTemplates();
                enqueueSnackbar('Template deleted successfully', { variant: 'success' });
            }
        } catch (error) {
            enqueueSnackbar('Error deleting template', { variant: 'error' });
        }
    };

    const handleSaveTemplate = async (formData: any) => {
        try {
            const method = editingTemplate ? 'PUT' : 'POST';
            const url = editingTemplate
                ? `/api/shift-templates/${editingTemplate.id}`
                : '/api/shift-templates';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                fetchTemplates();
                setEditDialogOpen(false);
                enqueueSnackbar(`Template ${editingTemplate ? 'updated' : 'created'} successfully`, {
                    variant: 'success',
                });
            }
        } catch (error) {
            enqueueSnackbar('Error saving template', { variant: 'error' });
        }
    };

    if (loading) {
        return <Typography>Loading...</Typography>;
    }

    return (
        <Container maxWidth="lg">
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Shift Templates
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddTemplate}
                    sx={{ mb: 2 }}
                >
                    Add Template
                </Button>
            </Box>

            <Grid container spacing={2}>
                {templates.map((template) => {
                    const shiftType = shiftTypes.find((type) => type.id === template.shift_type_id);
                    return (
                        <Grid item xs={12} md={4} key={template.id}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6">{template.name}</Typography>
                                    <Typography color="textSecondary">
                                        {shiftType?.name || 'Unknown Shift Type'}
                                    </Typography>
                                    <Box sx={{ mt: 1 }}>
                                        <Typography variant="body2" color="textSecondary">
                                            {template.start_time} - {template.end_time}
                                        </Typography>
                                        <Chip
                                            label={`Break: ${template.break_duration} min`}
                                            size="small"
                                            sx={{ mt: 1 }}
                                        />
                                    </Box>
                                </CardContent>
                                <CardActions>
                                    <IconButton onClick={() => handleEditTemplate(template)}>
                                        <EditIcon />
                                    </IconButton>
                                    <IconButton onClick={() => handleDeleteTemplate(template.id)}>
                                        <DeleteIcon />
                                    </IconButton>
                                </CardActions>
                            </Card>
                        </Grid>
                    );
                })}
            </Grid>

            <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
                <DialogTitle>
                    {editingTemplate ? 'Edit Template' : 'Add New Template'}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 2 }}>
                        <TextField
                            fullWidth
                            label="Name"
                            value={editingTemplate?.name || ''}
                            onChange={(e) =>
                                setEditingTemplate({ ...editingTemplate!, name: e.target.value })
                            }
                            sx={{ mb: 2 }}
                        />
                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Shift Type</InputLabel>
                            <Select
                                value={editingTemplate?.shift_type_id || ''}
                                onChange={(e) =>
                                    setEditingTemplate({ ...editingTemplate!, shift_type_id: e.target.value })
                                }
                            >
                                {shiftTypes.map((type) => (
                                    <MenuItem key={type.id} value={type.id}>
                                        {type.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <TextField
                            fullWidth
                            label="Start Time"
                            type="time"
                            value={editingTemplate?.start_time || ''}
                            onChange={(e) =>
                                setEditingTemplate({ ...editingTemplate!, start_time: e.target.value })
                            }
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            fullWidth
                            label="End Time"
                            type="time"
                            value={editingTemplate?.end_time || ''}
                            onChange={(e) =>
                                setEditingTemplate({ ...editingTemplate!, end_time: e.target.value })
                            }
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            fullWidth
                            label="Break Duration (minutes)"
                            type="number"
                            value={editingTemplate?.break_duration || 0}
                            onChange={(e) =>
                                setEditingTemplate({
                                    ...editingTemplate!,
                                    break_duration: parseInt(e.target.value, 10),
                                })
                            }
                            sx={{ mb: 2 }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                    <Button
                        onClick={() => handleSaveTemplate(editingTemplate)}
                        variant="contained"
                        color="primary"
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default ShiftTemplatesPage; 