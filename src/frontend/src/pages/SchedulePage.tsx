import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { addDays, startOfWeek } from 'date-fns';
import { generateSchedule, exportSchedule } from '../services/api';
import { ShiftTable } from '../components/ShiftTable';
import LayoutCustomizer from '../components/LayoutCustomizer';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';

export const SchedulePage = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLayoutCustomizerOpen, setIsLayoutCustomizerOpen] = useState(false);

  const generateMutation = useMutation({
    mutationFn: () => {
      const start = startOfWeek(selectedDate);
      const end = addDays(start, 6);
      return generateSchedule(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
    },
  });

  const exportMutation = useMutation({
    mutationFn: () => {
      const start = startOfWeek(selectedDate);
      const end = addDays(start, 6);
      return exportSchedule(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
    },
  });

  // Sample data for demonstration
  const sampleEmployees = [
    {
      name: 'Mander, Maike',
      position: 'TZ',
      contractedHours: '40:00',
      shifts: [
        { day: 0, start: '8:55', end: '18:00', break: { start: '12:00', end: '13:00' } },
        { day: 1, start: '8:55', end: '18:00', break: { start: '12:00', end: '13:00' } },
      ],
    },
    {
      name: 'Klepzig, Chantal',
      position: 'TZ',
      contractedHours: '30:00',
      shifts: [
        { day: 2, start: '14:00', end: '20:10' },
        { day: 3, start: '8:55', end: '15:00' },
      ],
    },
  ];

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Schichtplan</h1>
        <div className="flex gap-4">
          <DatePicker
            date={selectedDate}
            onChange={(date: Date | null) => date && setSelectedDate(date)}
          />
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isLoading}
          >
            Schichtplan generieren
          </Button>
          <Button
            variant="outline"
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isLoading}
          >
            Als PDF exportieren
          </Button>
          <Button
            variant="secondary"
            onClick={() => setIsLayoutCustomizerOpen(true)}
          >
            Layout anpassen
          </Button>
        </div>
      </div>

      <Dialog open={isLayoutCustomizerOpen} onOpenChange={setIsLayoutCustomizerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>PDF Layout Anpassen</DialogTitle>
          </DialogHeader>
          <LayoutCustomizer />
        </DialogContent>
      </Dialog>

      {selectedDate && (
        <ShiftTable
          weekStart={startOfWeek(selectedDate)}
          weekEnd={addDays(startOfWeek(selectedDate), 6)}
          employees={sampleEmployees}
        />
      )}
    </div>
  );
}; 