import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useSnackbar } from 'notistack';
import type { Shift, ShiftType } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
    return <p className="text-lg">Loading...</p>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Shifts</h1>
        <Button onClick={handleAddShift} className="mb-4">
          <Plus className="mr-2 h-4 w-4" />
          Add Shift
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {shifts.map((shift) => {
          const shiftType = shiftTypes.find((type) => type.id === shift.shift_type_id);
          return (
            <Card key={shift.id}>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold">{shiftType?.name || 'Unknown Shift Type'}</h3>
                <p className="text-sm text-muted-foreground">
                  {shift.start_time} - {shift.end_time}
                </p>
                {shiftType && (
                  <div className="mt-2">
                    <div
                      className="w-5 h-5 rounded-full inline-block"
                      style={{ backgroundColor: shiftType.color }}
                    />
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-end space-x-2">
                <Button variant="ghost" size="icon" onClick={() => handleEditShift(shift)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDeleteShift(shift.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingShift ? 'Edit Shift' : 'Add New Shift'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="shiftType">Shift Type</label>
              <Select
                value={editingShift?.shift_type_id || ''}
                onValueChange={(value) => setEditingShift({ ...editingShift!, shift_type_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select shift type" />
                </SelectTrigger>
                <SelectContent>
                  {shiftTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <label htmlFor="startTime">Start Time</label>
              <Input
                id="startTime"
                type="time"
                value={editingShift?.start_time || ''}
                onChange={(e) =>
                  setEditingShift({ ...editingShift!, start_time: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="endTime">End Time</label>
              <Input
                id="endTime"
                type="time"
                value={editingShift?.end_time || ''}
                onChange={(e) =>
                  setEditingShift({ ...editingShift!, end_time: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="breakDuration">Break Duration (minutes)</label>
              <Input
                id="breakDuration"
                type="number"
                value={editingShift?.break_duration || 0}
                onChange={(e) =>
                  setEditingShift({
                    ...editingShift!,
                    break_duration: parseInt(e.target.value, 10),
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleSaveShift(editingShift)}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShiftsPage; 