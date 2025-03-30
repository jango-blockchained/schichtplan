import React, { useState } from 'react';
import { Check, ChevronsUpDown, UserCircle2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getEmployees } from '@/services/api';
import { cn } from '@/lib/utils';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Employee } from '@/types';

interface EmployeeSelectProps {
    value: number | null;
    onChange: (value: number) => void;
    placeholder?: string;
    showGroups?: boolean;
    className?: string;
    disabled?: boolean;
}

export const EmployeeSelect = ({
    value,
    onChange,
    placeholder = 'Mitarbeiter auswählen',
    showGroups = true,
    className,
    disabled = false
}: EmployeeSelectProps) => {
    const [open, setOpen] = useState(false);

    // Fetch employees data
    const { data: employees, isLoading } = useQuery({
        queryKey: ['employees'],
        queryFn: getEmployees
    });

    // Get selected employee
    const selectedEmployee = employees?.find(employee => employee.id === value);

    // Group employees by group if showGroups is true
    const groupedEmployees = React.useMemo(() => {
        if (!employees || !showGroups) return null;

        const groups: Record<string, Employee[]> = {};
        employees.forEach(employee => {
            const group = employee.employee_group || 'Ohne Gruppe';
            if (!groups[group]) {
                groups[group] = [];
            }
            groups[group].push(employee);
        });

        return Object.entries(groups).map(([group, employees]) => ({
            name: group,
            employees
        }));
    }, [employees, showGroups]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between", className)}
                    disabled={disabled}
                >
                    {isLoading ? (
                        <Skeleton className="h-4 w-[150px]" />
                    ) : selectedEmployee ? (
                        <div className="flex items-center">
                            <UserCircle2 className="mr-2 h-4 w-4" />
                            {selectedEmployee.first_name} {selectedEmployee.last_name}
                        </div>
                    ) : (
                        placeholder
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
                <Command>
                    <CommandInput placeholder="Mitarbeiter suchen..." />
                    <CommandList>
                        <CommandEmpty>Keine Mitarbeiter gefunden</CommandEmpty>
                        {isLoading ? (
                            <div className="p-2">
                                <Skeleton className="h-8 w-full mb-2" />
                                <Skeleton className="h-8 w-full mb-2" />
                                <Skeleton className="h-8 w-full" />
                            </div>
                        ) : showGroups && groupedEmployees ? (
                            // Group display
                            groupedEmployees.map(group => (
                                <CommandGroup key={group.name} heading={group.name}>
                                    {group.employees.map(employee => (
                                        <CommandItem
                                            key={employee.id}
                                            value={`${employee.first_name} ${employee.last_name}`}
                                            onSelect={() => {
                                                onChange(employee.id);
                                                setOpen(false);
                                            }}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    value === employee.id ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            {employee.first_name} {employee.last_name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            ))
                        ) : (
                            // Flat list
                            <CommandGroup>
                                {employees?.map(employee => (
                                    <CommandItem
                                        key={employee.id}
                                        value={`${employee.first_name} ${employee.last_name}`}
                                        onSelect={() => {
                                            onChange(employee.id);
                                            setOpen(false);
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === employee.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {employee.first_name} {employee.last_name}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}; 