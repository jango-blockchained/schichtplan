import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

interface Employee {
    id: string;
    firstName: string;
    lastName: string;
}

interface Shift {
    type: string;
    start: string;
    end: string;
}

export function ScheduleVersionForm() {
    const [employees] = useState<Employee[]>([]);  // From API

    // Initialize empty shifts
    const emptyShifts = employees.map(emp => ({
        employeeId: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        shifts: Array(7).fill({ type: '', start: '', end: '' } as Shift)
    }));

    return (
        <div className="space-y-4">
            <Input
                placeholder="Version name"
                className="max-w-xs"
            />

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Employee</TableHead>
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                            <TableHead key={day}>{day}</TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {emptyShifts.map((shift, index) => (
                        <TableRow key={index}>
                            <TableCell>{shift.name}</TableCell>
                            {shift.shifts.map((s, dayIndex) => (
                                <TableCell key={dayIndex}>
                                    <Input
                                        placeholder="Add shift"
                                        className="w-24"
                                    />
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
} 