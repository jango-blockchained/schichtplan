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
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import type { Shift, ShiftType } from '../types';
import { ColorPicker } from '../components/ColorPicker';

interface ShiftsPageProps { }

const ShiftsPage: React.FC<ShiftsPageProps> = () => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    fetchShifts();
    fetchShiftTypes();
  }, []);

  const fetchShifts = async () => {
    try {
      const response = await fetch('/api/shifts');
      const data = await response.json();
      setShifts(data);
      setLoading(false);
    } catch (error) {
      enqueueSnackbar('Error loading shifts', { variant: 'error' });
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

  const handleAddShift = () => {
    setEditingShift(null);
    setEditDialogOpen(true);
  };

  const handleEditShift = (shift: Shift) => {
    setEditingShift(shift);
    setEditDialogOpen(true);
  };

  const handleDeleteShift = async (shiftId: string) => {
    try {
      const response = await fetch(`/api/shifts/${shiftId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchShifts();
        enqueueSnackbar('Shift deleted successfully', { variant: 'success' });
      }
    } catch (error) {
      enqueueSnackbar('Error deleting shift', { variant: 'error' });
    }
  };

  const handleSaveShift = async (formData: any) => {
    try {
      const method = editingShift ? 'PUT' : 'POST';
      const url = editingShift ? `/api/shifts/${editingShift.id}` : '/api/shifts';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        fetchShifts();
        setEditDialogOpen(false);
        enqueueSnackbar(`Shift ${editingShift ? 'updated' : 'created'} successfully`, {
          variant: 'success',
        });
      }
    } catch (error) {
      enqueueSnackbar('Error saving shift', { variant: 'error' });
    }
  };

  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Shifts
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddShift}
          sx={{ mb: 2 }}
        >
          Add Shift
        </Button>
      </Box>

      <Grid container spacing={2}>
        {shifts.map((shift) => {
          const shiftType = shiftTypes.find((type) => type.id === shift.shift_type_id);
          return (
            <Grid item xs={12} md={4} key={shift.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6">{shiftType?.name || 'Unknown Shift Type'}</Typography>
                  <Typography color="textSecondary">
                    {shift.start_time} - {shift.end_time}
                  </Typography>
                  {shiftType && (
                    <Box sx={{ mt: 1 }}>
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          backgroundColor: shiftType.color,
                          borderRadius: '50%',
                          display: 'inline-block',
                        }}
                      />
                    </Box>
                  )}
                </CardContent>
                <CardActions>
                  <IconButton onClick={() => handleEditShift(shift)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDeleteShift(shift.id)}>
                    <DeleteIcon />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>{editingShift ? 'Edit Shift' : 'Add New Shift'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Shift Type</InputLabel>
              <Select
                value={editingShift?.shift_type_id || ''}
                onChange={(e) => setEditingShift({ ...editingShift!, shift_type_id: e.target.value })}
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
              value={editingShift?.start_time || ''}
              onChange={(e) =>
                setEditingShift({ ...editingShift!, start_time: e.target.value })
              }
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="End Time"
              type="time"
              value={editingShift?.end_time || ''}
              onChange={(e) =>
                setEditingShift({ ...editingShift!, end_time: e.target.value })
              }
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Break Duration (minutes)"
              type="number"
              value={editingShift?.break_duration || 0}
              onChange={(e) =>
                setEditingShift({
                  ...editingShift!,
                  break_duration: parseInt(e.target.value, 10),
                })
              }
              sx={{ mb: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={() => handleSaveShift(editingShift)} variant="contained" color="primary">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ShiftsPage; 