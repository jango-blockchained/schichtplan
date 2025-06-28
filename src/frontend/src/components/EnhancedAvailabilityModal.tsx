import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Availability, createAvailability, createSchedule, getEmployees, getSchedules, getShifts, Shift, updateSchedule } from "@/services/api";
import { Employee } from "@/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { eachDayOfInterval, format, isSameDay } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarDays, Clock, Users } from "lucide-react";
import React, { useEffect, useState } from "react";

interface EnhancedAvailabilityModalProps {
    isOpen: boolean;
    onClose: () => void;
    dateRange: { from: Date; to: Date } | undefined;
    availabilityType: "FIXED" | "PREFERRED" | "UNAVAILABLE";
    currentVersion?: number; // Add current version prop
}

interface SelectedEmployees {
    all: boolean;
    individual: number[];
}

interface SelectedDates {
    all: boolean;
    individual: Date[];
}

interface FixedAvailabilityOptions {
    useExistingPattern: boolean;
    matchOnlyStart: boolean;
    matchOnlyEnd: boolean;
    adjustTimes: boolean;
    overwriteExisting: boolean; // Add option to overwrite existing assignments
    cleanupFirst: boolean; // Add option to clean up existing assignments first
}

interface AvailabilityOptions {
    createCompleteEntries: boolean; // Create explicit entries for all dates in range
}

export function EnhancedAvailabilityModal({
    isOpen,
    onClose,
    dateRange,
    availabilityType,
    currentVersion,
}: EnhancedAvailabilityModalProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [selectedEmployees, setSelectedEmployees] = useState<SelectedEmployees>({
        all: true,
        individual: [],
    });

    const [selectedDates, setSelectedDates] = useState<SelectedDates>({
        all: true,
        individual: [],
    });

    const [fixedOptions, setFixedOptions] = useState<FixedAvailabilityOptions>({
        useExistingPattern: true,
        matchOnlyStart: false,
        matchOnlyEnd: false,
        adjustTimes: true,
        overwriteExisting: false,
        cleanupFirst: false,
    });

    const [availabilityOptions, setAvailabilityOptions] = useState<AvailabilityOptions>({
        createCompleteEntries: true, // Default to creating complete entries
    });

    const [isProcessing, setIsProcessing] = useState(false);

    // Fetch employees and shifts
    const { data: employees } = useQuery({
        queryKey: ["employees"],
        queryFn: getEmployees,
    });

    const { data: shifts } = useQuery({
        queryKey: ["shifts"],
        queryFn: getShifts,
    });

    // Generate date list from range
    const dateList = React.useMemo(() => {
        if (!dateRange?.from || !dateRange?.to) return [];
        return eachDayOfInterval({
            start: dateRange.from,
            end: dateRange.to,
        });
    }, [dateRange]);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedEmployees({ all: true, individual: [] });
            setSelectedDates({ all: true, individual: [] });
            setFixedOptions({
                useExistingPattern: true,
                matchOnlyStart: false,
                matchOnlyEnd: false,
                adjustTimes: true,
                overwriteExisting: false,
                cleanupFirst: false,
            });
            setAvailabilityOptions({
                createCompleteEntries: true,
            });
        }
    }, [isOpen]);

    const handleEmployeeSelectionChange = (type: 'all' | 'individual', value?: number) => {
        if (type === 'all') {
            setSelectedEmployees(prev => ({
                all: !prev.all,
                individual: !prev.all ? [] : prev.individual
            }));
        } else if (value !== undefined) {
            setSelectedEmployees(prev => ({
                all: false,
                individual: prev.individual.includes(value)
                    ? prev.individual.filter(id => id !== value)
                    : [...prev.individual, value]
            }));
        }
    };

    const handleDateSelectionChange = (type: 'all' | 'individual', value?: Date) => {
        if (type === 'all') {
            setSelectedDates(prev => ({
                all: !prev.all,
                individual: !prev.all ? [] : prev.individual
            }));
        } else if (value !== undefined) {
            setSelectedDates(prev => ({
                all: false,
                individual: prev.individual.some(date => isSameDay(date, value))
                    ? prev.individual.filter(date => !isSameDay(date, value))
                    : [...prev.individual, value]
            }));
        }
    };

    const getTargetEmployees = (): Employee[] => {
        if (!employees) return [];

        if (selectedEmployees.all) {
            return employees;
        }

        return employees.filter(emp => selectedEmployees.individual.includes(emp.id));
    };

    const getTargetDates = (): Date[] => {
        if (selectedDates.all) {
            return dateList;
        }

        return selectedDates.individual;
    };

    const findMatchingShift = (employee: Employee, date: Date): Shift | null => {
        if (!shifts || availabilityType !== 'FIXED') return null;

        // Suppress unused parameter warnings for now since this is a stub
        void employee;
        void date;

        // Simple implementation: For now, find the first shift that matches basic criteria
        // In a full implementation, this would:
        // 1. Query employee's existing FIXED availability entries for this weekday
        // 2. Find shifts that match start/end times based on fixedOptions
        // 3. Return the best matching shift template

        // For now, prefer shifts that look like standard shifts
        const standardShifts = shifts.filter(shift =>
            shift.start_time && shift.end_time &&
            shift.start_time !== shift.end_time
        );

        if (standardShifts.length > 0) {
            // Simple heuristic: prefer shifts in the middle of the day for now
            const sortedShifts = standardShifts.sort((a, b) => {
                const aStartHour = parseInt(a.start_time.split(':')[0]);
                const bStartHour = parseInt(b.start_time.split(':')[0]);
                // Prefer shifts starting between 8-14 (morning to midday)
                const aScore = Math.abs(aStartHour - 11); // Distance from 11 AM
                const bScore = Math.abs(bStartHour - 11);
                return aScore - bScore;
            });
            return sortedShifts[0];
        }

        // Fallback: return first available shift
        return shifts[0] || null;
    };

    const calculateShiftTimes = (originalShift: Shift, targetDate: Date): { start_time: string; end_time: string } => {
        // Suppress unused parameter warning for now since this is a stub
        void targetDate;

        if (!fixedOptions.adjustTimes) {
            return {
                start_time: originalShift.start_time,
                end_time: originalShift.end_time,
            };
        }

        // TODO: Implement time adjustment logic based on:
        // - Store opening/closing hours for the specific date
        // - Employee's preferences
        // - Other constraints

        return {
            start_time: originalShift.start_time,
            end_time: originalShift.end_time,
        };
    };

    const handleSubmit = async () => {
        const targetEmployees = getTargetEmployees();
        const targetDates = getTargetDates();

        if (targetEmployees.length === 0) {
            toast({
                title: "Fehler",
                description: "Bitte wählen Sie mindestens einen Mitarbeiter aus.",
                variant: "destructive",
            });
            return;
        }

        if (targetDates.length === 0) {
            toast({
                title: "Fehler",
                description: "Bitte wählen Sie mindestens ein Datum aus.",
                variant: "destructive",
            });
            return;
        }

        // Validate that all dates are valid Date objects
        const invalidDates = targetDates.filter(date => !(date instanceof Date) || isNaN(date.getTime()));
        if (invalidDates.length > 0) {
            toast({
                title: "Fehler",
                description: "Ungültige Datumswerte ausgewählt.",
                variant: "destructive",
            });
            return;
        }

        if (availabilityType === 'FIXED' && !currentVersion) {
            toast({
                title: "Fehler",
                description: "Keine Version ausgewählt. Bitte wählen Sie eine Version für die Schichtzuweisungen.",
                variant: "destructive",
            });
            return;
        }

        setIsProcessing(true);

        try {
            if (availabilityType === 'FIXED') {
                // Step 1: Handle cleanup/overwrite if requested
                if (fixedOptions.cleanupFirst || fixedOptions.overwriteExisting) {
                    // Sort target dates and get date range
                    const sortedDates = [...targetDates].sort((a, b) => a.getTime() - b.getTime());

                    if (sortedDates.length === 0) {
                        throw new Error("No valid dates selected");
                    }

                    const startDateStr = format(sortedDates[0], "yyyy-MM-dd");
                    const endDateStr = format(sortedDates[sortedDates.length - 1], "yyyy-MM-dd");

                    // Validate date strings
                    if (!startDateStr || !endDateStr) {
                        throw new Error("Invalid date format");
                    }

                    try {
                        const existingSchedules = await getSchedules(
                            startDateStr,
                            endDateStr,
                            currentVersion!,
                            true // include empty schedules
                        );

                        // Filter to only the target employees and dates
                        const targetEmployeeIds = targetEmployees.map(emp => emp.id);
                        const targetDateStrings = targetDates.map(date => format(date, "yyyy-MM-dd"));

                        const schedulesToClear = existingSchedules.schedules.filter(schedule =>
                            targetEmployeeIds.includes(schedule.employee_id) &&
                            targetDateStrings.includes(schedule.date) &&
                            schedule.shift_id !== null // Only clear schedules that have assignments
                        );

                        // Clear existing assignments (set shift_id to null)
                        let clearedCount = 0;
                        for (const schedule of schedulesToClear) {
                            try {
                                await updateSchedule(schedule.id, {
                                    shift_id: null,
                                    version: currentVersion!,
                                });
                                clearedCount++;
                            } catch (error) {
                                console.error("Error clearing schedule assignment:", error);
                                // Continue with other schedules even if one fails
                            }
                        }

                        if (clearedCount > 0) {
                            toast({
                                title: "Bestehende Zuweisungen entfernt",
                                description: `${clearedCount} bestehende Schichtzuweisungen wurden entfernt.`,
                                variant: "default",
                            });
                        }
                    } catch (error) {
                        console.error("Error during cleanup phase:", error);
                        console.error("Date range:", startDateStr, "to", endDateStr);
                        console.error("Current version:", currentVersion);

                        toast({
                            title: "Warnung",
                            description: "Fehler beim Aufräumen bestehender Zuweisungen. Fortfahren mit neuen Zuweisungen.",
                            variant: "destructive",
                        });
                    }
                }

                // Step 2: Create new schedule assignments
                const scheduleEntries = [];

                for (const employee of targetEmployees) {
                    for (const date of targetDates) {
                        // Find a matching shift template for this employee/date
                        const matchingShift = findMatchingShift(employee, date);

                        if (matchingShift) {
                            const adjustedTimes = calculateShiftTimes(matchingShift, date);

                            const scheduleData = {
                                employee_id: employee.id,
                                date: format(date, "yyyy-MM-dd"),
                                shift_id: matchingShift.id,
                                version: currentVersion!,
                                // Include adjusted times if needed
                                ...(adjustedTimes.start_time !== matchingShift.start_time || adjustedTimes.end_time !== matchingShift.end_time ? {
                                    // Store custom times in notes for now, since backend might not support custom times directly
                                    notes: `Angepasste Zeiten: ${adjustedTimes.start_time} - ${adjustedTimes.end_time}`
                                } : {})
                            };

                            scheduleEntries.push(scheduleData);
                        }
                    }
                }

                // Create schedule entries
                let createdCount = 0;
                for (const entry of scheduleEntries) {
                    try {
                        await createSchedule(entry);
                        createdCount++;
                    } catch (error) {
                        console.error("Error creating schedule entry:", error);
                        // Continue with other entries even if one fails
                    }
                }

                // Invalidate schedules query to refresh the view
                queryClient.invalidateQueries({ queryKey: ["schedules"] });

                toast({
                    title: "Schichtzuweisungen erstellt",
                    description: `${createdCount} von ${scheduleEntries.length} Schichtzuweisungen wurden erfolgreich erstellt.`,
                    variant: "default",
                });

            } else {
                // For PREFERRED and UNAVAILABLE, create availability entries
                const availabilityEntries = [];

                for (const employee of targetEmployees) {
                    for (const date of targetDates) {
                        const availabilityData: Omit<Availability, "id"> = {
                            employee_id: employee.id,
                            start_date: format(date, "yyyy-MM-dd"),
                            end_date: format(date, "yyyy-MM-dd"),
                            availability_type: availabilityType as "AVAILABLE" | "FIXED" | "PREFERRED" | "UNAVAILABLE",
                            is_recurring: false,
                        };

                        availabilityEntries.push(availabilityData);
                    }
                }

                // Create availability entries
                for (const entry of availabilityEntries) {
                    await createAvailability(entry);
                }

                toast({
                    title: "Verfügbarkeit erstellt",
                    description: `${availabilityEntries.length} Verfügbarkeitseinträge wurden erfolgreich erstellt.`,
                    variant: "default",
                });
            }

            onClose();

        } catch (error) {
            console.error("Error in handleSubmit:", error);

            // Provide more specific error messages
            let errorMessage = "Ein unerwarteter Fehler ist aufgetreten.";
            if (error instanceof Error) {
                if (error.message.includes("Failed to create schedule")) {
                    errorMessage = "Fehler beim Erstellen der Schichtzuweisungen. Möglicherweise existieren bereits Zuweisungen für diese Termine.";
                } else if (error.message.includes("Failed to update schedule")) {
                    errorMessage = "Fehler beim Aktualisieren bestehender Schichtzuweisungen.";
                } else if (error.message.includes("Failed to fetch schedules")) {
                    errorMessage = "Fehler beim Abrufen bestehender Schichtpläne für das Aufräumen.";
                } else {
                    errorMessage = error.message;
                }
            }

            toast({
                title: "Fehler beim Erstellen",
                description: availabilityType === 'FIXED'
                    ? errorMessage
                    : "Die Verfügbarkeit konnte nicht erstellt werden.",
                variant: "destructive",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const getModalTitle = () => {
        switch (availabilityType) {
            case 'FIXED':
                return 'Feste Schichtzuweisungen erstellen';
            case 'PREFERRED':
                return 'Bevorzugte Verfügbarkeit hinzufügen';
            case 'UNAVAILABLE':
                return 'Nicht verfügbar markieren';
            default:
                return 'Verfügbarkeit hinzufügen';
        }
    };

    const getModalDescription = () => {
        switch (availabilityType) {
            case 'FIXED':
                return 'Erstellen Sie feste Schichtzuweisungen basierend auf vorhandenen Verfügbarkeitsmustern. Dies erstellt direkte Schichtpläne für die ausgewählten Mitarbeiter und Termine.';
            case 'PREFERRED':
                return 'Markieren Sie bevorzugte Arbeitszeiten für Mitarbeiter. Diese werden bei der Planung berücksichtigt, sind aber nicht zwingend.';
            case 'UNAVAILABLE':
                return 'Markieren Sie Zeiten, in denen Mitarbeiter nicht verfügbar sind (z.B. Termine, Urlaub, etc.).';
            default:
                return 'Verwalten Sie die Verfügbarkeit von Mitarbeitern.';
        }
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {availabilityType === 'FIXED' && <Clock className="h-5 w-5" />}
                        {availabilityType === 'PREFERRED' && <CalendarDays className="h-5 w-5" />}
                        {availabilityType === 'UNAVAILABLE' && <Users className="h-5 w-5" />}
                        {getModalTitle()}
                    </DialogTitle>
                    <DialogDescription>
                        {getModalDescription()}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Employee Selection */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Mitarbeiter auswählen
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="all-employees"
                                    checked={selectedEmployees.all}
                                    onCheckedChange={() => handleEmployeeSelectionChange('all')}
                                />
                                <Label htmlFor="all-employees" className="font-medium">
                                    Alle Mitarbeiter
                                </Label>
                            </div>

                            {!selectedEmployees.all && (
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {employees?.map((employee) => (
                                        <div key={employee.id} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`employee-${employee.id}`}
                                                checked={selectedEmployees.individual.includes(employee.id)}
                                                onCheckedChange={() => handleEmployeeSelectionChange('individual', employee.id)}
                                            />
                                            <Label htmlFor={`employee-${employee.id}`} className="text-sm">
                                                {employee.first_name} {employee.last_name}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Date Selection */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <CalendarDays className="h-4 w-4" />
                                Datum auswählen
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="all-dates"
                                    checked={selectedDates.all}
                                    onCheckedChange={() => handleDateSelectionChange('all')}
                                />
                                <Label htmlFor="all-dates" className="font-medium">
                                    Alle Tage im Zeitraum
                                </Label>
                            </div>

                            {!selectedDates.all && (
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {dateList.map((date) => (
                                        <div key={date.toISOString()} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`date-${date.toISOString()}`}
                                                checked={selectedDates.individual.some(d => isSameDay(d, date))}
                                                onCheckedChange={() => handleDateSelectionChange('individual', date)}
                                            />
                                            <Label htmlFor={`date-${date.toISOString()}`} className="text-sm">
                                                {format(date, "dd.MM.yyyy (eeee)", { locale: de })}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Fixed Availability Options */}
                {availabilityType === 'FIXED' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Optionen für Schichtzuweisungen
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="use-existing-pattern"
                                    checked={fixedOptions.useExistingPattern}
                                    onCheckedChange={(checked) =>
                                        setFixedOptions(prev => ({ ...prev, useExistingPattern: !!checked }))
                                    }
                                />
                                <Label htmlFor="use-existing-pattern">
                                    Bestehende feste Zeiten als Vorlage verwenden
                                </Label>
                            </div>

                            {fixedOptions.useExistingPattern && (
                                <div className="ml-6 space-y-3 border-l-2 border-gray-200 pl-4">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="match-only-start"
                                            checked={fixedOptions.matchOnlyStart}
                                            onCheckedChange={(checked) =>
                                                setFixedOptions(prev => ({
                                                    ...prev,
                                                    matchOnlyStart: !!checked,
                                                    matchOnlyEnd: checked ? false : prev.matchOnlyEnd
                                                }))
                                            }
                                        />
                                        <Label htmlFor="match-only-start" className="text-sm">
                                            Nur Startzeit abgleichen
                                        </Label>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="match-only-end"
                                            checked={fixedOptions.matchOnlyEnd}
                                            onCheckedChange={(checked) =>
                                                setFixedOptions(prev => ({
                                                    ...prev,
                                                    matchOnlyEnd: !!checked,
                                                    matchOnlyStart: checked ? false : prev.matchOnlyStart
                                                }))
                                            }
                                        />
                                        <Label htmlFor="match-only-end" className="text-sm">
                                            Nur Endzeit abgleichen
                                        </Label>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="adjust-times"
                                            checked={fixedOptions.adjustTimes}
                                            onCheckedChange={(checked) =>
                                                setFixedOptions(prev => ({ ...prev, adjustTimes: !!checked }))
                                            }
                                        />
                                        <Label htmlFor="adjust-times" className="text-sm">
                                            Zeiten an Öffnungszeiten anpassen
                                        </Label>
                                    </div>
                                </div>
                            )}

                            {/* Overwrite and cleanup options */}
                            <div className="space-y-3 border-t pt-4">
                                <div className="text-sm text-muted-foreground mb-2">
                                    Bestehende Zuweisungen verwalten:
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="overwrite-existing"
                                        checked={fixedOptions.overwriteExisting}
                                        onCheckedChange={(checked) =>
                                            setFixedOptions(prev => ({
                                                ...prev,
                                                overwriteExisting: !!checked,
                                                cleanupFirst: checked ? false : prev.cleanupFirst
                                            }))
                                        }
                                    />
                                    <Label htmlFor="overwrite-existing" className="text-sm">
                                        Bestehende Zuweisungen überschreiben
                                    </Label>
                                </div>
                                <div className="text-xs text-muted-foreground ml-6">
                                    Entfernt nur vorhandene Zuweisungen an den gleichen Terminen vor dem Erstellen neuer Zuweisungen.
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="cleanup-first"
                                        checked={fixedOptions.cleanupFirst}
                                        onCheckedChange={(checked) =>
                                            setFixedOptions(prev => ({
                                                ...prev,
                                                cleanupFirst: !!checked,
                                                overwriteExisting: checked ? false : prev.overwriteExisting
                                            }))
                                        }
                                    />
                                    <Label htmlFor="cleanup-first" className="text-sm">
                                        Vorher alle Zuweisungen im Zeitraum löschen
                                    </Label>
                                </div>
                                <div className="text-xs text-muted-foreground ml-6">
                                    Entfernt alle vorhandenen Zuweisungen für die ausgewählten Mitarbeiter im gesamten Zeitraum.
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isProcessing}>
                        Abbrechen
                    </Button>
                    <Button onClick={handleSubmit} disabled={isProcessing}>
                        {isProcessing ? "Erstelle..." :
                            availabilityType === 'FIXED' ? "Schichtzuweisungen erstellen" : "Verfügbarkeit hinzufügen"
                        }
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}