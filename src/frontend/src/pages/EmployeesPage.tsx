import { useState } from 'react';
import { Settings, Plus, Pencil, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEmployees, createEmployee, updateEmployee, deleteEmployee } from '../services/api';
import { Employee } from '../types';
import { useEmployeeGroups, EmployeeGroup } from '../hooks/useEmployeeGroups';
import EmployeeSettingsEditor from '../components/EmployeeSettingsEditor';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

type EmployeeFormData = Omit<Employee, 'id' | 'employee_id'>;

const initialFormData: EmployeeFormData = {
  first_name: '',
  last_name: '',
  employee_group: 'VL',
  contracted_hours: 40,
  is_keyholder: false,
  email: '',
  phone: '',
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
    mutationFn: (data: EmployeeFormData) => createEmployee(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      handleCloseDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (params: { id: number; data: EmployeeFormData }) =>
      updateEmployee(params.id, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      handleCloseDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEmployee(id),
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
        email: employee.email,
        phone: employee.phone,
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
        contracted_hours: Number(group.minHours),
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
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">Mitarbeiter</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSettingsDialogOpen(true)}
            className="ml-2"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Mitarbeiter hinzufügen
        </Button>
      </div>

      {error ? (
        <div className="rounded-md bg-destructive/15 p-4 text-destructive">
          Fehler beim Laden der Mitarbeiter
        </div>
      ) : isLoading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kürzel</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Gruppe</TableHead>
                <TableHead>Stunden</TableHead>
                <TableHead>Schlüssel</TableHead>
                <TableHead>Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees?.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>{employee.employee_id}</TableCell>
                  <TableCell>{`${employee.first_name} ${employee.last_name}`}</TableCell>
                  <TableCell>{getGroup(employee.employee_group)?.name || employee.employee_group}</TableCell>
                  <TableCell>{employee.contracted_hours}</TableCell>
                  <TableCell>{employee.is_keyholder ? 'Ja' : 'Nein'}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(employee)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Bearbeiten
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => deleteMutation.mutate(employee.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Löschen
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Employee Settings Dialog */}
      <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Mitarbeitergruppen verwalten</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <EmployeeSettingsEditor
              groups={employeeGroups}
              onChange={handleEmployeeGroupsChange}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsDialogOpen(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="firstName">Vorname</Label>
              <Input
                id="firstName"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName">Nachname</Label>
              <Input
                id="lastName"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="employeeGroup">Mitarbeitergruppe</Label>
              <Select
                value={formData.employee_group}
                onValueChange={handleEmployeeGroupChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Gruppe auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {employeeGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="hours">Stunden</Label>
              <Input
                id="hours"
                type="number"
                min={0}
                max={48}
                step={0.5}
                value={formData.contracted_hours}
                onChange={(e) =>
                  setFormData({ ...formData, contracted_hours: Number(e.target.value) })
                }
              />
              <p className="text-sm text-muted-foreground">
                {getGroup(formData.employee_group)?.description || ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="isKeyholder"
                checked={formData.is_keyholder}
                onCheckedChange={(checked: boolean) =>
                  setFormData({ ...formData, is_keyholder: checked })
                }
              />
              <Label htmlFor="isKeyholder">Schlüsselträger</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Abbrechen
            </Button>
            <Button onClick={handleSubmit}>
              {editingEmployee ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}; 