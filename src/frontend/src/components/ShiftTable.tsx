import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface ShiftTableProps {
  weekStart: Date;
  weekEnd: Date;
  employees: Array<{
    name: string;
    position: string;
    contractedHours: string;
    shifts: Array<{
      day: number; // 0-6 for Monday-Sunday
      start?: string;
      end?: string;
      break?: {
        start: string;
        end: string;
      };
    }>;
  }>;
}

const SubRow = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col border-t border-border first:border-t-0">
    {children}
  </div>
);

export const ShiftTable = ({ weekStart, weekEnd, employees }: ShiftTableProps) => {
  const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

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
          {employees.map((employee, index) => (
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
  // Implement actual hour calculation logic here
  return '8:00';
};

const calculateWeeklyHours = (shifts: Array<{ day: number; start?: string; end?: string }>) => {
  // Implement weekly hours calculation
  return '40:00';
};

const calculateMonthlyHours = (shifts: Array<{ day: number; start?: string; end?: string }>) => {
  // Implement monthly hours calculation
  return '160:00';
};