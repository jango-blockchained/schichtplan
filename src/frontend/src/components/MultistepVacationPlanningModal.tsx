import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Absence, AbsenceType, Employee } from "@/types";
import { differenceInDays, format, parseISO } from "date-fns";
import { AlertTriangle, ArrowLeft, ArrowRight, Calendar as CalendarIcon, CheckCircle, Plus, Trash2, User, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface VacationPeriod {
    id: string;
    startDate: string;
    endDate: string;
    type: string;
    status: string;
    note?: string;
}

interface EmployeeVacationData {
    employee: Employee;
    existingVacations: Absence[];
    plannedVacations: VacationPeriod[];
    remainingDays: number;
    usedDays: number;
    totalDays: number;
}

interface MultistepVacationPlanningModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    employees: Employee[];
    absenceTypes: AbsenceType[];
    existingAbsences: Absence[];
    onSubmit: (entries: Array<{
        employee_id: number;
        absence_type_id: string;
        start_date: string;
        end_date: string;
        status: string;
        note?: string;
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

export function MultistepVacationPlanningModal({
    open,
    onOpenChange,
    employees,
    absenceTypes,
    existingAbsences,
    onSubmit,
    isLoading = false,
}: MultistepVacationPlanningModalProps) {
    const [activeTab, setActiveTab] = useState("overview");
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
    const [employeeVacationData, setEmployeeVacationData] = useState<EmployeeVacationData[]>([]);

    // Initialize employee vacation data
    useEffect(() => {
        if (!open || !employees.length) return;

        const data = employees.map(employee => {
            const existingVacations = existingAbsences.filter(absence => absence.employee_id === employee.id);
            const usedDays = existingVacations.reduce((total, absence) => {
                const start = parseISO(absence.start_date);
                const end = parseISO(absence.end_date);
                return total + differenceInDays(end, start) + 1; // +1 to include both start and end dates
            }, 0);

            return {
                employee,
                existingVacations,
                plannedVacations: [],
                remainingDays: Math.max(0, employee.vacation_per_year - usedDays),
                usedDays,
                totalDays: employee.vacation_per_year,
            };
        });

        setEmployeeVacationData(data);
    }, [open, employees, existingAbsences]);

    // Reset state when modal closes
    useEffect(() => {
        if (!open) {
            setActiveTab("overview");
            setSelectedEmployeeId(null);
            setEmployeeVacationData([]);
        }
    }, [open]);

    const selectedEmployeeData = useMemo(() => {
        return employeeVacationData.find(data => data.employee.id === selectedEmployeeId) || null;
    }, [employeeVacationData, selectedEmployeeId]);

    const addVacationPeriod = useCallback(() => {
        if (!selectedEmployeeData) return;

        const newPeriod: VacationPeriod = {
            id: `temp-${Date.now()}-${Math.random()}`,
            startDate: "",
            endDate: "",
            type: absenceTypes[0]?.id || "",
            status: "requested",
            note: "",
        };

        setEmployeeVacationData(prev =>
            prev.map(data =>
                data.employee.id === selectedEmployeeId
                    ? { ...data, plannedVacations: [...data.plannedVacations, newPeriod] }
                    : data
            )
        );
    }, [selectedEmployeeData, selectedEmployeeId, absenceTypes]);

    const updateVacationPeriod = useCallback((periodId: string, field: keyof VacationPeriod, value: string) => {
        if (!selectedEmployeeId) return;

        setEmployeeVacationData(prev =>
            prev.map(data =>
                data.employee.id === selectedEmployeeId
                    ? {
                        ...data,
                        plannedVacations: data.plannedVacations.map(period =>
                            period.id === periodId ? { ...period, [field]: value } : period
                        )
                    }
                    : data
            )
        );
    }, [selectedEmployeeId]);

    const removeVacationPeriod = useCallback((periodId: string) => {
        if (!selectedEmployeeId) return;

        setEmployeeVacationData(prev =>
            prev.map(data =>
                data.employee.id === selectedEmployeeId
                    ? {
                        ...data,
                        plannedVacations: data.plannedVacations.filter(period => period.id !== periodId)
                    }
                    : data
            )
        );
    }, [selectedEmployeeId]);

    const calculatePeriodDays = useCallback((startDate: string, endDate: string) => {
        if (!startDate || !endDate) return 0;
        try {
            const start = parseISO(startDate);
            const end = parseISO(endDate);
            return differenceInDays(end, start) + 1;
        } catch {
            return 0;
        }
    }, []);

    const handleSubmit = useCallback(() => {
        const allPlannedVacations = employeeVacationData.flatMap(data =>
            data.plannedVacations
                .filter(period => period.startDate && period.endDate && period.type)
                .map(period => ({
                    employee_id: data.employee.id,
                    absence_type_id: period.type,
                    start_date: period.startDate,
                    end_date: period.endDate,
                    status: period.status,
                    note: period.note,
                }))
        );

        if (!allPlannedVacations.length) return;

        onSubmit(allPlannedVacations);
    }, [employeeVacationData, onSubmit]);

    const totalPlannedVacations = useMemo(() => {
        return employeeVacationData.reduce((total, data) => total + data.plannedVacations.length, 0);
    }, [employeeVacationData]);

    const canProceedToReview = totalPlannedVacations > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Mehrstufige Urlaubsplanung
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="overview" className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Übersicht
                        </TabsTrigger>
                        <TabsTrigger value="employee" className="flex items-center gap-2" disabled={!selectedEmployeeId}>
                            <User className="h-4 w-4" />
                            Mitarbeiter bearbeiten
                        </TabsTrigger>
                        <TabsTrigger value="review" className="flex items-center gap-2" disabled={!canProceedToReview}>
                            <CheckCircle className="h-4 w-4" />
                            Überprüfen
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Mitarbeiter-Übersicht</CardTitle>
                                <CardDescription>
                                    Wählen Sie einen Mitarbeiter aus, um Urlaubszeiten hinzuzufügen. Die Übersicht zeigt den aktuellen Urlaubsstatus.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[400px]">
                                    <div className="space-y-3">
                                        {employeeVacationData.map((data) => {
                                            const hasPlannedVacations = data.plannedVacations.length > 0;
                                            const vacationPercentage = data.totalDays > 0 ? (data.usedDays / data.totalDays) * 100 : 0;

                                            return (
                                                <Card
                                                    key={data.employee.id}
                                                    className={`cursor-pointer transition-colors ${selectedEmployeeId === data.employee.id
                                                            ? "ring-2 ring-primary"
                                                            : "hover:bg-muted/50"
                                                        }`}
                                                    onClick={() => setSelectedEmployeeId(data.employee.id)}
                                                >
                                                    <CardContent className="p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div>
                                                                    <h4 className="font-medium">
                                                                        {data.employee.first_name} {data.employee.last_name}
                                                                    </h4>
                                                                    <p className="text-sm text-muted-foreground">
                                                                        {data.employee.employee_id}
                                                                    </p>
                                                                </div>
                                                                {hasPlannedVacations && (
                                                                    <Badge variant="secondary">
                                                                        {data.plannedVacations.length} geplant
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-sm">
                                                                    <span className="font-medium">{data.remainingDays}</span>
                                                                    <span className="text-muted-foreground"> / {data.totalDays} Tage</span>
                                                                </div>
                                                                <div className="w-24 bg-muted rounded-full h-2 mt-1">
                                                                    <div
                                                                        className={`h-2 rounded-full ${vacationPercentage > 80 ? "bg-red-500" :
                                                                                vacationPercentage > 60 ? "bg-yellow-500" : "bg-green-500"
                                                                            }`}
                                                                        style={{ width: `${Math.min(vacationPercentage, 100)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {data.existingVacations.length > 0 && (
                                                            <div className="mt-2 text-xs text-muted-foreground">
                                                                Bereits geplant: {data.existingVacations.length} Urlaubstage
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>

                        <div className="flex justify-end">
                            <Button
                                onClick={() => setActiveTab("employee")}
                                disabled={!selectedEmployeeId}
                                className="flex items-center gap-2"
                            >
                                Mitarbeiter bearbeiten
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="employee" className="space-y-4">
                        {selectedEmployeeData && (
                            <>
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <User className="h-5 w-5" />
                                            {selectedEmployeeData.employee.first_name} {selectedEmployeeData.employee.last_name}
                                        </CardTitle>
                                        <CardDescription>
                                            Urlaubstage verfügbar: {selectedEmployeeData.remainingDays} von {selectedEmployeeData.totalDays}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-medium">Geplante Urlaubszeiten</h4>
                                                <Button
                                                    onClick={addVacationPeriod}
                                                    size="sm"
                                                    className="flex items-center gap-2"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                    Urlaubszeit hinzufügen
                                                </Button>
                                            </div>

                                            <ScrollArea className="h-[300px]">
                                                <div className="space-y-3">
                                                    {selectedEmployeeData.plannedVacations.length === 0 ? (
                                                        <div className="text-center py-8 text-muted-foreground">
                                                            <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                                            <p>Keine Urlaubszeiten geplant</p>
                                                            <p className="text-sm">Klicken Sie auf "Urlaubszeit hinzufügen"</p>
                                                        </div>
                                                    ) : (
                                                        selectedEmployeeData.plannedVacations.map((period, index) => {
                                                            const days = calculatePeriodDays(period.startDate, period.endDate);
                                                            const exceedsRemaining = days > selectedEmployeeData.remainingDays;

                                                            return (
                                                                <Card key={period.id} className="relative">
                                                                    <CardContent className="p-4">
                                                                        <div className="flex items-start justify-between mb-3">
                                                                            <h5 className="text-sm font-medium">
                                                                                Urlaubszeit {index + 1}
                                                                            </h5>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => removeVacationPeriod(period.id)}
                                                                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </div>

                                                                        <div className="grid gap-3 md:grid-cols-2">
                                                                            <div>
                                                                                <Label className="text-xs">Von</Label>
                                                                                <DateInput
                                                                                    value={period.startDate}
                                                                                    onChange={(value) => updateVacationPeriod(period.id, "startDate", value)}
                                                                                    placeholder="YYYY-MM-DD"
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <Label className="text-xs">Bis</Label>
                                                                                <DateInput
                                                                                    value={period.endDate}
                                                                                    onChange={(value) => updateVacationPeriod(period.id, "endDate", value)}
                                                                                    placeholder="YYYY-MM-DD"
                                                                                />
                                                                            </div>
                                                                        </div>

                                                                        <div className="grid gap-3 md:grid-cols-2 mt-3">
                                                                            <div>
                                                                                <Label className="text-xs">Typ</Label>
                                                                                <Select
                                                                                    value={period.type}
                                                                                    onValueChange={(value) => updateVacationPeriod(period.id, "type", value)}
                                                                                >
                                                                                    <SelectTrigger className="h-9">
                                                                                        <SelectValue placeholder="Typ auswählen" />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent>
                                                                                        {absenceTypes.map((type) => (
                                                                                            <SelectItem key={type.id} value={type.id}>
                                                                                                {type.name}
                                                                                            </SelectItem>
                                                                                        ))}
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            </div>
                                                                            <div>
                                                                                <Label className="text-xs">Status</Label>
                                                                                <Select
                                                                                    value={period.status}
                                                                                    onValueChange={(value) => updateVacationPeriod(period.id, "status", value)}
                                                                                >
                                                                                    <SelectTrigger className="h-9">
                                                                                        <SelectValue placeholder="Status" />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent>
                                                                                        <SelectItem value="requested">Beantragt</SelectItem>
                                                                                        <SelectItem value="approved">Genehmigt</SelectItem>
                                                                                        <SelectItem value="declined">Abgelehnt</SelectItem>
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            </div>
                                                                        </div>

                                                                        <div className="mt-3">
                                                                            <Input
                                                                                placeholder="Notiz (optional)"
                                                                                value={period.note || ""}
                                                                                onChange={(e) => updateVacationPeriod(period.id, "note", e.target.value)}
                                                                                className="h-8 text-xs"
                                                                            />
                                                                        </div>

                                                                        {days > 0 && (
                                                                            <div className="mt-2 flex items-center gap-2">
                                                                                <Badge variant={exceedsRemaining ? "destructive" : "secondary"}>
                                                                                    {days} Tag{days !== 1 ? 'e' : ''}
                                                                                </Badge>
                                                                                {exceedsRemaining && (
                                                                                    <AlertTriangle className="h-4 w-4 text-destructive" />
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </CardContent>
                                                                </Card>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </ScrollArea>
                                        </div>
                                    </CardContent>
                                </Card>

                                <div className="flex justify-between">
                                    <Button
                                        variant="outline"
                                        onClick={() => setActiveTab("overview")}
                                        className="flex items-center gap-2"
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                        Zurück zur Übersicht
                                    </Button>
                                    <Button
                                        onClick={() => setActiveTab("review")}
                                        disabled={!canProceedToReview}
                                        className="flex items-center gap-2"
                                    >
                                        Überprüfen
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </>
                        )}
                    </TabsContent>

                    <TabsContent value="review" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Überprüfung der Urlaubsplanung</CardTitle>
                                <CardDescription>
                                    Überprüfen Sie alle geplanten Urlaubszeiten vor der Einreichung.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[400px]">
                                    <div className="space-y-4">
                                        {employeeVacationData
                                            .filter(data => data.plannedVacations.length > 0)
                                            .map((data) => (
                                                <Card key={data.employee.id}>
                                                    <CardHeader className="pb-3">
                                                        <CardTitle className="text-lg">
                                                            {data.employee.first_name} {data.employee.last_name}
                                                        </CardTitle>
                                                        <CardDescription>
                                                            Verbleibende Urlaubstage: {data.remainingDays} von {data.totalDays}
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="space-y-3">
                                                            {data.plannedVacations.map((period, index) => {
                                                                const days = calculatePeriodDays(period.startDate, period.endDate);
                                                                const typeName = absenceTypes.find(t => t.id === period.type)?.name || period.type;
                                                                const exceedsRemaining = days > data.remainingDays;

                                                                return (
                                                                    <div key={period.id} className="flex items-center justify-between p-3 border rounded-lg">
                                                                        <div className="flex-1">
                                                                            <div className="flex items-center gap-2 mb-1">
                                                                                <span className="font-medium">Urlaub {index + 1}</span>
                                                                                <Badge variant="outline">{typeName}</Badge>
                                                                                <Badge variant={period.status === 'approved' ? 'default' : 'secondary'}>
                                                                                    {period.status === 'approved' ? 'Genehmigt' :
                                                                                        period.status === 'requested' ? 'Beantragt' : 'Abgelehnt'}
                                                                                </Badge>
                                                                            </div>
                                                                            <div className="text-sm text-muted-foreground">
                                                                                {period.startDate} - {period.endDate} ({days} Tage)
                                                                            </div>
                                                                            {period.note && (
                                                                                <div className="text-sm text-muted-foreground mt-1">
                                                                                    Notiz: {period.note}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        {exceedsRemaining && (
                                                                            <AlertTriangle className="h-5 w-5 text-destructive" />
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>

                        <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                                Bitte überprüfen Sie alle Angaben sorgfältig. Nach der Einreichung können Urlaubszeiten nur vom Administrator geändert werden.
                            </AlertDescription>
                        </Alert>

                        <div className="flex justify-between">
                            <Button
                                variant="outline"
                                onClick={() => setActiveTab("employee")}
                                className="flex items-center gap-2"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Zurück bearbeiten
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter className="mt-6">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Abbrechen
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading || !canProceedToReview}
                        className="flex items-center gap-2"
                    >
                        {isLoading ? "Wird gespeichert..." : "Urlaubszeiten einreichen"}
                        <CheckCircle className="h-4 w-4" />
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}