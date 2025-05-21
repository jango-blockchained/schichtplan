import React, { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import EmployeeSettingsEditor, {
  EmployeeType as EditorEmployeeType,
  AbsenceType as EditorAbsenceType,
} from "@/components/EmployeeSettingsEditor";
import ShiftTypesEditor, {
  ShiftType as EditorShiftType,
} from "@/components/ShiftTypesEditor";
import type {
  Settings,
  EmployeeType,
  AbsenceType,
  ShiftType,
} from "@/types/index"; // Assuming these are the correct root types

interface EmployeeShiftDefinitionsSectionProps {
  settings?: Settings["employee_groups"]; // Match the prop name being passed from UnifiedSettingsPage
  onUpdate: (
    category: keyof Settings,
    updates: Partial<Settings[keyof Settings]>,
  ) => void;
  onImmediateUpdate: () => void;
  isLoading: boolean; // Add isLoading prop
}

export const EmployeeShiftDefinitionsSection: React.FC<
  EmployeeShiftDefinitionsSectionProps
> = ({
  settings,
  onUpdate,
  onImmediateUpdate,
  isLoading, // Accept isLoading prop
}) => {
  // Ensure settings is never undefined by providing default empty object
  const employeeGroups = settings || {
    employee_types: [],
    absence_types: [],
    shift_types: [],
  };

  // Pass the data directly without modifying the 'type' field
  const memoizedEmployeeTypes = useMemo(() => {
    return employeeGroups.employee_types || [];
  }, [employeeGroups.employee_types]);

  const memoizedAbsenceTypes = useMemo(() => {
    return employeeGroups.absence_types || [];
  }, [employeeGroups.absence_types]);

  const memoizedShiftTypes = useMemo(() => {
    return employeeGroups.shift_types || [];
  }, [employeeGroups.shift_types]);

  const handleEmployeeTypesChange = (
    updatedEmployeeTypes: EmployeeType[],
  ) => {
    const patched = updatedEmployeeTypes.map((et) => ({ ...et, type: "employee_type" }));
    onUpdate("employee_groups", {
      ...employeeGroups,
      employee_types: patched,
    });
  };

  const handleAbsenceTypesChange = (
    updatedAbsenceTypes: AbsenceType[],
  ) => {
    const patched = updatedAbsenceTypes.map((at) => ({ ...at, type: "absence_type" }));
    onUpdate("employee_groups", {
      ...employeeGroups,
      absence_types: patched,
    });
  };

  const handleShiftTypesChange = (updatedShiftTypes: ShiftType[]) => {
    const patched = updatedShiftTypes.map((st) => ({ ...st, type: "shift_type" }));
    onUpdate("employee_groups", {
      ...employeeGroups,
      shift_types: patched,
    });
  };

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
          {/* Ensure EmployeeSettingsEditor can handle the correct EmployeeType structure */}
          <EmployeeSettingsEditor
            type="employee" // This prop might still be needed for internal logic/display within the editor
            groups={memoizedEmployeeTypes as unknown as EditorEmployeeType[]} // Cast if needed, but ideally editor should accept EmployeeType[]
            onChange={handleEmployeeTypesChange}
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
          {/* Ensure EmployeeSettingsEditor can handle the correct AbsenceType structure */}
          <EmployeeSettingsEditor
            type="absence" // This prop might still be needed for internal logic/display within the editor
            groups={memoizedAbsenceTypes as unknown as EditorAbsenceType[]} // Cast if needed, but ideally editor should accept AbsenceType[]
            onChange={handleAbsenceTypesChange}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shift Types</CardTitle>
          <CardDescription>
            Manage shift types and their color coding
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Ensure ShiftTypesEditor can handle the correct ShiftType structure */}
          <ShiftTypesEditor
            shiftTypes={memoizedShiftTypes as unknown as EditorShiftType[]} // Cast if needed, but ideally editor should accept ShiftType[]
            onChange={handleShiftTypesChange}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end mt-6">
        {/* Auto-save: Save button removed */}
      </div>
    </div>
  );
};
