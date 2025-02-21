import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEmployees, updateEmployee, deleteEmployee } from '@/services/api';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Pencil,
    Trash2,
    Ban,
    CheckCircle,
} from 'lucide-react';
import { Employee } from '@/types';

const ITEMS_PER_PAGE = 20;

type FilterType = 'active' | 'inactive' | 'all';

interface AlertState {
    type: 'delete' | 'deactivate' | null;
    employee: Employee | null;
}

export const EmployeePage: React.FC = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [filter, setFilter] = useState<FilterType>('active');
    const [alertState, setAlertState] = useState<AlertState>({ type: null, employee: null });
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: employees, isLoading } = useQuery({
        queryKey: ['employees'],
        queryFn: getEmployees,
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, ...data }: Partial<Employee> & { id: number }) =>
            updateEmployee(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] });
            toast({
                description: 'Mitarbeiter erfolgreich aktualisiert',
            });
        },
        onError: (error) => {
            toast({
                variant: 'destructive',
                title: 'Fehler',
                description: error instanceof Error ? error.message : 'Fehler beim Aktualisieren des Mitarbeiters',
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteEmployee,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] });
            toast({
                description: 'Mitarbeiter erfolgreich gelöscht',
            });
        },
        onError: (error) => {
            toast({
                variant: 'destructive',
                title: 'Fehler',
                description: error instanceof Error ? error.message : 'Fehler beim Löschen des Mitarbeiters',
            });
        },
    });

    const handleToggleActive = async (employee: Employee) => {
        await updateMutation.mutateAsync({
            id: employee.id,
            is_active: !employee.is_active,
        });
        setAlertState({ type: null, employee: null });
    };

    const handleDelete = async (employee: Employee) => {
        await deleteMutation.mutateAsync(employee.id);
        setAlertState({ type: null, employee: null });
    };

    const filteredEmployees = employees?.filter((employee) => {
        if (filter === 'active') return employee.is_active;
        if (filter === 'inactive') return !employee.is_active;
        return true;
    }) || [];

    const totalPages = Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedEmployees = filteredEmployees.slice(
        startIndex,
        startIndex + ITEMS_PER_PAGE
    );

    if (isLoading) {
        return <div>Loading...</div>;
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Mitarbeiter</h1>
                <div className="flex items-center gap-4">
                    <Select
                        value={filter}
                        onValueChange={(value: FilterType) => {
                            setFilter(value);
                            setCurrentPage(1);
                        }}
                    >
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Filter auswählen" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Aktive Mitarbeiter</SelectItem>
                            <SelectItem value="inactive">Inaktive Mitarbeiter</SelectItem>
                            <SelectItem value="all">Alle Mitarbeiter</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Personalnummer</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Position</TableHead>
                            <TableHead>Stunden</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Aktionen</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedEmployees.map((employee) => (
                            <TableRow key={employee.id}>
                                <TableCell>{employee.employee_id}</TableCell>
                                <TableCell>
                                    {employee.first_name} {employee.last_name}
                                </TableCell>
                                <TableCell>{employee.employee_group}</TableCell>
                                <TableCell>{employee.contracted_hours}h</TableCell>
                                <TableCell>
                                    <Badge
                                        variant={employee.is_active ? 'default' : 'secondary'}
                                    >
                                        {employee.is_active ? 'Aktiv' : 'Inaktiv'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() =>
                                                setAlertState({
                                                    type: 'deactivate',
                                                    employee,
                                                })
                                            }
                                        >
                                            {employee.is_active ? (
                                                <Ban className="h-4 w-4" />
                                            ) : (
                                                <CheckCircle className="h-4 w-4" />
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() =>
                                                setAlertState({
                                                    type: 'delete',
                                                    employee,
                                                })
                                            }
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                    >
                        <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                        Seite {currentPage} von {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                    >
                        <ChevronsRight className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {/* Delete Alert Dialog */}
            <AlertDialog
                open={alertState.type === 'delete'}
                onOpenChange={() =>
                    setAlertState({ type: null, employee: null })
                }
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Mitarbeiter löschen
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Möchten Sie den Mitarbeiter{' '}
                            {alertState.employee?.first_name}{' '}
                            {alertState.employee?.last_name} wirklich löschen?
                            Diese Aktion kann nicht rückgängig gemacht werden.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => alertState.employee && handleDelete(alertState.employee)}
                        >
                            Löschen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Deactivate Alert Dialog */}
            <AlertDialog
                open={alertState.type === 'deactivate'}
                onOpenChange={() =>
                    setAlertState({ type: null, employee: null })
                }
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {alertState.employee?.is_active
                                ? 'Mitarbeiter deaktivieren'
                                : 'Mitarbeiter aktivieren'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Möchten Sie den Mitarbeiter{' '}
                            {alertState.employee?.first_name}{' '}
                            {alertState.employee?.last_name} wirklich{' '}
                            {alertState.employee?.is_active
                                ? 'deaktivieren'
                                : 'aktivieren'}?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() =>
                                alertState.employee && handleToggleActive(alertState.employee)
                            }
                        >
                            {alertState.employee?.is_active
                                ? 'Deaktivieren'
                                : 'Aktivieren'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}; 