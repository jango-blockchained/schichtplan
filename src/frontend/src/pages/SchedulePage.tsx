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
import { Loader2, AlertCircle, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScheduleTable } from '@/components/ScheduleTable';
import { ScheduleError, PDFLayoutConfig } from '@/types';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

export function SchedulePage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfWeek(new Date(), { weekStartsOn: 1 }),
    to: endOfWeek(new Date(), { weekStartsOn: 1 }),
  });
  const [weeksAmount, setWeeksAmount] = useState<number>(1);
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>();
  const [isLayoutCustomizerOpen, setIsLayoutCustomizerOpen] = useState(false);
  const [createEmptySchedules, setCreateEmptySchedules] = useState<boolean>(false);
  const [includeEmpty, setIncludeEmpty] = useState<boolean>(false);
  const { toast } = useToast();
  const [generationLogs, setGenerationLogs] = useState<{
    timestamp: Date;
    type: 'info' | 'warning' | 'error';
    message: string;
    details?: string;
  }[]>([]);

  const handleIncludeEmptyChange = (checked: boolean) => {
    console.log("Toggling includeEmpty:", { from: includeEmpty, to: checked });
    setIncludeEmpty(checked);
    addGenerationLog('info', `${checked ? 'Including' : 'Excluding'} empty schedules in view`);
  };

  const handleCreateEmptyChange = (checked: boolean) => {
    console.log("Toggling createEmptySchedules:", { from: createEmptySchedules, to: checked });
    setCreateEmptySchedules(checked);
    addGenerationLog('info', `Will ${checked ? 'create' : 'not create'} empty schedules for all employees during generation`);
  };

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
    selectedVersion,
    includeEmpty
  );

  // Fetch data on initial load
  useEffect(() => {
    if (!isLoading && !scheduleData.length) {
      refetch();
    }
  }, []);

  // Log fetch errors
  useEffect(() => {
    if (fetchError) {
      addGenerationLog('error', 'Error fetching schedule data',
        typeof fetchError === 'object' && fetchError !== null && 'message' in fetchError
          ? String((fetchError as { message: unknown }).message)
          : "Ein unerwarteter Fehler ist aufgetreten");
    }
  }, [fetchError]);

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

      // Debug log the parameters being sent
      console.log('Schedule generation parameters:', {
        start_date: dateRange.from.toISOString().split('T')[0],
        end_date: dateRange.to.toISOString().split('T')[0],
        create_empty_schedules: createEmptySchedules
      });

      const result = await generateSchedule(
        dateRange.from.toISOString().split('T')[0],
        dateRange.to.toISOString().split('T')[0],
        createEmptySchedules
      );

      // Debug log the response
      console.log('Schedule generation response:', {
        total_schedules: result?.total_schedules || 0,
        filled_shifts: result?.filled_shifts_count || 0,
        empty_schedules: (result?.total_schedules || 0) - (result?.filled_shifts_count || 0),
        versions: result?.versions || [],
        errors: result?.errors || []
      });

      const errors = result?.errors || [];
      errors.forEach(error => {
        if (!error) return;

        const logType = error.type === 'critical' ? 'error' :
          error.type === 'warning' ? 'warning' : 'info';

        const details = [
          error.date && `Date: ${format(new Date(error.date), 'dd.MM.yyyy')}`,
          error.shift && `Shift: ${error.shift}`
        ].filter(Boolean).join(' | ');

        addGenerationLog(logType, error.message || 'Unknown error', details || undefined);
      });

      addGenerationLog('info', 'Schedule generation completed',
        `Generated ${result?.total_shifts || 0} shifts`);

      return result;
    },
    onSuccess: (data) => {
      if (data?.schedules) {
        // Update the schedule data directly without refetching
        scheduleData.length = 0;
        scheduleData.push(...data.schedules);
      } else {
        // Fallback to refetch if schedules are not in the response
        refetch();
      }
      toast({
        title: "Erfolg",
        description: `Schichtplan wurde erfolgreich generiert. ${data?.filled_shifts_count || data?.total_shifts || 0} Schichten wurden erstellt.`,
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

  // Show loading overlay for subsequent data fetches
  const isUpdating = isLoading || updateShiftMutation.isPending || generateMutation.isPending || exportMutation.isPending;

  // Initialize PDFLayoutConfig with required properties
  const defaultPDFConfig: PDFLayoutConfig = {
    page_size: 'A4',
    orientation: 'portrait',
    table_style: {
      header_background: '#f1f5f9',
      row_background: '#ffffff',
      alternate_row_background: '#f8fafc',
      border_color: '#e2e8f0',
      text_color: '#1e293b',
    },
    fonts: {
      regular: 'Helvetica',
      bold: 'Helvetica-Bold',
    },
    content: {
      title: 'Schichtplan',
      subtitle: '',
      footer: '',
    },
  };

  const { config: pdfConfig = defaultPDFConfig, updateConfig } = usePDFConfig();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <DateRangePicker
              dateRange={dateRange}
              onChange={handleWeekChange}
              selectWeek
            />
            <Select value={weeksAmount.toString()} onValueChange={handleWeeksAmountChange}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Wochen" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((week) => (
                  <SelectItem key={week} value={week.toString()}>
                    {week} {week === 1 ? 'Woche' : 'Wochen'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex space-x-4 my-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="createEmptySchedules"
                  checked={createEmptySchedules}
                  onCheckedChange={handleCreateEmptyChange}
                />
                <label
                  htmlFor="createEmptySchedules"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Leere Zeilen für alle Mitarbeiter erstellen
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeEmptySchedules"
                  checked={includeEmpty}
                  onCheckedChange={handleIncludeEmptyChange}
                />
                <label
                  htmlFor="includeEmptySchedules"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Leere Zeilen anzeigen
                </label>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {versions && versions.length > 0 && (
              <Select
                value={selectedVersion?.toString() ?? "current"}
                onValueChange={(value) => setSelectedVersion(value === "current" ? undefined : parseInt(value, 10))}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Version auswählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Aktuelle Version</SelectItem>
                  {versions.map((version) => (
                    <SelectItem key={version} value={version.toString()}>
                      Version {version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Schichtplan generieren
            </Button>
            <Button
              variant="outline"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
            >
              {exportMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              PDF Export
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsLayoutCustomizerOpen(true)}
            >
              PDF Layout
            </Button>
          </div>
        </div>

        <DndProvider backend={HTML5Backend}>
          <div className="relative">
            {isLoading && (
              <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            )}
            <ScheduleTable
              schedules={scheduleData || []}
              dateRange={dateRange}
              onDrop={handleDrop}
              isLoading={isLoading}
            />
          </div>
        </DndProvider>

        {/* Logs Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold">Logs</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearGenerationLogs}
              className="h-8 px-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {generationLogs.map((log, index) => (
                <Alert
                  key={index}
                  variant={log.type === 'error' ? 'destructive' : 'default'}
                >
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle className="text-sm">
                    {format(log.timestamp, 'HH:mm:ss')} - {log.message}
                  </AlertTitle>
                  {log.details && (
                    <AlertDescription className="text-sm mt-1">
                      {log.details}
                    </AlertDescription>
                  )}
                </Alert>
              ))}
              {generationLogs.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">
                  Keine Logs vorhanden
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

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
  );
} 