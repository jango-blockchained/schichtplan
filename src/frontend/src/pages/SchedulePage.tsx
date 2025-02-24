import React, { useState, useEffect } from 'react';
import { ShiftTable } from '@/components/ShiftTable';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { useScheduleData } from '@/hooks/useScheduleData';
import { addDays, startOfWeek, endOfWeek, addWeeks, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';
import { generateSchedule, exportSchedule, updateShiftDay, updateBreakNotes, updateSchedule } from '@/services/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PDFLayoutEditor } from '@/components/PDFLayoutEditor';
import { usePDFConfig } from '@/hooks/usePDFConfig';
import { DateRange } from 'react-day-picker';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScheduleTable } from '@/components/ScheduleTable';
import { ScheduleError } from '@/types';
import { cn } from '@/lib/utils';

export function SchedulePage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfWeek(new Date(), { weekStartsOn: 1 }),
    to: endOfWeek(new Date(), { weekStartsOn: 1 }),
  });
  const [weeksAmount, setWeeksAmount] = useState<number>(1);
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>();
  const [isLayoutCustomizerOpen, setIsLayoutCustomizerOpen] = useState(false);
  const { config: pdfConfig, updateConfig } = usePDFConfig();
  const { toast } = useToast();
  const [generationLogs, setGenerationLogs] = useState<{
    timestamp: Date;
    type: 'info' | 'warning' | 'error';
    message: string;
    details?: string;
  }[]>([]);

  const {
    scheduleData,
    versions,
    errors,
    loading: isLoading,
    error: fetchError,
    refetch
  } = useScheduleData(
    dateRange?.from || new Date(),
    dateRange?.to || addDays(dateRange?.from || new Date(), 6),
    selectedVersion
  );

  const addGenerationLog = (type: 'info' | 'warning' | 'error', message: string, details?: string) => {
    setGenerationLogs(prev => [...prev, {
      timestamp: new Date(),
      type,
      message,
      details
    }]);
  };

  const clearGenerationLogs = () => {
    setGenerationLogs([]);
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!dateRange?.from || !dateRange?.to) {
        throw new Error("Bitte wählen Sie einen Zeitraum aus");
      }

      addGenerationLog('info', 'Starting schedule generation',
        `Period: ${format(dateRange.from, 'dd.MM.yyyy')} to ${format(dateRange.to, 'dd.MM.yyyy')}`);

      const result = await generateSchedule(
        dateRange.from.toISOString().split('T')[0],
        dateRange.to.toISOString().split('T')[0]
      );

      if (result.errors && result.errors.length > 0) {
        result.errors.forEach(error => {
          const logType = error.type === 'critical' ? 'error' : error.type === 'warning' ? 'warning' : 'info';
          const details = [
            error.date && `Date: ${format(new Date(error.date), 'dd.MM.yyyy')}`,
            error.shift && `Shift: ${error.shift}`
          ].filter(Boolean).join(' | ');

          addGenerationLog(logType, error.message, details);
        });
      }

      addGenerationLog('info', 'Schedule generation completed',
        `Generated ${result.total_shifts} shifts`);

      return result;
    },
    onSuccess: (data) => {
      refetch();
      toast({
        title: "Erfolg",
        description: `Schichtplan wurde erfolgreich generiert. ${data?.total_shifts || 0} Schichten wurden erstellt.`,
      });
    },
    onError: (error) => {
      addGenerationLog('error', 'Schedule generation failed',
        error instanceof Error ? error.message : "Unknown error");

      toast({
        title: "Fehler bei der Generierung",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive",
      });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!dateRange?.from || !dateRange?.to) {
        throw new Error("Bitte wählen Sie einen Zeitraum aus");
      }
      addGenerationLog('info', 'Starting PDF export');
      const response = await exportSchedule(
        dateRange.from.toISOString().split('T')[0],
        dateRange.to.toISOString().split('T')[0],
        pdfConfig
      );
      addGenerationLog('info', 'PDF export completed');
      const blob = new Blob([response], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Schichtplan_${dateRange.from.toISOString().split('T')[0]}_${dateRange.to.toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onError: (error) => {
      addGenerationLog('error', 'PDF export failed',
        error instanceof Error ? error.message : "Unknown error");
      toast({
        title: "Fehler beim Export",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive",
      });
    },
  });

  const updateShiftMutation = useMutation({
    mutationFn: async ({ employeeId, fromDay, toDay }: { employeeId: number; fromDay: number; toDay: number }) => {
      if (!dateRange?.from) {
        throw new Error("Kein Zeitraum ausgewählt");
      }
      const baseDate = dateRange.from;
      const fromDate = addDays(baseDate, fromDay);
      const toDate = addDays(baseDate, toDay);
      return updateShiftDay(employeeId, fromDate.toISOString().split('T')[0], toDate.toISOString().split('T')[0]);
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "Erfolg",
        description: "Schicht wurde erfolgreich verschoben.",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive",
      });
    },
  });

  const updateBreakNotesMutation = useMutation({
    mutationFn: async ({ employeeId, day, notes }: { employeeId: number; day: number; notes: string }) => {
      if (!dateRange?.from) {
        throw new Error("Kein Zeitraum ausgewählt");
      }
      const date = addDays(dateRange.from, day);
      return updateBreakNotes(employeeId, date.toISOString().split('T')[0], notes);
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "Erfolg",
        description: "Pausennotizen wurden aktualisiert.",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive",
      });
    },
  });

  const handleShiftUpdate = async (employeeId: number, fromDay: number, toDay: number) => {
    await updateShiftMutation.mutateAsync({ employeeId, fromDay, toDay });
  };

  const handleBreakNotesUpdate = async (employeeId: number, day: number, notes: string) => {
    await updateBreakNotesMutation.mutateAsync({ employeeId, day, notes });
  };

  const handleWeekChange = (range: DateRange | undefined) => {
    if (range?.from) {
      setDateRange({
        from: range.from,
        to: addDays(range.from, (weeksAmount * 7) - 1)
      });
    }
  };

  const handleWeeksAmountChange = (amount: string) => {
    const weeks = parseInt(amount, 10);
    setWeeksAmount(weeks);
    if (dateRange?.from) {
      setDateRange({
        from: dateRange.from,
        to: addDays(dateRange.from, (weeks * 7) - 1)
      });
    }
  };

  const handleDrop = async (scheduleId: number, newEmployeeId: number, newDate: Date, newShiftId: number) => {
    try {
      addGenerationLog('info', 'Attempting to move schedule',
        `Schedule ID: ${scheduleId}, Employee ID: ${newEmployeeId}, Date: ${format(newDate, 'dd.MM.yyyy')}, Shift ID: ${newShiftId}`);

      await updateSchedule(scheduleId, {
        employee_id: newEmployeeId,
        date: format(newDate, 'yyyy-MM-dd'),
        shift_id: newShiftId
      });

      addGenerationLog('info', 'Successfully moved schedule',
        `Schedule ID: ${scheduleId}`);
      refetch();
      toast({
        title: "Erfolg",
        description: "Schicht wurde erfolgreich verschoben",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten";
      addGenerationLog('error', 'Failed to move schedule',
        errorMessage);

      toast({
        title: "Fehler beim Verschieben",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Show loading skeleton for initial data fetch
  if (isLoading && !scheduleData) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell>
                  <Skeleton className="h-6 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-24" />
                </TableCell>
                {Array.from({ length: 6 }).map((_, i) => (
                  <TableCell key={i}>
                    <Skeleton className="h-6 w-24" />
                  </TableCell>
                ))}
                <TableCell>
                  <Skeleton className="h-6 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-24" />
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-24 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-24 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-24 w-24" />
                  </TableCell>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-24 w-24" />
                    </TableCell>
                  ))}
                  <TableCell>
                    <Skeleton className="h-24 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-24 w-24" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    );
  }

  // Show error state
  if (fetchError || generateMutation.error) {
    const error = (fetchError || generateMutation.error) as Error;
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Fehler</AlertTitle>
          <AlertDescription>
            {error.message || "Ein unerwarteter Fehler ist aufgetreten"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Show loading overlay for subsequent data fetches
  const isUpdating = isLoading || updateShiftMutation.isLoading || generateMutation.isLoading || exportMutation.isLoading;

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Schichtplan</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Select
                value={weeksAmount.toString()}
                onValueChange={handleWeeksAmountChange}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Anzahl Wochen" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map(num => (
                    <SelectItem key={num} value={num.toString()}>
                      {num} {num === 1 ? 'Woche' : 'Wochen'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DateRangePicker
                dateRange={dateRange}
                onChange={handleWeekChange}
                selectWeek
              />
            </div>
            {versions && versions.length > 0 && (
              <Select
                value={selectedVersion?.toString()}
                onValueChange={(v) => setSelectedVersion(v ? parseInt(v, 10) : undefined)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Version wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aktuelle Version</SelectItem>
                  {versions.map(version => (
                    <SelectItem key={version} value={version.toString()}>
                      Version {version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={isUpdating || !dateRange?.from || !dateRange?.to}
            >
              {generateMutation.isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generiere...
                </>
              ) : (
                "Schichtplan generieren"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => exportMutation.mutate()}
              disabled={isUpdating || !dateRange?.from || !dateRange?.to}
            >
              {exportMutation.isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exportiere...
                </>
              ) : (
                "Als PDF exportieren"
              )}
            </Button>

          </div>
        </div>

        {errors && errors.length > 0 && (
          <Card className="bg-destructive/5">
            <CardHeader>
              <CardTitle>Warnungen und Fehler</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {errors.map((error, index) => (
                  <Alert
                    key={index}
                    variant={error.type === 'critical' ? 'destructive' : 'default'}
                  >
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>
                      {error.type === 'critical' ? 'Kritischer Fehler' : 'Warnung'}
                      {error.date && ` - ${format(new Date(error.date), 'dd.MM.yyyy')}`}
                      {error.shift && ` - ${error.shift}`}
                    </AlertTitle>
                    <AlertDescription>{error.message}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {scheduleData && (
          <ScheduleTable
            schedules={scheduleData}
            dateRange={dateRange}
            onDrop={handleDrop}
            isLoading={isLoading}
          />
        )}

        {/* Generation Logs */}
        {generationLogs.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Generierungsverlauf</CardTitle>
              <Button variant="outline" size="sm" onClick={clearGenerationLogs}>
                Verlauf löschen
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {generationLogs.map((log, index) => (
                  <div
                    key={index}
                    className={cn(
                      "p-3 rounded text-sm",
                      log.type === 'error' && "bg-destructive/10 text-destructive",
                      log.type === 'warning' && "bg-warning/10 text-warning",
                      log.type === 'info' && "bg-muted"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="font-medium">{log.message}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(log.timestamp, 'HH:mm:ss')}
                      </div>
                    </div>
                    {log.details && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {log.details}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={isLayoutCustomizerOpen} onOpenChange={setIsLayoutCustomizerOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>PDF Layout anpassen</DialogTitle>
            </DialogHeader>
            <PDFLayoutEditor
              config={pdfConfig}
              onConfigChange={updateConfig}
            />
          </DialogContent>
        </Dialog>
      </div>
    </DndProvider>
  );
} 