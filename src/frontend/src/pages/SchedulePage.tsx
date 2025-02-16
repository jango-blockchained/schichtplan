import { useState } from 'react';
import { Box, Button, Container, Typography, Dialog, DialogTitle, DialogContent } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { useMutation } from '@tanstack/react-query';
import { generateSchedule, exportSchedule } from '../services/api';
import { ShiftTable } from '../components/ShiftTable';
import LayoutCustomizer from '../components/LayoutCustomizer';
import { addDays, startOfWeek } from 'date-fns';

export const SchedulePage = () => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [isLayoutCustomizerOpen, setIsLayoutCustomizerOpen] = useState(false);

  const handleDateChange = (newValue: Date | null) => {
    setSelectedDate(newValue);
  };

  const generateMutation = useMutation({
    mutationFn: () => {
      if (!selectedDate) return Promise.reject('No date selected');
      const start = startOfWeek(selectedDate);
      const end = addDays(start, 6);
      return generateSchedule(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
    },
  });

  const exportMutation = useMutation({
    mutationFn: () => {
      if (!selectedDate) return Promise.reject('No date selected');
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
    <Container maxWidth="xl">
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">Schichtplan</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <DatePicker
            label="Woche auswählen"
            value={selectedDate}
            onChange={handleDateChange}
          />
          <Button
            variant="contained"
            onClick={() => generateMutation.mutate()}
            disabled={!selectedDate || generateMutation.isPending}
          >
            Schichtplan generieren
          </Button>
          <Button
            variant="outlined"
            onClick={() => exportMutation.mutate()}
            disabled={!selectedDate || exportMutation.isPending}
          >
            Als PDF exportieren
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => setIsLayoutCustomizerOpen(true)}
          >
            Layout anpassen
          </Button>
        </Box>
      </Box>

      <Dialog
        open={isLayoutCustomizerOpen}
        onClose={() => setIsLayoutCustomizerOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>PDF Layout Anpassen</DialogTitle>
        <DialogContent>
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
    </Container>
  );
}; 