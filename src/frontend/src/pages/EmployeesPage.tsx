import { useState } from 'react';
import { Settings, Plus, Pencil, Trash2, Clock, Calendar, Download, Search, Filter } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEmployees, createEmployee, updateEmployee, deleteEmployee, getSettings } from '../services/api';
import { Employee } from '../types';
import { useEmployeeGroups } from '../hooks/useEmployeeGroups';
import { EmployeeAvailabilityModal } from '@/components/EmployeeAvailabilityModal';
import AbsenceModal from '@/components/AbsenceModal';
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Label,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Badge,
} from '@/components/ui';
import { useToast } from "@/components/ui/use-toast";
import { ThemeToggle } from '@/components/ui/theme-toggle';

type EmployeeFormData = Omit<Employee, 'id' | 'employee_id'>;

const initialFormData: EmployeeFormData = {
  first_name: '',
  last_name: '',
  employee_group: '',
  contracted_hours: 0,
  is_keyholder: false,
  is_active: true,
  email: '',
  phone: '',
};

type SortConfig = {
  key: keyof Employee;
  direction: 'asc' | 'desc';
};

const ITEMS_PER_PAGE = 10;

type FilterState = {
  search: string;
  group: string;
  isKeyholder: boolean | null;
  isActive: boolean | null;
};

export const EmployeesPage = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedEmployeeForAvailability, setSelectedEmployeeForAvailability] = useState<Employee | null>(null);
  const [selectedEmployeeForAbsence, setSelectedEmployeeForAbsence] = useState<Employee | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<number>>(new Set());
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'employee_id', direction: 'asc' });
  const [formData, setFormData] = useState<EmployeeFormData>(initialFormData);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { employeeGroups, getGroup, getHoursRange } = useEmployeeGroups();
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    group: '',
    isKeyholder: null,
    isActive: null,
  });

  const { data: employees, isLoading, error } = useQuery({
    queryKey: ['employees'],
    queryFn: getEmployees,
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
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
        is_active: employee.is_active,
        email: employee.email || '',
        phone: employee.phone || '',
      });
    } else {
      const defaultGroup = employeeGroups[0];
      setEditingEmployee(null);
      setFormData({
        ...initialFormData,
        employee_group: defaultGroup.id,
        contracted_hours: defaultGroup.minHours,
      });
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

  const handleSort = (key: keyof Employee) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortedEmployees = (employees: Employee[]) => {
    if (!employees) return [];

    return [...employees].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === undefined || bValue === undefined) return 0;

      const direction = sortConfig.direction === 'asc' ? 1 : -1;
      if (typeof aValue === 'boolean') {
        return (aValue === bValue ? 0 : aValue ? -1 : 1) * direction;
      }
      return aValue < bValue ? -1 * direction : 1 * direction;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = employees?.map(e => e.id) || [];
      setSelectedEmployees(new Set(allIds));
    } else {
      setSelectedEmployees(new Set());
    }
  };

  const handleSelectEmployee = (employeeId: number, checked: boolean) => {
    const newSelected = new Set(selectedEmployees);
    if (checked) {
      newSelected.add(employeeId);
    } else {
      newSelected.delete(employeeId);
    }
    setSelectedEmployees(newSelected);
  };

  const handleExportSelected = () => {
    const selectedData = sortedEmployees.filter(emp => selectedEmployees.has(emp.id));
    const csvContent = [
      ['Kürzel', 'Vorname', 'Nachname', 'Gruppe', 'Stunden', 'Schlüssel', 'Email', 'Telefon'],
      ...selectedData.map(emp => [
        emp.employee_id,
        emp.first_name,
        emp.last_name,
        getGroup(emp.employee_group)?.name || emp.employee_group,
        emp.contracted_hours.toString(),
        emp.is_keyholder ? 'Ja' : 'Nein',
        emp.email || '',
        emp.phone || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'mitarbeiter_export.csv';
    link.click();
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Möchten Sie wirklich ${selectedEmployees.size} Mitarbeiter löschen?`)) {
      selectedEmployees.forEach(id => {
        deleteMutation.mutate(id);
      });
      setSelectedEmployees(new Set());
    }
  };

  const filteredEmployees = (employees || []).filter(employee => {
    const searchLower = filters.search.toLowerCase();
    const matchesSearch =
      employee.first_name.toLowerCase().includes(searchLower) ||
      employee.last_name.toLowerCase().includes(searchLower) ||
      employee.employee_id.toLowerCase().includes(searchLower);

    const matchesGroup = !filters.group || employee.employee_group === filters.group;
    const matchesKeyholder = filters.isKeyholder === null || employee.is_keyholder === filters.isKeyholder;
    const matchesActive = filters.isActive === null || employee.is_active === filters.isActive;

    return matchesSearch && matchesGroup && matchesKeyholder && matchesActive;
  });

  const sortedAndFilteredEmployees = getSortedEmployees(filteredEmployees);
  const totalPages = Math.ceil(sortedAndFilteredEmployees.length / ITEMS_PER_PAGE);
  const paginatedEmployees = sortedAndFilteredEmployees.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  if (error) {
    return (
      <div className="rounded-md bg-destructive/15 p-4 text-destructive">
        Fehler beim Laden der Mitarbeiter
      </div>
    );
  }

  if (isLoading || !employeeGroups.length) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const sortedEmployees = getSortedEmployees(employees || []);
  const allSelected = employees?.length === selectedEmployees.size;

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold">Mitarbeiter</h1>
        <div className="flex gap-2 items-center">
          <ThemeToggle />
          {selectedEmployees.size > 0 && (
            <>
              <Button variant="outline" onClick={() => setSelectedEmployees(new Set())}>
                Auswahl aufheben ({selectedEmployees.size})
              </Button>
              <Button variant="outline" onClick={handleExportSelected}>
                <Download className="mr-2 h-4 w-4" />
                Exportieren
              </Button>
              <Button variant="destructive" onClick={handleBulkDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Löschen
              </Button>
            </>
          )}
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Mitarbeiter hinzufügen
          </Button>
        </div>
      </div>

      <div className="mb-4 flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suchen..."
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
            className="pl-8"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <div className="p-2">
              <Label>Gruppe</Label>
              <Select
                value={filters.group}
                onValueChange={(value) => setFilters(f => ({ ...f, group: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Alle Gruppen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Alle Gruppen</SelectItem>
                  {employeeGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="p-2">
              <Label>Schlüsselträger</Label>
              <Select
                value={filters.isKeyholder?.toString() ?? ''}
                onValueChange={(value) => setFilters(f => ({ ...f, isKeyholder: value === '' ? null : value === 'true' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Alle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Alle</SelectItem>
                  <SelectItem value="true">Ja</SelectItem>
                  <SelectItem value="false">Nein</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('employee_id')}>
                Kürzel {sortConfig.key === 'employee_id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('last_name')}>
                Name {sortConfig.key === 'last_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('employee_group')}>
                Gruppe {sortConfig.key === 'employee_group' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('contracted_hours')}>
                Stunden {sortConfig.key === 'contracted_hours' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('is_keyholder')}>
                Schlüssel {sortConfig.key === 'is_keyholder' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead>Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedEmployees.map((employee) => (
              <TableRow
                key={employee.id}
                className={selectedEmployees.has(employee.id) ? 'bg-muted' : ''}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedEmployees.has(employee.id)}
                    onCheckedChange={(checked) => handleSelectEmployee(employee.id, checked as boolean)}
                  />
                </TableCell>
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
                      onClick={() => setSelectedEmployeeForAvailability(employee)}
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      Verfügbarkeit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedEmployeeForAbsence(employee)}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      Abwesenheit
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

      {totalPages > 1 && (
        <div className="mt-4 flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {sortedAndFilteredEmployees.length} Mitarbeiter gesamt
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Zurück
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm">Seite {currentPage} von {totalPages}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Weiter
            </Button>
          </div>
        </div>
      )}

      {/* Employee Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vorname</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Nachname</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gruppe</Label>
                <Select
                  value={formData.employee_group}
                  onValueChange={handleEmployeeGroupChange}
                >
                  <SelectTrigger>
                    <SelectValue />
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
              <div className="space-y-2">
                <Label>Stunden</Label>
                <Select
                  value={formData.contracted_hours.toString()}
                  onValueChange={(value) => setFormData({ ...formData, contracted_hours: Number(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableHours(formData.employee_group).map((hours) => (
                      <SelectItem key={hours} value={hours.toString()}>
                        {hours}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.is_keyholder}
                onCheckedChange={(checked) => setFormData({ ...formData, is_keyholder: checked })}
              />
              <Label>Schlüsselträger</Label>
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

      {/* Employee Availability Modal */}
      {selectedEmployeeForAvailability && (
        <EmployeeAvailabilityModal
          employeeId={selectedEmployeeForAvailability.id}
          employeeName={`${selectedEmployeeForAvailability.first_name} ${selectedEmployeeForAvailability.last_name}`}
          employeeGroup={getGroup(selectedEmployeeForAvailability.employee_group)?.name || selectedEmployeeForAvailability.employee_group}
          contractedHours={selectedEmployeeForAvailability.contracted_hours}
          isOpen={!!selectedEmployeeForAvailability}
          onClose={() => setSelectedEmployeeForAvailability(null)}
        />
      )}

      {/* Add AbsenceModal */}
      {selectedEmployeeForAbsence && settings && (
        <AbsenceModal
          employeeId={selectedEmployeeForAbsence.id}
          isOpen={!!selectedEmployeeForAbsence}
          onClose={() => setSelectedEmployeeForAbsence(null)}
          absenceTypes={settings.employee_groups.absence_types}
        />
      )}
    </div>
  );
}; 