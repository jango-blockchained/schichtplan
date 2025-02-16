import * as React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import { Employee, EmployeeGroup, TimeSlot } from '../types';
import { AvailabilityCalendar } from './AvailabilityCalendar';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (employee: Omit<Employee, 'id'>) => void;
  employee?: Employee;
}

export const EmployeeForm: React.FC<Props> = ({ open, onClose, onSubmit, employee }) => {
  const [formData, setFormData] = React.useState<Omit<Employee, 'id'>>({
    employee_id: '',
    first_name: '',
    last_name: '',
    employee_group: EmployeeGroup.TZ,
    contracted_hours: 20,
    availability: [],
  });

  React.useEffect(() => {
    if (employee) {
      setFormData({
        employee_id: employee.employee_id,
        first_name: employee.first_name,
        last_name: employee.last_name,
        employee_group: employee.employee_group,
        contracted_hours: employee.contracted_hours,
        availability: employee.availability || [],
      });
    }
  }, [employee]);

  const handleChange = (field: keyof Omit<Employee, 'id'>) => (
    event: React.ChangeEvent<HTMLInputElement | { value: unknown }>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleAvailabilityChange = (newAvailability: TimeSlot[]) => {
    setFormData((prev) => ({
      ...prev,
      availability: newAvailability,
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{employee ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Mitarbeiter-ID"
              value={formData.employee_id}
              onChange={handleChange('employee_id')}
              required
            />
            <TextField
              label="Vorname"
              value={formData.first_name}
              onChange={handleChange('first_name')}
              required
            />
            <TextField
              label="Nachname"
              value={formData.last_name}
              onChange={handleChange('last_name')}
              required
            />
            <FormControl fullWidth>
              <InputLabel>Mitarbeitergruppe</InputLabel>
              <Select
                value={formData.employee_group}
                onChange={handleChange('employee_group')}
                label="Mitarbeitergruppe"
                required
              >
                <MenuItem value={EmployeeGroup.VL}>Vollzeit</MenuItem>
                <MenuItem value={EmployeeGroup.TZ}>Teilzeit</MenuItem>
                <MenuItem value={EmployeeGroup.GFB}>Geringfügig Beschäftigt</MenuItem>
                <MenuItem value={EmployeeGroup.TL}>Teamleiter</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Vertragsstunden"
              type="number"
              value={formData.contracted_hours}
              onChange={handleChange('contracted_hours')}
              required
              inputProps={{ min: 0, max: 40, step: 0.5 }}
            />
            <AvailabilityCalendar
              availability={formData.availability}
              onChange={handleAvailabilityChange}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button type="submit" variant="contained">
            Speichern
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}; 