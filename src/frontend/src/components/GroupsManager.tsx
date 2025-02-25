import React from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import EmployeeSettingsEditor from './EmployeeSettingsEditor';

interface EmployeeType {
    id: string;
    name: string;
    min_hours: number;
    max_hours: number;
    type: 'employee';
}

interface AbsenceType {
    id: string;
    name: string;
    color: string;
    type: 'absence';
}

interface GroupsManagerProps {
    employeeTypes: Array<Omit<EmployeeType, 'type'>>;
    absenceTypes: Array<Omit<AbsenceType, 'type'>>;
    onEmployeeTypesChange: (groups: Array<Omit<EmployeeType, 'type'>>) => void;
    onAbsenceTypesChange: (groups: Array<Omit<AbsenceType, 'type'>>) => void;
}

export function GroupsManager({
    employeeTypes,
    absenceTypes,
    onEmployeeTypesChange,
    onAbsenceTypesChange,
}: GroupsManagerProps) {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Employee Types</CardTitle>
                    <CardDescription>
                        Manage employee types and their working hour limits
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <EmployeeSettingsEditor
                        type="employee"
                        groups={employeeTypes.map(type => ({
                            ...type,
                            type: 'employee' as const
                        }))}
                        onChange={(groups) => {
                            const employeeTypes = groups
                                .filter((group): group is EmployeeType => group.type === 'employee')
                                .map(({ type, ...rest }) => rest);
                            onEmployeeTypesChange(employeeTypes);
                        }}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Absence Types</CardTitle>
                    <CardDescription>
                        Manage absence types and their color coding
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <EmployeeSettingsEditor
                        type="absence"
                        groups={absenceTypes.map(type => ({
                            ...type,
                            type: 'absence' as const
                        }))}
                        onChange={(groups) => {
                            const absenceTypes = groups
                                .filter((group): group is AbsenceType => group.type === 'absence')
                                .map(({ type, ...rest }) => rest);
                            onAbsenceTypesChange(absenceTypes);
                        }}
                    />
                </CardContent>
            </Card>
        </div>
    );
} 