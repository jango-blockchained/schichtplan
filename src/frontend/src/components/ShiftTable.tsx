import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  padding: '4px 8px',
  fontSize: '0.875rem',
  border: '1px solid rgba(224, 224, 224, 1)',
  '&.header': {
    backgroundColor: theme.palette.grey[100],
    fontWeight: 'bold',
  },
}));

const StyledTableRow = styled(TableRow)({
  '&:nth-of-type(odd)': {
    backgroundColor: '#fff',
  },
  '&:nth-of-type(even)': {
    backgroundColor: '#fafafa',
  },
});

const SubRow = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  borderTop: '1px solid rgba(224, 224, 224, 0.5)',
  '&:first-of-type': {
    borderTop: 'none',
  },
});

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

export const ShiftTable = ({ weekStart, weekEnd, employees }: ShiftTableProps) => {
  const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

  return (
    <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={{ minWidth: 1000 }}>
        <TableHead>
          <TableRow>
            <StyledTableCell className="header" sx={{ minWidth: 150 }}>Name, Vorname</StyledTableCell>
            <StyledTableCell className="header" sx={{ width: 80 }}>Position</StyledTableCell>
            <StyledTableCell className="header" sx={{ width: 80 }}>Plan / Woche</StyledTableCell>
            {days.map((day) => (
              <StyledTableCell key={day} className="header" sx={{ minWidth: 100 }}>
                {day}
              </StyledTableCell>
            ))}
            <StyledTableCell className="header" sx={{ width: 80 }}>Summe / Woche</StyledTableCell>
            <StyledTableCell className="header" sx={{ width: 80 }}>Summe / Monat</StyledTableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {employees.map((employee, index) => (
            <StyledTableRow key={employee.name}>
              <StyledTableCell>
                <Typography variant="body2">{employee.name}</Typography>
              </StyledTableCell>
              <StyledTableCell>{employee.position}</StyledTableCell>
              <StyledTableCell>{employee.contractedHours}</StyledTableCell>
              {days.map((_, dayIndex) => {
                const shift = employee.shifts.find((s) => s.day === dayIndex);
                return (
                  <StyledTableCell key={dayIndex}>
                    <SubRow>Beginn: {shift?.start || ''}</SubRow>
                    {shift?.break && (
                      <>
                        <SubRow>Pause: {shift.break.start}</SubRow>
                        <SubRow>Ende: {shift.break.end}</SubRow>
                      </>
                    )}
                    <SubRow>Ende: {shift?.end || ''}</SubRow>
                    <SubRow>Summe / Tag: {shift ? calculateHours(shift) : ''}</SubRow>
                  </StyledTableCell>
                );
              })}
              <StyledTableCell>{calculateWeeklyHours(employee.shifts)}</StyledTableCell>
              <StyledTableCell>{calculateMonthlyHours(employee.shifts)}</StyledTableCell>
            </StyledTableRow>
          ))}
        </TableBody>
      </Table>
      <Typography variant="caption" sx={{ mt: 2, display: 'block', padding: 1 }}>
        h : 60 Minuten
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', padding: 1 }}>
        Anwesenheiten: Arbeitszeitbeginn bis Arbeitszeitende inkl. Pausenzeiten und die Tagesstunden eintragen.
        Am Ende der Woche: wöchentliche und monatliche Summe eintragen.
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', padding: 1 }}>
        Abwesenheiten: Feiertag, Krankheit (AU-Bescheinigung), Freizeit, Schule (Führungsnachweis), Urlaub
      </Typography>
    </TableContainer>
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