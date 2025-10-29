import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { AbsenceType, Employee } from "@/types";
import { addDays, format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const SLOT_COUNT = 6;

type Slot = {
    startDate: string;
    endDate: string;
    type: string;
};

type EmployeeEntry = {
    employeeId: number;
    slots: Slot[];
};

interface BulkVacationInputModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    employees: Employee[];
    absenceTypes: AbsenceType[];
    onSubmit: (entries: Array<{
        employee_id: number;
        absence_type_id: string;
        start_date: string;
        end_date: string;
        status: string;
    }>) => void;
    isLoading?: boolean;
}

interface DateInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    defaultValue?: string;
}

function DateInput({ value, onChange, placeholder, defaultValue }: DateInputProps) {
    const [open, setOpen] = useState(false);
    const selected = value ? new Date(value) : defaultValue ? new Date(defaultValue) : undefined;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <div className="flex gap-1">
                <Input
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                    className="h-9"
                />
                <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9">
                        <CalendarIcon className="h-4 w-4" />
                    </Button>
                </PopoverTrigger>
            </div>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={selected}
                    onSelect={(date) => {
                        if (date) {
                            onChange(format(date, "yyyy-MM-dd"));
                            setOpen(false);
                        }
                    }}
                />
            </PopoverContent>
        </Popover>
    );
}

function createEmptySlot(): Slot {
    return { startDate: "", endDate: "", type: "" };
}

function getInitialEntries(employees: Employee[]): EmployeeEntry[] {
    return employees.map((employee) => ({
        employeeId: employee.id,
        slots: Array.from({ length: SLOT_COUNT }, createEmptySlot),
    }));
}

export function BulkVacationInputModal({
    open,
    onOpenChange,
    employees,
    absenceTypes,
    onSubmit,
    isLoading = false,
}: BulkVacationInputModalProps) {
    const [entries, setEntries] = useState<EmployeeEntry[]>([]);
    const [presetType, setPresetType] = useState<string>("");
    const [presetDays, setPresetDays] = useState<number>(1);
    const [presetStart, setPresetStart] = useState<string>("");
    const [presetStatus, setPresetStatus] = useState<string>("requested");

    const typeOptions = useMemo(() => absenceTypes.map((type) => ({ value: type.id, label: type.name })), [absenceTypes]);
    const statusOptions = useMemo(
        () => [
            { value: "requested", label: "Requested" },
            { value: "approved", label: "Approved" },
            { value: "declined", label: "Declined" },
        ],
        [],
    );

    useEffect(() => {
        if (!open) {
            return;
        }

        setEntries((current) => {
            if (current.length) {
                return current;
            }
            return getInitialEntries(employees);
        });
    }, [open, employees]);

    useEffect(() => {
        if (!open) {
            setEntries([]);
            setPresetType("");
            setPresetDays(1);
            setPresetStart("");
            setPresetStatus("requested");
        }
    }, [open]);

    const updateSlot = useCallback(
        (employeeId: number, slotIndex: number, field: keyof Slot, value: string) => {
            setEntries((current) =>
                current.map((entry) => {
                    if (entry.employeeId !== employeeId) {
                        return entry;
                    }

                    const nextSlots = entry.slots.map((slot, index) => {
                        if (index !== slotIndex) {
                            return slot;
                        }

                        return { ...slot, [field]: value };
                    });

                    return { ...entry, slots: nextSlots };
                }),
            );
        },
        [],
    );

    const applyPreset = useCallback(() => {
        if (!presetStart || !presetType) {
            return;
        }

        const startDate = presetStart;
        const endDate = format(addDays(new Date(presetStart), Math.max(presetDays - 1, 0)), "yyyy-MM-dd");

        setEntries((current) =>
            current.map((entry) => {
                const slotIndex = entry.slots.findIndex((slot) => !slot.startDate && !slot.endDate && !slot.type);
                if (slotIndex === -1) {
                    return entry;
                }

                const nextSlots = entry.slots.map((slot, index) =>
                    index === slotIndex ? { startDate, endDate, type: presetType } : slot,
                );

                return { ...entry, slots: nextSlots };
            }),
        );
    }, [presetDays, presetStart, presetType]);

    const handleSubmit = useCallback(() => {
        const payload = entries.flatMap((entry) =>
            entry.slots
                .filter((slot) => slot.startDate && slot.endDate && slot.type)
                .map((slot) => ({
                    employee_id: entry.employeeId,
                    absence_type_id: slot.type,
                    start_date: slot.startDate,
                    end_date: slot.endDate,
                    status: presetStatus,
                })),
        );

        if (!payload.length) {
            return;
        }

        onSubmit(payload);
    }, [entries, onSubmit, presetStatus]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Bulk Vacation Input</DialogTitle>
                </DialogHeader>

                <Card className="bg-muted/40">
                    <CardContent className="pt-4">
                        <div className="grid gap-4 md:grid-cols-4">
                            <div>
                                <Label className="text-sm">Type</Label>
                                <Select value={presetType} onValueChange={setPresetType}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {typeOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-sm">Days</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={presetDays}
                                    onChange={(event) => {
                                        const value = Number(event.target.value);
                                        setPresetDays(Number.isFinite(value) && value > 0 ? value : 1);
                                    }}
                                />
                            </div>

                            <div>
                                <Label className="text-sm">Start date</Label>
                                <DateInput
                                    value={presetStart}
                                    onChange={setPresetStart}
                                    placeholder="YYYY-MM-DD"
                                />
                            </div>

                            <div>
                                <Label className="text-sm">Status</Label>
                                <Select value={presetStatus} onValueChange={setPresetStatus}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {statusOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-end">
                                <Button className="w-full" onClick={applyPreset} variant="outline">
                                    Apply to next free slot
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <ScrollArea className="mt-4 h-full max-h-[calc(90vh-320px)] rounded-md border">
                    <div className="flex flex-col gap-6 p-4">
                        {entries.map((entry) => {
                            const employee = employees.find((emp) => emp.id === entry.employeeId);
                            const displayName = employee ? `${employee.first_name} ${employee.last_name}` : `#${entry.employeeId}`;

                            return (
                                <div key={entry.employeeId} className="space-y-3">
                                    <Label className="text-sm font-semibold">{displayName}</Label>

                                    <div className="grid gap-3">
                                        {entry.slots.map((slot, index) => {
                                            const suggestedEnd = slot.startDate
                                                ? format(addDays(new Date(slot.startDate), Math.max(presetDays - 1, 0)), "yyyy-MM-dd")
                                                : "";

                                            return (
                                                <div key={index} className="grid gap-3 rounded-md border p-3 md:grid-cols-5">
                                                    <div className="md:col-span-2">
                                                        <Label className="text-xs uppercase tracking-wide">From</Label>
                                                        <DateInput
                                                            value={slot.startDate}
                                                            onChange={(value) => updateSlot(entry.employeeId, index, "startDate", value)}
                                                            placeholder="YYYY-MM-DD"
                                                            defaultValue={slot.startDate || presetStart}
                                                        />
                                                    </div>

                                                    <div className="md:col-span-2">
                                                        <Label className="text-xs uppercase tracking-wide">To</Label>
                                                        <DateInput
                                                            value={slot.endDate}
                                                            onChange={(value) => updateSlot(entry.employeeId, index, "endDate", value)}
                                                            placeholder="YYYY-MM-DD"
                                                            defaultValue={slot.endDate || suggestedEnd}
                                                        />
                                                    </div>

                                                    <div>
                                                        <Label className="text-xs uppercase tracking-wide">Type</Label>
                                                        <Select
                                                            value={slot.type}
                                                            onValueChange={(value) => updateSlot(entry.employeeId, index, "type", value)}
                                                        >
                                                            <SelectTrigger className="h-9">
                                                                <SelectValue placeholder="Select" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {typeOptions.map((option) => (
                                                                    <SelectItem key={option.value} value={option.value}>
                                                                        {option.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div className="md:col-span-5 flex justify-end">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                updateSlot(entry.employeeId, index, "startDate", "");
                                                                updateSlot(entry.employeeId, index, "endDate", "");
                                                                updateSlot(entry.employeeId, index, "type", "");
                                                            }}
                                                        >
                                                            Clear slot
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>

                <DialogFooter className="mt-6">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isLoading}>
                        {isLoading ? "Saving…" : "Submit"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
