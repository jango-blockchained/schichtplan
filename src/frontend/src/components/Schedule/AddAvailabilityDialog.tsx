import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import React, { useState } from 'react';

interface AddAvailabilityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (availability: {
    employee_id: number;
    date: string;
    shift_type: string;
    availability_type: string;
  }) => void;
  employees: Array<{ id: number; name: string; vorname: string }>;
}

export const AddAvailabilityDialog: React.FC<AddAvailabilityDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  employees,
}) => {
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [shiftType, setShiftType] = useState<string>('');
  const [availabilityType, setAvailabilityType] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedEmployee || !date || !shiftType || !availabilityType) {
      return;
    }

    onSubmit({
      employee_id: parseInt(selectedEmployee),
      date,
      shift_type: shiftType,
      availability_type: availabilityType,
    });

    // Reset form
    setSelectedEmployee('');
    setDate('');
    setShiftType('');
    setAvailabilityType('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Verfügbarkeit hinzufügen</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="employee">Mitarbeiter</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger>
                <SelectValue placeholder="Mitarbeiter auswählen" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id.toString()}>
                    {employee.vorname} {employee.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Datum</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shift-type">Schichttyp</Label>
            <Select value={shiftType} onValueChange={setShiftType}>
              <SelectTrigger>
                <SelectValue placeholder="Schichttyp auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="early">Früh</SelectItem>
                <SelectItem value="late">Spät</SelectItem>
                <SelectItem value="full">Ganztägig</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="availability-type">Verfügbarkeitstyp</Label>
            <Select value={availabilityType} onValueChange={setAvailabilityType}>
              <SelectTrigger>
                <SelectValue placeholder="Verfügbarkeitstyp auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FIXED">Fest</SelectItem>
                <SelectItem value="PREFERRED">Bevorzugt</SelectItem>
                <SelectItem value="UNAVAILABLE">Nicht verfügbar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit">Hinzufügen</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddAvailabilityDialog;
