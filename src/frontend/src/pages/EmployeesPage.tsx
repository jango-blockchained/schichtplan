import AbsenceModal from "@/components/AbsenceModal";
import CSVImportDialog from "@/components/CSVImportDialog";
import { EmployeeAvailabilityModal } from "@/components/EmployeeAvailabilityModal";
import { EmployeeTable } from "@/components/tables";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@/components/ui";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useToast } from "@/components/ui/use-toast";
import { ContentCard, PageLayout } from "@/layouts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Upload } from "lucide-react";
import { useState } from "react";
import { useEmployeeGroups } from "../hooks/useEmployeeGroups";
import {
  createEmployee,
  deleteEmployee,
  getEmployees,
  getSettings,
  updateEmployee,
} from "../services/api";
import { CreateEmployeeRequest, Employee } from "../types";

type EmployeeFormData = CreateEmployeeRequest;

const initialFormData: EmployeeFormData = {
  first_name: "",
  last_name: "",
  employee_group: "",
  contracted_hours: 0,
  vacation_per_year: 30,
  is_keyholder: false,
  is_active: true,
  birthday: null,
  email: null,
  phone: null,
};

export const EmployeesPage = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedEmployeeForAvailability, setSelectedEmployeeForAvailability] =
    useState<Employee | null>(null);
  const [selectedEmployeeForAbsence, setSelectedEmployeeForAbsence] =
    useState<Employee | null>(null);
  const [isCSVImportOpen, setIsCSVImportOpen] = useState(false);
  const [formData, setFormData] = useState<EmployeeFormData>(initialFormData);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { employeeGroups, getGroup } = useEmployeeGroups();

  // Load settings for absence types
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const {
    data: employees = [],
    isLoading: isLoadingEmployees,
    error: errorEmployees,
  } = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
  });

  const createMutation = useMutation({
    mutationFn: (data: EmployeeFormData) => createEmployee(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      handleCloseDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (params: { id: number; data: EmployeeFormData }) =>
      updateEmployee(params.id, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      handleCloseDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEmployee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
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
        vacation_per_year: employee.vacation_per_year ?? 30,
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
        employee_group: defaultGroup ? defaultGroup.id : "",
        contracted_hours: 0,
        vacation_per_year: 30,
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
        await updateMutation.mutateAsync({
          id: editingEmployee.id,
          data: formData,
        });
      } else {
        await createMutation.mutateAsync(formData);
      }
      toast({
        title: `Employee ${editingEmployee ? "updated" : "created"} successfully`,
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleEmployeeGroupChange = (groupId: string) => {
    setFormData({
      ...formData,
      employee_group: groupId,
    });
  };

  const handleEdit = (employee: Employee) => {
    handleOpenDialog(employee);
  };

  const handleDelete = (employee: Employee) => {
    if (
      window.confirm(
        `Delete employee ${employee.first_name} ${employee.last_name}?`,
      )
    ) {
      deleteMutation.mutate(employee.id);
    }
  };

  const handleBulkExport = (selectedEmployees: Employee[]) => {
    const csvContent = [
      [
        "Kürzel",
        "Vorname",
        "Nachname",
        "Gruppe",
        "Stunden",
        "Schlüssel",
        "Email",
        "Telefon",
      ],
      ...selectedEmployees.map((emp) => [
        emp.employee_id,
        emp.first_name,
        emp.last_name,
        getGroup(emp.employee_group)?.name || emp.employee_group,
        emp.contracted_hours.toString(),
        emp.is_keyholder ? "Ja" : "Nein",
        emp.email || "",
        emp.phone || "",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "mitarbeiter_export.csv";
    link.click();
  };

  const handleBulkDelete = (selectedEmployees: Employee[]) => {
    if (
      window.confirm(
        `Möchten Sie wirklich ${selectedEmployees.length} Mitarbeiter löschen?`,
      )
    ) {
      selectedEmployees.forEach((employee) => {
        deleteMutation.mutate(employee.id);
      });
    }
  };

  const handleCSVImportComplete = (result: {
    success: boolean;
    imported_count?: number;
    error?: string;
  }) => {
    toast({
      title: result.success ? "Erfolg" : "Fehler",
      description: result.success
        ? `${result.imported_count || 0} Mitarbeiter erfolgreich importiert.`
        : result.error,
      variant: result.success ? "default" : "destructive",
    });

    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    }
  };

  if (errorEmployees) {
    return (
      <div className="rounded-md bg-destructive/15 p-4 text-destructive">
        Fehler beim Laden der Mitarbeiter: {(errorEmployees as Error).message}
      </div>
    );
  }

  if (isLoadingEmployees) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!employeeGroups.length) {
    return (
      <div className="rounded-md bg-amber-100 p-4 text-amber-700">
        Mitarbeitergruppen-Einstellungen konnten nicht geladen werden oder sind
        leer. Bitte überprüfen Sie die Einstellungen.
      </div>
    );
  }

  return (
    <PageLayout
      title="Mitarbeiter"
      description="Verwalte deine Mitarbeiter und deren Verfügbarkeiten"
      breadcrumbs={[
        { href: "/", label: "Home" },
        { label: "Mitarbeiter", isCurrentPage: true },
      ]}
      headerActions={
        <div className="flex gap-2 items-center">
          <ThemeToggle />
          <Button variant="outline" onClick={() => setIsCSVImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            CSV Import
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Mitarbeiter hinzufügen
          </Button>
        </div>
      }
    >
      <ContentCard
        title="Mitarbeiterliste"
        description="Übersicht aller Mitarbeiter mit Verwaltungsoptionen"
      >
        <EmployeeTable
          employees={employees}
          employeeGroups={employeeGroups}
          loading={isLoadingEmployees}
          error={errorEmployees ? (errorEmployees as Error).message : null}
          onEdit={handleEdit}
          onManageAvailability={setSelectedEmployeeForAvailability}
          onManageAbsence={setSelectedEmployeeForAbsence}
          onDelete={handleDelete}
          bulkActions={{
            onExport: handleBulkExport,
            onBulkDelete: handleBulkDelete,
          }}
        />
      </ContentCard>

      {/* Employee Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? "Mitarbeiter bearbeiten" : "Neuer Mitarbeiter"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) =>
                    setFormData({ ...formData, first_name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) =>
                    setFormData({ ...formData, last_name: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Birthday</Label>
                <Input
                  type="date"
                  value={formData.birthday || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      birthday: e.target.value || null,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      email: e.target.value || null,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  type="tel"
                  value={formData.phone || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      phone: e.target.value || null,
                    }))
                  }
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
                  step="0.5"
                  min={0}
                  max={48}
                  value={formData.contracted_hours}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      contracted_hours: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Vacation Days / Year</Label>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={formData.vacation_per_year}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setFormData({
                      ...formData,
                      vacation_per_year: Number.isFinite(value) ? value : 0,
                    });
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-4 pt-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.is_keyholder}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_keyholder: checked })
                    }
                  />
                  <Label>Keyholder</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: checked })
                    }
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
              {editingEmployee ? "Speichern" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee Availability Modal */}
      {selectedEmployeeForAvailability && (
        <EmployeeAvailabilityModal
          employeeId={selectedEmployeeForAvailability.id}
          employeeName={`${selectedEmployeeForAvailability.first_name} ${selectedEmployeeForAvailability.last_name}`}
          employeeGroup={
            getGroup(selectedEmployeeForAvailability.employee_group)?.name ||
            selectedEmployeeForAvailability.employee_group
          }
          contractedHours={selectedEmployeeForAvailability.contracted_hours}
          isOpen={!!selectedEmployeeForAvailability}
          onClose={() => setSelectedEmployeeForAvailability(null)}
        />
      )}

      {/* Add AbsenceModal */}
      {selectedEmployeeForAbsence && (
        <AbsenceModal
          employeeId={selectedEmployeeForAbsence.id}
          isOpen={!!selectedEmployeeForAbsence}
          onClose={() => setSelectedEmployeeForAbsence(null)}
          absenceTypes={
            settings?.employee_groups?.absence_types?.filter(
              (
                type,
              ): type is {
                id: string;
                name: string;
                color: string;
                type: "absence_type";
              } => type.type === "absence_type",
            ) || []
          }
        />
      )}

      {/* CSV Import Dialog */}
      <CSVImportDialog
        open={isCSVImportOpen}
        onClose={() => setIsCSVImportOpen(false)}
        onImportComplete={handleCSVImportComplete}
      />
    </PageLayout>
  );
};
