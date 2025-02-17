import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useScheduleData } from '@/hooks/useScheduleData';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface ShiftTableProps {
  weekStart: Date;
  weekEnd: Date;
}

const SubRow = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col border-t border-border first:border-t-0">
    {children}
  </div>
);

const LoadingSkeleton = () => (
  <Card className="overflow-x-auto">
    <div className="p-4 space-y-4">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  </Card>
);

export const ShiftTable = ({ weekStart, weekEnd }: ShiftTableProps) => {
  const { scheduleData, loading, error } = useScheduleData(weekStart, weekEnd);
  const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

  if (loading) return <LoadingSkeleton />;
  if (error) return (
    <Alert variant="destructive">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );

  return (
    <Card className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableCell className="font-medium min-w-[150px]">Name, Vorname</TableCell>
            <TableCell className="font-medium w-20">Position</TableCell>
            <TableCell className="font-medium w-20">Plan / Woche</TableCell>
            {days.map((day) => (
              <TableCell key={day} className="font-medium min-w-[100px]">
                {day}
              </TableCell>
            ))}
            <TableCell className="font-medium w-20">Summe / Woche</TableCell>
            <TableCell className="font-medium w-20">Summe / Monat</TableCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {scheduleData.map((employee, index) => (
            <TableRow key={employee.name} className={cn(index % 2 === 0 ? 'bg-background' : 'bg-muted/50')}>
              <TableCell className="align-top">
                <span className="text-sm">{employee.name}</span>
              </TableCell>
              <TableCell className="align-top">{employee.position}</TableCell>
              <TableCell className="align-top">{employee.contractedHours}</TableCell>
              {days.map((_, dayIndex) => {
                const shift = employee.shifts.find((s) => s.day === dayIndex);
                return (
                  <TableCell key={dayIndex} className="align-top">
                    <SubRow>Beginn: {shift?.start || ''}</SubRow>
                    {shift?.break && (
                      <>
                        <SubRow>Pause: {shift.break.start}</SubRow>
                        <SubRow>Ende: {shift.break.end}</SubRow>
                      </>
                    )}
                    <SubRow>Ende: {shift?.end || ''}</SubRow>
                    <SubRow>Summe / Tag: {shift ? calculateHours(shift) : ''}</SubRow>
                  </TableCell>
                );
              })}
              <TableCell className="align-top">{calculateWeeklyHours(employee.shifts)}</TableCell>
              <TableCell className="align-top">{calculateMonthlyHours(employee.shifts)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="p-4 space-y-2 text-sm text-muted-foreground">
        <p>h : 60 Minuten</p>
        <p>
          Anwesenheiten: Arbeitszeitbeginn bis Arbeitszeitende inkl. Pausenzeiten und die Tagesstunden eintragen.
          Am Ende der Woche: wöchentliche und monatliche Summe eintragen.
        </p>
        <p>
          Abwesenheiten: Feiertag, Krankheit (AU-Bescheinigung), Freizeit, Schule (Führungsnachweis), Urlaub
        </p>
      </div>
    </Card>
  );
};

// Helper functions for calculating hours
const calculateHours = (shift: { start?: string; end?: string; break?: { start: string; end: string } }) => {
  if (!shift.start || !shift.end) return '';

  const parseTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours + minutes / 60;
  };

  const start = parseTime(shift.start);
  const end = parseTime(shift.end);
  let totalHours = end - start;

  // Handle shifts crossing midnight
  if (totalHours < 0) {
    totalHours += 24;
  }

  // Subtract break time if present
  if (shift.break) {
    const breakStart = parseTime(shift.break.start);
    const breakEnd = parseTime(shift.break.end);
    let breakDuration = breakEnd - breakStart;
    if (breakDuration < 0) {
      breakDuration += 24;
    }
    totalHours -= breakDuration;
  }

  // Format hours and minutes
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);
  return `${hours}:${minutes.toString().padStart(2, '0')}`;
};

const calculateWeeklyHours = (shifts: Array<{ start?: string; end?: string; break?: { start: string; end: string } }>) => {
  let totalHours = 0;
  shifts.forEach(shift => {
    if (shift.start && shift.end) {
      const shiftHours = calculateHours(shift);
      const [hours, minutes] = shiftHours.split(':').map(Number);
      totalHours += hours + minutes / 60;
    }
  });

  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);
  return `${hours}:${minutes.toString().padStart(2, '0')}`;
};

const calculateMonthlyHours = (shifts: Array<{ start?: string; end?: string; break?: { start: string; end: string } }>) => {
  // For now, we'll just multiply weekly hours by 4.33 (average weeks per month)
  const weeklyHours = calculateWeeklyHours(shifts);
  const [hours, minutes] = weeklyHours.split(':').map(Number);
  const totalMonthlyHours = (hours + minutes / 60) * 4.33;

  const monthlyHours = Math.floor(totalMonthlyHours);
  const monthlyMinutes = Math.round((totalMonthlyHours - monthlyHours) * 60);
  return `${monthlyHours}:${monthlyMinutes.toString().padStart(2, '0')}`;
};