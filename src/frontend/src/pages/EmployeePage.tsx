import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getEmployees, updateEmployee, deleteEmployee, createEmployee } from '@/services/api';
import { Employee, CreateEmployeeRequest, UpdateEmployeeRequest } from '@/types';
import { useToast } from '@/components/ui/use-toast';
import { PageHeader } from '@/components/PageHeader';
import { EmployeeModal } from '@/components/EmployeeModal';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface AlertState {
    type: 'delete' | 'deactivate' | null;
    employee: Employee | null;
}

export function EmployeePage() {
    const [currentPage, setCurrentPage] = useState(1);
    const [showInactive, setShowInactive] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [alertState, setAlertState] = useState<AlertState>({ type: null, employee: null });
    const [isLoading, setIsLoading] = useState(false);

    const { data: employees, isLoading: queryLoading, refetch } = useQuery({
        queryKey: ['employees'],
        queryFn: getEmployees,
    });

    const { toast } = useToast();

    const handleDelete = async (employee: Employee) => {
        try {
            setIsLoading(true);
            await deleteEmployee(employee.id);
            await refetch();
            setAlertState({ type: null, employee: null });
            toast({
                title: 'Success',
                description: 'Employee deleted successfully',
                variant: 'default',
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to delete employee',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleActive = async (employee: Employee) => {
        try {
            setIsLoading(true);
            await updateEmployee(employee.id, {
                ...employee,
                is_active: !employee.is_active,
            });
            await refetch();
            setAlertState({ type: null, employee: null });
            toast({
                title: 'Success',
                description: `Employee ${employee.is_active ? 'deactivated' : 'activated'} successfully`,
                variant: 'default',
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to update employee',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddEmployee = async (data: CreateEmployeeRequest) => {
        try {
            setIsLoading(true);
            await createEmployee(data);
            await refetch();
            setShowAddModal(false);
            toast({
                title: 'Success',
                description: 'Employee added successfully',
                variant: 'default',
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to add employee',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateEmployee = async (id: number, data: UpdateEmployeeRequest) => {
        try {
            setIsLoading(true);
            await updateEmployee(id, data);
            await refetch();
            toast({
                title: 'Success',
                description: 'Employee updated successfully',
                variant: 'default',
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to update employee',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const filteredEmployees = employees?.filter((employee) => {
        if (showInactive) {
            return true;
        }
        return employee.is_active;
    });

    const itemsPerPage = 10;
    const totalPages = Math.ceil((filteredEmployees?.length || 0) / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentEmployees = filteredEmployees?.slice(startIndex, endIndex);

    if (queryLoading) {
        return <div>Loading...</div>;
    }

    return (
        <div className="container mx-auto py-10">
            <PageHeader
                title="Employees"
                description="Manage your employees"
                actions={
                    <div className="flex items-center gap-4">
                        <Button
                            variant="outline"
                            onClick={() => setShowInactive(!showInactive)}
                        >
                            {showInactive ? (
                                <ToggleRight className="h-4 w-4 mr-2" />
                            ) : (
                                <ToggleLeft className="h-4 w-4 mr-2" />
                            )}
                            {showInactive ? 'Hide Inactive' : 'Show Inactive'}
                        </Button>
                        <Button onClick={() => setShowAddModal(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Employee
                        </Button>
                    </div>
                }
            />

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Group</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {currentEmployees?.map((employee) => (
                        <TableRow key={employee.id}>
                            <TableCell>{employee.first_name} {employee.last_name}</TableCell>
                            <TableCell>{employee.employee_group}</TableCell>
                            <TableCell>{employee.contracted_hours}h</TableCell>
                            <TableCell>
                                <span className={`px-2 py-1 rounded-full text-xs ${employee.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {employee.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setAlertState({ type: 'deactivate', employee })}
                                    >
                                        {employee.is_active ? (
                                            <ToggleRight className="h-4 w-4" />
                                        ) : (
                                            <ToggleLeft className="h-4 w-4" />
                                        )}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setAlertState({ type: 'delete', employee })}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-4">
                    <Button
                        variant="outline"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                    >
                        First
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                    >
                        Previous
                    </Button>
                    <span className="text-sm">
                        Page {currentPage} of {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                    >
                        Next
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                    >
                        Last
                    </Button>
                </div>
            )}

            {/* Confirm Dialogs */}
            <ConfirmDialog
                isOpen={alertState.type === 'delete'}
                onClose={() => setAlertState({ type: null, employee: null })}
                onConfirm={() => alertState.employee && handleDelete(alertState.employee)}
                title="Mitarbeiter löschen"
                description="Möchten Sie den Mitarbeiter wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
                confirmText="Löschen"
                cancelText="Abbrechen"
            />

            <ConfirmDialog
                isOpen={alertState.type === 'deactivate'}
                onClose={() => setAlertState({ type: null, employee: null })}
                onConfirm={() => alertState.employee && handleToggleActive(alertState.employee)}
                title={`Mitarbeiter ${alertState.employee?.is_active ? 'deaktivieren' : 'aktivieren'}`}
                description={`Möchten Sie den Mitarbeiter wirklich ${alertState.employee?.is_active ? 'deaktivieren' : 'aktivieren'}?`}
                confirmText={alertState.employee?.is_active ? 'Deaktivieren' : 'Aktivieren'}
                cancelText="Abbrechen"
            />

            {/* Add/Edit Employee Modal */}
            <EmployeeModal
                open={showAddModal}
                onOpenChange={setShowAddModal}
                isLoading={isLoading}
                onAddEmployee={handleAddEmployee}
                onUpdateEmployee={handleUpdateEmployee}
            />
        </div>
    );
} 