import { PageHeader } from "@/components/PageHeader";
import { ShiftTable } from "@/components/tables";
import { Button } from "@/components/ui/button";
import { getSettings, getShifts } from "@/services/api";
import { Shift } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

export const ShiftsPageExample = () => {
    const { data: shifts = [], isLoading, error } = useQuery({
        queryKey: ["shifts"],
        queryFn: getShifts,
    });

    const { data: settings } = useQuery({
        queryKey: ["settings"],
        queryFn: getSettings,
    });

    const shiftTypes = settings?.employee_groups?.shift_types || [];

    const handleEditShift = (shift: Shift) => {
        console.log("Edit shift:", shift);
        // Open shift edit modal/form
    };

    const handleDeleteShift = (shift: Shift) => {
        if (window.confirm(`Delete shift ${shift.start_time} - ${shift.end_time}?`)) {
            console.log("Delete shift:", shift);
            // Implement delete logic
        }
    };

    const handleDuplicateShift = (shift: Shift) => {
        console.log("Duplicate shift:", shift);
        // Create a copy of the shift
    };

    const handleAddShift = () => {
        console.log("Add new shift");
        // Open add shift modal/form
    };

    if (error) {
        return (
            <div className="rounded-md bg-destructive/15 p-4 text-destructive">
                Error loading shifts: {(error as Error).message}
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6 space-y-8">
            <PageHeader
                title="Shifts"
                description="Manage shift templates for your business"
                actions={
                    <Button onClick={handleAddShift}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Shift
                    </Button>
                }
            />

            <ShiftTable
                shifts={shifts}
                shiftTypes={shiftTypes}
                loading={isLoading}
                error={error ? (error as Error).message : null}
                onEdit={handleEditShift}
                onDelete={handleDeleteShift}
                onDuplicate={handleDuplicateShift}
            />
        </div>
    );
};
