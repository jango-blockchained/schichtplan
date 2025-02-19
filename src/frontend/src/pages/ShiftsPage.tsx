import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { Shift, ShiftType } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

interface ShiftsPageProps { }

const ShiftsPage: React.FC<ShiftsPageProps> = () => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const { toast } = useToast();

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
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error loading shifts"
      });
    }
  };

  const fetchShiftTypes = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      setShiftTypes(data.employee_groups.shift_types || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error loading shift types"
      });
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
        toast({
          title: "Success",
          description: "Shift deleted successfully"
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error deleting shift"
      });
    }
  };

  const handleSaveShift = async (formData: any) => {
    try {
      const method = editingShift ? 'PUT' : 'POST';
      const url = editingShift ? `/api/shifts/${editingShift.id}` : '/api/shifts';

      // Find the shift type name from the ID
      const shiftType = shiftTypes.find(t => t.id === formData.type_id);
      if (!shiftType) {
        throw new Error('Invalid shift type selected');
      }

      const payload = {
        shift_type: shiftType.name,
        start_time: formData.start_time,
        end_time: formData.end_time,
        min_employees: parseInt(formData.min_employees),
        max_employees: parseInt(formData.max_employees)
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save shift');
      }

      fetchShifts();
      setEditDialogOpen(false);
      toast({
        title: "Success",
        description: `Shift ${editingShift ? 'updated' : 'created'} successfully`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Error saving shift"
      });
    }
  };

  if (loading) {
    return <p className="text-lg">Loading...</p>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Shifts</h1>
        <Button onClick={handleAddShift}>
          <Plus className="mr-2 h-4 w-4" />
          Add Shift
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shifts.map((shift) => (
            <Card key={shift.id}>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-2">{shift.name}</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Type: {shiftTypes.find(t => t.id === shift.type_id)?.name || 'Unknown'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Time: {shift.start_time} - {shift.end_time}
                </p>
              </CardContent>
              <CardFooter className="flex justify-end space-x-2">
                <Button variant="outline" size="sm" onClick={() => handleEditShift(shift)}>
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDeleteShift(shift.id)}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingShift ? 'Edit Shift' : 'Add Shift'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            handleSaveShift({
              name: formData.get('name'),
              type_id: formData.get('type_id'),
              start_time: formData.get('start_time'),
              end_time: formData.get('end_time'),
              min_employees: parseInt(formData.get('min_employees') as string) || 1,
              max_employees: parseInt(formData.get('max_employees') as string) || 5,
            });
          }}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label htmlFor="name" className="text-sm font-medium">Name</label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editingShift?.name || ''}
                  required
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="type_id" className="text-sm font-medium">Type</label>
                <Select name="type_id" defaultValue={editingShift?.type_id || ''} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a type" />
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
                <label htmlFor="start_time" className="text-sm font-medium">Start Time</label>
                <Input
                  id="start_time"
                  name="start_time"
                  type="time"
                  defaultValue={editingShift?.start_time || ''}
                  required
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="end_time" className="text-sm font-medium">End Time</label>
                <Input
                  id="end_time"
                  name="end_time"
                  type="time"
                  defaultValue={editingShift?.end_time || ''}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label htmlFor="min_employees" className="text-sm font-medium">Min Employees</label>
                  <Input
                    id="min_employees"
                    name="min_employees"
                    type="number"
                    min="1"
                    defaultValue={editingShift?.min_employees || 1}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="max_employees" className="text-sm font-medium">Max Employees</label>
                  <Input
                    id="max_employees"
                    name="max_employees"
                    type="number"
                    min="1"
                    defaultValue={editingShift?.max_employees || 5}
                    required
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingShift ? 'Save Changes' : 'Create Shift'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShiftsPage; 