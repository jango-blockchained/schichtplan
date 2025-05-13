import React from 'react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import EmployeeSettingsEditor, { 
    EmployeeType as EditorEmployeeType, 
    AbsenceType as EditorAbsenceType 
} from '@/components/EmployeeSettingsEditor';
import ShiftTypesEditor, { 
    ShiftType as EditorShiftType 
} from '@/components/ShiftTypesEditor';
import type { Settings, EmployeeType, AbsenceType, ShiftType } from '@/types/index'; // Assuming these are the correct root types

interface EmployeeShiftDefinitionsSectionProps {
  settings?: Settings['employee_groups']; // Match the prop name being passed from UnifiedSettingsPage
  onUpdate: (category: keyof Settings, updates: Partial<Settings[keyof Settings]>) => void;
  onImmediateUpdate: () => void;
}

export const EmployeeShiftDefinitionsSection: React.FC<EmployeeShiftDefinitionsSectionProps> = ({
  settings,
  onUpdate,
  onImmediateUpdate,
}) => {
  // Ensure settings is never undefined by providing default empty object
  const employeeGroups = settings || { 
    employee_types: [], 
    absence_types: [], 
    shift_types: [] 
  };

  const handleEmployeeTypesChange = (updatedEmployeeTypes: EditorEmployeeType[]) => {
    // Remove the 'type' field added by the editor if it exists, ensure it matches backend model
    const formattedEmployeeTypes: EmployeeType[] = updatedEmployeeTypes.map(({ type, ...rest }) => rest as EmployeeType);
    onUpdate('employee_groups', { ...employeeGroups, employee_types: formattedEmployeeTypes });
  };

  const handleAbsenceTypesChange = (updatedAbsenceTypes: EditorAbsenceType[]) => {
    const formattedAbsenceTypes: AbsenceType[] = updatedAbsenceTypes.map(({ type, ...rest }) => rest as AbsenceType);
    onUpdate('employee_groups', { ...employeeGroups, absence_types: formattedAbsenceTypes });
  };

  const handleShiftTypesChange = (updatedShiftTypes: EditorShiftType[]) => {
    const formattedShiftTypes: ShiftType[] = updatedShiftTypes.map(({ type, ...rest }) => rest as ShiftType);
    onUpdate('employee_groups', { ...employeeGroups, shift_types: formattedShiftTypes });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Employee Types</CardTitle>
          <CardDescription>Manage employee types and their working hour limits</CardDescription>
        </CardHeader>
        <CardContent>
          <EmployeeSettingsEditor
            type="employee"
            groups={(employeeGroups.employee_types || []).map(et => ({ ...et, type: 'employee' as const }))}
            onChange={(groups) => handleEmployeeTypesChange(groups as EditorEmployeeType[])}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Absence Types</CardTitle>
          <CardDescription>Manage absence types and their color coding</CardDescription>
        </CardHeader>
        <CardContent>
          <EmployeeSettingsEditor
            type="absence"
            groups={(employeeGroups.absence_types || []).map(at => ({ ...at, type: 'absence' as const }))}
            onChange={(groups) => handleAbsenceTypesChange(groups as EditorAbsenceType[])}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shift Types</CardTitle>
          <CardDescription>Manage shift types and their color coding</CardDescription>
        </CardHeader>
        <CardContent>
          <ShiftTypesEditor
            shiftTypes={(employeeGroups.shift_types || []).map(st => ({ ...st, type: 'shift' as const }))}
            onChange={handleShiftTypesChange}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end mt-6">
        <Button onClick={onImmediateUpdate}>
          Save Employee & Shift Definitions
        </Button>
      </div>
    </div>
  );
}; 