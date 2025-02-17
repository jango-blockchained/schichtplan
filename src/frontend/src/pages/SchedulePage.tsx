import React, { useState } from 'react';
import { ShiftTable } from '@/components/ShiftTable';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { useScheduleData } from '@/hooks/useScheduleData';
import { addDays, startOfWeek, endOfWeek } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';
import { generateSchedule, exportSchedule, updateShiftDay } from '@/services/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PDFLayoutEditor } from '@/components/PDFLayoutEditor';
import { usePDFConfig } from '@/hooks/usePDFConfig';
import { DateRange } from 'react-day-picker';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

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
    error,
    refetch
  } = useScheduleData(
    dateRange?.from || new Date(),
    dateRange?.to || addDays(dateRange?.from || new Date(), 6)
  );

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!dateRange?.from || !dateRange?.to) return;
      return generateSchedule(
        dateRange.from.toISOString().split('T')[0],
        dateRange.to.toISOString().split('T')[0]
      );
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "Erfolg",
        description: "Schichtplan wurde erfolgreich generiert.",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Ein Fehler ist aufgetreten",
        variant: "destructive",
      });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!dateRange?.from || !dateRange?.to) return;
      const response = await exportSchedule(
        dateRange.from.toISOString().split('T')[0],
        dateRange.to.toISOString().split('T')[0],
        pdfConfig
      );
      // Create a blob URL and trigger download
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
        description: error instanceof Error ? error.message : "Ein Fehler ist aufgetreten",
        variant: "destructive",
      });
    },
  });

  const updateShiftMutation = useMutation({
    mutationFn: async ({ employeeId, fromDay, toDay }: { employeeId: number; fromDay: number; toDay: number }) => {
      if (!dateRange?.from) return;
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
        description: error instanceof Error ? error.message : "Ein Fehler ist aufgetreten",
        variant: "destructive",
      });
    },
  });

  const handleShiftUpdate = async (employeeId: number, fromDay: number, toDay: number) => {
    await updateShiftMutation.mutateAsync({ employeeId, fromDay, toDay });
  };

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
            disabled={generateMutation.isLoading || !dateRange?.from || !dateRange?.to}
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
            disabled={exportMutation.isLoading || !dateRange?.from || !dateRange?.to}
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
          >
            Layout anpassen
          </Button>
        </div>
      </div>

      {dateRange?.from && dateRange?.to ? (
        <ShiftTable
          weekStart={dateRange.from}
          weekEnd={dateRange.to}
          isLoading={isLoading || updateShiftMutation.isLoading}
          error={error}
          data={scheduleData}
          onShiftUpdate={handleShiftUpdate}
        />
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