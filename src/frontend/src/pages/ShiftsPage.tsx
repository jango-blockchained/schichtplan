import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getShifts, createShift, updateShift, deleteShift } from '@/services/api';
import { getSettings } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Card } from '@/components/ui/card';
import { ShiftForm } from '@/components/ShiftForm';
import { ShiftCoverageView } from '@/components/ShiftCoverageView';
import { Shift } from '@/types';
import { Pencil, Trash2, Plus } from 'lucide-react';

interface ShiftsPageProps { }

const ShiftsPage: React.FC<ShiftsPageProps> = () => {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shifts, isLoading: shiftsLoading } = useQuery({
    queryKey: ['shifts'],
    queryFn: getShifts,
  });

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const createMutation = useMutation({
    mutationFn: createShift,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setEditDialogOpen(false);
      toast({
        description: 'Schicht erfolgreich erstellt',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error instanceof Error ? error.message : 'Fehler beim Erstellen der Schicht',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateShift,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setEditDialogOpen(false);
      setEditingShift(null);
      toast({
        description: 'Schicht erfolgreich aktualisiert',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error instanceof Error ? error.message : 'Fehler beim Aktualisieren der Schicht',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteShift,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast({
        description: 'Schicht erfolgreich gelöscht',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error instanceof Error ? error.message : 'Fehler beim Löschen der Schicht',
      });
    },
  });

  const handleAddShift = () => {
    setEditingShift(null);
    setEditDialogOpen(true);
  };

  const handleEditShift = (shift: Shift) => {
    setEditingShift(shift);
    setEditDialogOpen(true);
  };

  const handleDeleteShift = async (shiftId: number) => {
    if (window.confirm('Möchten Sie diese Schicht wirklich löschen?')) {
      await deleteMutation.mutateAsync(shiftId);
    }
  };

  const handleSaveShift = async (data: any) => {
    if (editingShift) {
      await updateMutation.mutateAsync({ id: editingShift.id, ...data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  if (shiftsLoading || settingsLoading || !settings) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Schichten</h1>
        <Button onClick={handleAddShift}>
          <Plus className="h-4 w-4 mr-2" />
          Neue Schicht
        </Button>
      </div>

      {/* Shift Coverage View */}
      {shifts && <ShiftCoverageView settings={settings} shifts={shifts} />}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {shifts?.map((shift) => (
          <Card key={shift.id} className="p-4 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">
                  {shift.start_time} - {shift.end_time}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {shift.duration_hours} Stunden
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEditShift(shift)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteShift(shift.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="text-sm">
              <p>Mitarbeiter: {shift.min_employees} - {shift.max_employees}</p>
              <p>Pause: {shift.requires_break ? 'Ja' : 'Nein'}</p>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingShift ? 'Schicht bearbeiten' : 'Neue Schicht'}</DialogTitle>
          </DialogHeader>
          <ShiftForm
            settings={settings}
            initialData={editingShift || undefined}
            onSave={handleSaveShift}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShiftsPage; 