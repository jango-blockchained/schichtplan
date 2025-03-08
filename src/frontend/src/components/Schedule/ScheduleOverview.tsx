import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Schedule } from "@/types";
import { format } from "date-fns";
import { Users, Calendar, Clock, AlertCircle } from "lucide-react";

interface ScheduleOverviewProps {
    schedules: Schedule[];
    dateRange: { from: Date; to: Date } | undefined;
    version?: number;
}

export function ScheduleOverview({ schedules, dateRange, version }: ScheduleOverviewProps) {
    if (!dateRange?.from || !dateRange?.to) return null;

    // Calculate statistics
    const totalShifts = schedules.length;
    const uniqueEmployees = new Set(schedules.map(s => s.employee_id)).size;
    const shiftsWithBreaks = schedules.filter(s => s.break_start && s.break_end).length;
    const shiftsWithNotes = schedules.filter(s => s.notes).length;

    // Group schedules by employee type
    const employeeTypeStats = schedules.reduce((acc, schedule) => {
        const type = schedule.employee_name ? (schedule.employee_name.match(/\((.*?)\)/)?.[1] ?? 'Other') : 'Other';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Zeitraum
                    </CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {format(dateRange.from, 'dd.MM.')} - {format(dateRange.to, 'dd.MM.yyyy')}
                    </div>
                    {version !== undefined && (
                        <p className="text-xs text-muted-foreground mt-1">
                            Version {version}
                        </p>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Mitarbeiter & Schichten
                    </CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{uniqueEmployees} / {totalShifts}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                        Mitarbeiter / Schichten gesamt
                    </div>
                    <div className="mt-4 space-y-1">
                        {Object.entries(employeeTypeStats).map(([type, count]) => (
                            <div key={type} className="text-xs flex justify-between">
                                <span>{type}:</span>
                                <span className="font-medium">{count} Schichten</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Pausen
                    </CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{shiftsWithBreaks}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                        Schichten mit Pausen
                    </div>
                    <div className="mt-2 text-xs">
                        {((shiftsWithBreaks / totalShifts) * 100).toFixed(1)}% aller Schichten
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Notizen
                    </CardTitle>
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{shiftsWithNotes}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                        Schichten mit Notizen
                    </div>
                    <div className="mt-2 text-xs">
                        {((shiftsWithNotes / totalShifts) * 100).toFixed(1)}% aller Schichten
                    </div>
                </CardContent>
            </Card>
        </div>
    );
} 