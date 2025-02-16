import * as React from 'react';
import { Box, Paper, Typography, Grid, ToggleButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import { TimeSlot } from '../types';

const DAYS = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA'] as const;
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8:00 - 21:00

const StyledToggleButton = styled(ToggleButton)(({ theme }) => ({
  width: '100%',
  height: '40px',
  padding: 0,
  border: `1px solid ${theme.palette.divider}`,
  '&.Mui-selected': {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
  },
}));

interface Props {
  availability: TimeSlot[];
  onChange: (newAvailability: TimeSlot[]) => void;
}

export const AvailabilityCalendar: React.FC<Props> = ({ availability, onChange }: Props) => {
  const handleToggle = (day: string, hour: number) => {
    const existingSlot = availability.find(
      (slot: TimeSlot) => slot.day === day && slot.hour === hour
    );

    if (existingSlot) {
      const newAvailability = availability.map((slot: TimeSlot) =>
        slot.day === day && slot.hour === hour
          ? { ...slot, available: !slot.available }
          : slot
      );
      onChange(newAvailability);
    } else {
      onChange([...availability, { day: day as TimeSlot['day'], hour, available: true }]);
    }
  };

  const isAvailable = (day: string, hour: number) => {
    return availability.some(
      (slot: TimeSlot) => slot.day === day && slot.hour === hour && slot.available
    );
  };

  return (
    <Paper elevation={0} sx={{ p: 2, width: '100%' }}>
      <Typography variant="h6" gutterBottom>
        Verfügbarkeit
      </Typography>
      <Box sx={{ width: '100%', overflowX: 'auto' }}>
        <Grid container spacing={1}>
          <Grid item xs={1}>
            <Box sx={{ height: 40 }} /> {/* Spacer for hours column */}
          </Grid>
          {DAYS.map((day) => (
            <Grid item xs={2} key={day}>
              <Typography align="center" sx={{ fontWeight: 'bold' }}>
                {day}
              </Typography>
            </Grid>
          ))}
          {HOURS.map((hour) => (
            <React.Fragment key={hour}>
              <Grid item xs={1}>
                <Typography align="right" sx={{ lineHeight: '40px' }}>
                  {`${hour}:00`}
                </Typography>
              </Grid>
              {DAYS.map((day) => (
                <Grid item xs={2} key={`${day}-${hour}`}>
                  <StyledToggleButton
                    value={`${day}-${hour}`}
                    selected={isAvailable(day, hour)}
                    onChange={() => handleToggle(day, hour)}
                    sx={{ minWidth: 0 }}
                  >
                    {isAvailable(day, hour) ? '✓' : ''}
                  </StyledToggleButton>
                </Grid>
              ))}
            </React.Fragment>
          ))}
        </Grid>
      </Box>
    </Paper>
  );
}; 