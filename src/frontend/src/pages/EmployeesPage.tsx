import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEmployees, createEmployee, updateEmployee, deleteEmployee } from '../services/api';
import { Employee } from '../types';
import { useEmployeeGroups, EmployeeGroup } from '../hooks/useEmployeeGroups';
import EmployeeSettingsEditor from '../components/EmployeeSettingsEditor';

interface EmployeeFormData {
  first_name: string;
  last_name: string;
  employee_group: string;
  contracted_hours: number;
  is_keyholder: boolean;
}

const initialFormData: EmployeeFormData = {
  first_name: '',
  last_name: '',
  employee_group: 'VL',
  contracted_hours: 40,
  is_keyholder: false,
};

export const EmployeesPage = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<EmployeeFormData>(initialFormData);
  const queryClient = useQueryClient();
  const { employeeGroups, getGroup, getHoursRange } = useEmployeeGroups();

  const { data: employees, isLoading, error } = useQuery({
    queryKey: ['employees'],
    queryFn: getEmployees,
  });

  const createMutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      handleCloseDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Employee> }) =>
      updateEmployee(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      handleCloseDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  const handleOpenDialog = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        first_name: employee.first_name,
        last_name: employee.last_name,
        employee_group: employee.employee_group,
        contracted_hours: employee.contracted_hours,
        is_keyholder: employee.is_keyholder,
      });
    } else {
      setEditingEmployee(null);
      setFormData(initialFormData);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingEmployee(null);
    setFormData(initialFormData);
  };

  const handleSubmit = () => {
    if (editingEmployee) {
      updateMutation.mutate({
        id: editingEmployee.id,
        data: formData
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEmployeeGroupChange = (groupId: string) => {
    const group = getGroup(groupId);
    if (group) {
      setFormData({
        ...formData,
        employee_group: groupId,
        contracted_hours: group.minHours,
      });
    }
  };

  const handleEmployeeGroupsChange = (newGroups: EmployeeGroup[]) => {
    queryClient.invalidateQueries({ queryKey: ['employees'] });
  };

  const getAvailableHours = (groupId: string): number[] => {
    const [min, max] = getHoursRange(groupId);
    if (min === max) {
      return [min];
    }
    const hours: number[] = [];
    for (let i = min; i <= max; i += 10) {
      hours.push(i);
    }
    return hours;
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h4">Mitarbeiter</Typography>
          <Tooltip title="Mitarbeitergruppen verwalten">
            <IconButton onClick={() => setIsSettingsDialogOpen(true)} size="small">
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <Button variant="contained" onClick={() => handleOpenDialog()}>
          Mitarbeiter hinzufügen
        </Button>
      </Box>

      {error ? (
        <Alert severity="error">Fehler beim Laden der Mitarbeiter</Alert>
      ) : isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Kürzel</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Gruppe</TableCell>
                <TableCell>Stunden</TableCell>
                <TableCell>Schlüssel</TableCell>
                <TableCell>Aktionen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {employees?.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>{employee.employee_id}</TableCell>
                  <TableCell>{`${employee.first_name} ${employee.last_name}`}</TableCell>
                  <TableCell>{getGroup(employee.employee_group)?.name || employee.employee_group}</TableCell>
                  <TableCell>{employee.contracted_hours}</TableCell>
                  <TableCell>{employee.is_keyholder ? 'Ja' : 'Nein'}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleOpenDialog(employee)}
                      >
                        Bearbeiten
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={() => deleteMutation.mutate(employee.id)}
                      >
                        Löschen
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Employee Settings Dialog */}
      <Dialog
        open={isSettingsDialogOpen}
        onClose={() => setIsSettingsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Mitarbeitergruppen verwalten</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <EmployeeSettingsEditor
              groups={employeeGroups}
              onChange={handleEmployeeGroupsChange}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsSettingsDialogOpen(false)}>Schließen</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isDialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingEmployee ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="Vorname"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              fullWidth
            />
            <TextField
              label="Nachname"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Mitarbeitergruppe</InputLabel>
              <Select
                value={formData.employee_group}
                onChange={(e) => handleEmployeeGroupChange(e.target.value)}
                label="Mitarbeitergruppe"
                aria-label="Mitarbeitergruppe"
              >
                {employeeGroups.map((group) => (
                  <MenuItem key={group.id} value={group.id}>
                    {group.name} ({group.minHours === group.maxHours
                      ? `${group.minHours}h`
                      : `${group.minHours}-${group.maxHours}h`})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Vertragsstunden</InputLabel>
              <Select
                value={formData.contracted_hours}
                onChange={(e) => setFormData({ ...formData, contracted_hours: Number(e.target.value) })}
                label="Vertragsstunden"
              >
                {getAvailableHours(formData.employee_group).map((hours) => (
                  <MenuItem key={hours} value={hours}>
                    {hours} Stunden {getGroup(formData.employee_group)?.isFullTime ? '/ Woche' : '/ Monat'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_keyholder}
                  onChange={(e) =>
                    setFormData({ ...formData, is_keyholder: e.target.checked })
                  }
                />
              }
              label="Schlüsselträger"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Abbrechen</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingEmployee ? 'Speichern' : 'Erstellen'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}; 