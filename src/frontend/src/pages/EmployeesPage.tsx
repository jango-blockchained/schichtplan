import { useState, useEffect } from 'react';
import { Settings, Plus, Pencil, Trash2, Clock, Calendar, Download, Search, Filter } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEmployees, createEmployee, updateEmployee, deleteEmployee, getSettings } from '../services/api';
import { Employee, CreateEmployeeRequest } from '../types';
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

type ApiEmployee = {
  first_name: string;
  last_name: string;
  employee_group: string;
  contracted_hours: number;
  is_keyholder: boolean;
  is_active: boolean;
  birthday: string | null;
  email: string | null;
  phone: string | null;
  created_at: string | null;
  updated_at: string | null;
  max_daily_hours: number;
  max_weekly_hours: number;
};

type SortableEmployee = Pick<Employee, 'id' | 'first_name' | 'last_name' | 'employee_group' | 'contracted_hours' | 'is_keyholder' | 'is_active' | 'birthday' | 'email' | 'phone'>;

type SortConfig = {
  key: keyof SortableEmployee;
  direction: 'asc' | 'desc';
};

type EmployeeFormData = CreateEmployeeRequest;

const initialFormData: EmployeeFormData = {
  first_name: '',
  last_name: '',
  employee_group: '',
  contracted_hours: 0,
  is_keyholder: false,
  is_active: true,
  birthday: null,
  email: null,
  phone: null,
};

const ITEMS_PER_PAGE = 10;

type FilterState = {
  search: string;
  group: string;
  isKeyholder: boolean | null;
  isActive: boolean | null;
};

type SortableValue = string | number | boolean | null;

const isNotNull = <T,>(value: T | null): value is T => value !== null;

export const EmployeesPage = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedEmployeeForAvailability, setSelectedEmployeeForAvailability] = useState<Employee | null>(null);
  const [selectedEmployeeForAbsence, setSelectedEmployeeForAbsence] = useState<Employee | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<number>>(new Set());
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'first_name',
    direction: 'asc',
  });
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
  const [employees, setEmployees] = useState<Employee[]>([]);

  const { data: employeesData, isLoading, error } = useQuery({
    queryKey: ['employees'],
    queryFn: getEmployees,
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  // Update employees state when data is loaded
  useEffect(() => {
    if (employeesData) {
      setEmployees(employeesData);
    }
  }, [employeesData]);

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
        birthday: employee.birthday || null,
        email: employee.email || null,
        phone: employee.phone || null,
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

  const handleSubmit = async () => {
    try {
      if (editingEmployee) {
        const updatedEmployee = await updateEmployee(editingEmployee.id, formData);
        setEmployees(current =>
          current.map(emp => (emp.id === updatedEmployee.id ? updatedEmployee : emp))
        );
      } else {
        const newEmployee = await createEmployee(formData);
        setEmployees(current => [...current, newEmployee]);
      }
      handleCloseDialog();
      toast({
        title: `Employee ${editingEmployee ? 'updated' : 'created'} successfully`,
        variant: 'default',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
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

  const handleSort = (key: keyof SortableEmployee) => {
    setSortConfig({
      key,
      direction:
        sortConfig?.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc',
    });

    setEmployees(current => {
      return [...current].sort((a, b) => {
        const direction = sortConfig.direction === 'asc' ? 1 : -1;
        const aValue = a[key];
        const bValue = b[key];

        // If either value is undefined (column doesn't exist), treat as equal
        if (aValue === undefined && bValue === undefined) return 0;
        if (aValue === undefined) return 1;
        if (bValue === undefined) return -1;

        // Handle null values
        if (aValue === null && bValue === null) return 0;
        if (aValue === null) return 1;
        if (bValue === null) return -1;

        // Now we know both values are defined and not null
        if (typeof aValue === 'boolean') {
          return (aValue === bValue ? 0 : aValue ? -1 : 1) * direction;
        }

        // Safe comparison for strings and numbers
        return String(aValue).localeCompare(String(bValue)) * direction;
      });
    });
  };

  const getSortedEmployees = (employees: Employee[]) => {
    if (!employees) return [];

    return [...employees].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      // If either value is undefined (column doesn't exist), treat as equal
      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return 1;
      if (bValue === undefined) return -1;

      // Handle null values
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      const direction = sortConfig.direction === 'asc' ? 1 : -1;

      // Now we know both values are defined and not null
      if (typeof aValue === 'boolean') {
        return (aValue === bValue ? 0 : aValue ? -1 : 1) * direction;
      }

      // Safe comparison for strings and numbers
      return String(aValue).localeCompare(String(bValue)) * direction;
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
    const selectedData = employees.filter(emp => selectedEmployees.has(emp.id));
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
      employee.employee_id.toLowerCase().includes(searchLower) ||
      (employee.email?.toLowerCase().includes(searchLower) ?? false) ||
      (employee.phone?.toLowerCase().includes(searchLower) ?? false);

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
                onValueChange={(value) => setFilters(f => ({ ...f, group: value === 'all' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Alle Gruppen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Gruppen</SelectItem>
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
                value={filters.isKeyholder === null ? 'all' : filters.isKeyholder.toString()}
                onValueChange={(value) => setFilters(f => ({ ...f, isKeyholder: value === 'all' ? null : value === 'true' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Alle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="true">Ja</SelectItem>
                  <SelectItem value="false">Nein</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-2">
              <Label>Status</Label>
              <Select
                value={filters.isActive === null ? 'all' : filters.isActive.toString()}
                onValueChange={(value) => setFilters(f => ({ ...f, isActive: value === 'all' ? null : value === 'true' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Alle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="true">Aktiv</SelectItem>
                  <SelectItem value="false">Inaktiv</SelectItem>
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
              <TableHead onClick={() => handleSort('first_name')}>
                Name {sortConfig.key === 'first_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead onClick={() => handleSort('employee_group')}>
                Group {sortConfig.key === 'employee_group' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead onClick={() => handleSort('contracted_hours')}>
                Hours {sortConfig.key === 'contracted_hours' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead onClick={() => handleSort('birthday')}>
                Birthday {sortConfig.key === 'birthday' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
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
                <TableCell>{employee.first_name} {employee.last_name}</TableCell>
                <TableCell>{getGroup(employee.employee_group)?.name || employee.employee_group}</TableCell>
                <TableCell>{employee.contracted_hours}</TableCell>
                <TableCell>
                  {employee.birthday ? new Date(employee.birthday).toLocaleDateString() : '-'}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col space-y-1">
                    {employee.email && (
                      <span className="text-sm text-muted-foreground">{employee.email}</span>
                    )}
                    {employee.phone && (
                      <span className="text-sm text-muted-foreground">{employee.phone}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col space-y-1">
                    {employee.is_keyholder && (
                      <Badge variant="secondary">Keyholder</Badge>
                    )}
                    {!employee.is_active && (
                      <Badge variant="destructive">Inactive</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(employee)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedEmployeeForAvailability(employee)}
                    >
                      <Clock className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedEmployeeForAbsence(employee)}
                    >
                      <Calendar className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => deleteMutation.mutate(employee.id)}
                    >
                      <Trash2 className="h-4 w-4" />
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
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Birthday</Label>
                <Input
                  type="date"
                  value={formData.birthday || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, birthday: e.target.value || null }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value || null }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value || null }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Group</Label>
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hours</Label>
                <Input
                  type="number"
                  min={getHoursRange(formData.employee_group)[0]}
                  max={getHoursRange(formData.employee_group)[1]}
                  value={formData.contracted_hours}
                  onChange={(e) => setFormData({ ...formData, contracted_hours: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-4 pt-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.is_keyholder}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_keyholder: checked })}
                  />
                  <Label>Keyholder</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label>Active</Label>
                </div>
              </div>
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