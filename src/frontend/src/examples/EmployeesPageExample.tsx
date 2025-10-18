import { PageHeader } from "@/components/PageHeader";
import { EmployeeTable } from "@/components/tables";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useToast } from "@/components/ui/use-toast";
import { useEmployeeGroups } from "@/hooks/useEmployeeGroups";
import { getEmployees, getSettings } from "@/services/api";
import { AbsenceType, Employee } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { Plus, Upload } from "lucide-react";
import { useState } from "react";

// Import your existing modals
import AbsenceModal from "@/components/AbsenceModal";
import CSVImportDialog from "@/components/CSVImportDialog";
import { EmployeeAvailabilityModal } from "@/components/EmployeeAvailabilityModal";

export const EmployeesPageExample = () => {
  const [selectedEmployeeForAvailability, setSelectedEmployeeForAvailability] =
    useState<Employee | null>(null);
  const [selectedEmployeeForAbsence, setSelectedEmployeeForAbsence] =
    useState<Employee | null>(null);
  const [isCSVImportOpen, setIsCSVImportOpen] = useState(false);
  const { toast } = useToast();
  const { employeeGroups, getGroup } = useEmployeeGroups();

  const {
    data: employees = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const handleEditEmployee = (employee: Employee) => {
    // Open your existing employee edit modal
    console.log("Edit employee:", employee);
    // setIsDialogOpen(true);
    // setEditingEmployee(employee);
  };

  const handleDeleteEmployee = (employee: Employee) => {
    if (
      window.confirm(
        `Delete employee ${employee.first_name} ${employee.last_name}?`,
      )
    ) {
      // Implement delete logic
      console.log("Delete employee:", employee);
    }
  };

  const handleBulkExport = (employees: Employee[]) => {
    const csvContent = [
      [
        "ID",
        "First Name",
        "Last Name",
        "Group",
        "Hours",
        "Keyholder",
        "Email",
        "Phone",
      ],
      ...employees.map((emp) => [
        emp.employee_id,
        emp.first_name,
        emp.last_name,
        getGroup(emp.employee_group)?.name || emp.employee_group,
        emp.contracted_hours.toString(),
        emp.is_keyholder ? "Yes" : "No",
        emp.email || "",
        emp.phone || "",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "employees_export.csv";
    link.click();
  };

  const handleBulkDelete = (employees: Employee[]) => {
    if (window.confirm(`Delete ${employees.length} employees?`)) {
      // Implement bulk delete logic
      console.log("Bulk delete employees:", employees);
    }
  };

  const handleCSVImportComplete = (result: {
    success: boolean;
    imported_count?: number;
    error?: string;
  }) => {
    toast({
      title: result.success ? "Success" : "Error",
      description: result.success
        ? `${result.imported_count || 0} employees imported successfully.`
        : result.error,
      variant: result.success ? "default" : "destructive",
    });
  };

  if (error) {
    return (
      <div className="rounded-md bg-destructive/15 p-4 text-destructive">
        Error loading employees: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-8">
      <PageHeader
        title="Employees"
        description="Manage your employees and their availability"
        actions={
          <div className="flex gap-2 items-center">
            <ThemeToggle />
            <Button variant="outline" onClick={() => setIsCSVImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              CSV Import
            </Button>
            <Button onClick={() => console.log("Add employee")}>
              <Plus className="mr-2 h-4 w-4" />
              Add Employee
            </Button>
          </div>
        }
      />

      <EmployeeTable
        employees={employees}
        employeeGroups={employeeGroups}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        onEdit={handleEditEmployee}
        onManageAvailability={setSelectedEmployeeForAvailability}
        onManageAbsence={setSelectedEmployeeForAbsence}
        onDelete={handleDeleteEmployee}
        bulkActions={{
          onExport: handleBulkExport,
          onBulkDelete: handleBulkDelete,
        }}
      />

      {/* Modals */}
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

      {selectedEmployeeForAbsence && (
        <AbsenceModal
          employeeId={selectedEmployeeForAbsence.id}
          isOpen={!!selectedEmployeeForAbsence}
          onClose={() => setSelectedEmployeeForAbsence(null)}
          absenceTypes={
            (settings?.employee_groups?.absence_types?.filter(
              (type) => type.type === "absence_type",
            ) as AbsenceType[]) || []
          }
        />
      )}

      <CSVImportDialog
        open={isCSVImportOpen}
        onClose={() => setIsCSVImportOpen(false)}
        onImportComplete={handleCSVImportComplete}
      />
    </div>
  );
};
