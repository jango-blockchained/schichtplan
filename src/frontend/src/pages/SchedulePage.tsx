import React, { useState } from 'react';
import { ShiftTable } from '@/components/ShiftTable';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { useScheduleData } from '@/hooks/useScheduleData';
import { addDays, startOfWeek, endOfWeek } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';
import { generateSchedule, exportSchedule, updateShiftDay, updateBreakNotes } from '@/services/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PDFLayoutEditor } from '@/components/PDFLayoutEditor';
import { usePDFConfig } from '@/hooks/usePDFConfig';
import { DateRange } from 'react-day-picker';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableCell, TableRow } from '@/components/ui/table';

export function SchedulePage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfWeek(new Date(), { weekStartsOn: 1 }),
    to: endOfWeek(new Date(), { weekStartsOn: 1 }),
  });

  const [isLayoutCustomizerOpen, setIsLayoutCustomizerOpen] = useState(false);
  const { config: pdfConfig, updateConfig } = usePDFConfig();
  const { toast } = useToast();

  const {
    scheduleData,
    loading: isLoading,
    error: fetchError,
    refetch
  } = useScheduleData(
    dateRange?.from || new Date(),
    dateRange?.to || addDays(dateRange?.from || new Date(), 6)
  );

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!dateRange?.from || !dateRange?.to) {
        throw new Error("Bitte wählen Sie einen Zeitraum aus");
      }
      return generateSchedule(
        dateRange.from.toISOString().split('T')[0],
        dateRange.to.toISOString().split('T')[0]
      );
    },
    onSuccess: (data) => {
      refetch();
      toast({
        title: "Erfolg",
        description: `Schichtplan wurde erfolgreich generiert. ${data?.total_shifts || 0} Schichten wurden erstellt.`,
      });
    },
    onError: (error) => {
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
      const response = await exportSchedule(
        dateRange.from.toISOString().split('T')[0],
        dateRange.to.toISOString().split('T')[0],
        pdfConfig
      );
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
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Schichtplan</h1>
        <div className="flex items-center gap-4">
          <DateRangePicker
            dateRange={dateRange}
            onChange={setDateRange}
          />
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
          <Button
            variant="secondary"
            onClick={() => setIsLayoutCustomizerOpen(true)}
            disabled={isUpdating}
          >
            Layout anpassen
          </Button>
        </div>
      </div>

      {dateRange?.from && dateRange?.to ? (
        <div className="relative">
          {isUpdating && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm text-muted-foreground">
                  {generateMutation.isLoading ? "Generiere Schichtplan..." :
                    exportMutation.isLoading ? "Exportiere PDF..." :
                      "Aktualisiere Daten..."}
                </span>
              </div>
            </div>
          )}
          <ShiftTable
            weekStart={dateRange.from}
            weekEnd={dateRange.to}
            isLoading={isLoading}
            error={fetchError}
            data={scheduleData}
            onShiftUpdate={handleShiftUpdate}
            onBreakNotesUpdate={handleBreakNotesUpdate}
          />
        </div>
      ) : (
        <div className="text-center text-muted-foreground">
          Bitte wählen Sie einen Zeitraum aus
        </div>
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
  );
} 