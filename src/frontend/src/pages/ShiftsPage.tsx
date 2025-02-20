import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { Shift } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery } from '@tanstack/react-query';
import { getSettings } from '@/services/api';
import { Label } from '@/components/ui/label';

interface ShiftsPageProps { }

const ShiftsPage: React.FC<ShiftsPageProps> = () => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const { toast } = useToast();

  // Fetch store settings for opening hours
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    try {
      const response = await fetch('/shifts');
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
      const response = await fetch(`/shifts/${shiftId}`, {
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
      const url = editingShift ? `/shifts/${editingShift.id}` : '/shifts';

      const payload = {
        start_time: formData.start_time,
        end_time: formData.end_time,
        min_employees: parseInt(formData.min_employees),
        max_employees: parseInt(formData.max_employees),
        requires_break: formData.requires_break === 'on'
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if it's a validation error (400)
        if (response.status === 400) {
          throw new Error(data.error || 'Invalid shift times. Please check store opening hours.');
        }
        throw new Error(data.error || 'Failed to save shift');
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shifts.map((shift) => (
          <Card key={shift.id}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-2">
                Time: {shift.start_time} - {shift.end_time}
              </p>
              <p className="text-sm text-muted-foreground">
                Employees: {shift.min_employees} - {shift.max_employees}
              </p>
              <p className="text-sm text-muted-foreground">
                Break Required: {shift.requires_break ? 'Yes' : 'No'}
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

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingShift ? 'Edit Shift' : 'Add Shift'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            handleSaveShift({
              start_time: formData.get('start_time'),
              end_time: formData.get('end_time'),
              min_employees: formData.get('min_employees'),
              max_employees: formData.get('max_employees'),
              requires_break: formData.get('requires_break')
            });
          }}>
            <div className="grid gap-4 py-4">
              {settings && (
                <p className="text-sm text-muted-foreground">
                  Store hours: {settings.general.store_opening} - {settings.general.store_closing}
                </p>
              )}
              <div className="grid gap-2">
                <Label htmlFor="start_time" className="text-sm font-medium">Start Time</Label>
                <Input
                  id="start_time"
                  name="start_time"
                  type="time"
                  defaultValue={editingShift?.start_time || settings?.general.store_opening || '09:00'}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="end_time" className="text-sm font-medium">End Time</Label>
                <Input
                  id="end_time"
                  name="end_time"
                  type="time"
                  defaultValue={editingShift?.end_time || '17:00'}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="min_employees" className="text-sm font-medium">Minimum Employees</Label>
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
                <Label htmlFor="max_employees" className="text-sm font-medium">Maximum Employees</Label>
                <Input
                  id="max_employees"
                  name="max_employees"
                  type="number"
                  min="1"
                  defaultValue={editingShift?.max_employees || 5}
                  required
                />
              </div>
              <div className="grid gap-2">
                <label className="flex items-center space-x-2">
                  <Checkbox
                    id="requires_break"
                    name="requires_break"
                    defaultChecked={editingShift?.requires_break ?? true}
                  />
                  <span className="text-sm font-medium">Requires Break</span>
                </label>
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