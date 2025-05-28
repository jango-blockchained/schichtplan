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
  settings: Settings["employee_groups"] | null; // Prop can be null
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
  const employee_types_data = settings?.employee_types || [];
  const absence_types_data = settings?.absence_types || [];
  const shift_types_data = settings?.shift_types || [];

  const memoizedEmployeeTypes = useMemo(() => {
    return employee_types_data;
  }, [employee_types_data]);

  const memoizedAbsenceTypes = useMemo(() => {
    return absence_types_data;
  }, [absence_types_data]);

  const memoizedShiftTypes = useMemo(() => {
    return shift_types_data;
  }, [shift_types_data]);

  const handleEmployeeTypesChange = (
    updatedEmployeeTypes: EditorEmployeeType[], // Assuming editor provides its own type
  ) => {
    const patched = updatedEmployeeTypes.map((et) => ({ ...et, type: "employee_type" as const }));
    onUpdate("employee_groups", {
      employee_types: patched as unknown as EmployeeType[], // Cast back to main type
      absence_types: absence_types_data,
      shift_types: shift_types_data,
    });
  };

  const handleAbsenceTypesChange = (
    updatedAbsenceTypes: EditorAbsenceType[], // Assuming editor provides its own type
  ) => {
    const patched = updatedAbsenceTypes.map((at) => ({ ...at, type: "absence_type" as const }));
    onUpdate("employee_groups", {
      employee_types: employee_types_data,
      absence_types: patched as unknown as AbsenceType[], // Cast back to main type
      shift_types: shift_types_data,
    });
  };

  const handleShiftTypesChange = (updatedShiftTypes: EditorShiftType[]) => { // Assuming editor provides its own type
    const patched = updatedShiftTypes.map((st) => ({ ...st, type: "shift_type" as const }));
    onUpdate("employee_groups", {
      employee_types: employee_types_data,
      absence_types: absence_types_data,
      shift_types: patched as unknown as ShiftType[], // Cast back to main type
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
