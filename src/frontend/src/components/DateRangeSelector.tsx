import React, { ChangeEvent } from 'react';
import {
    FormControl,
    FormLabel,
    TextField,
    Stack,
    Paper
} from '@mui/material';

interface DateRangeSelectorProps {
    startDate: string;
    setStartDate: (date: string) => void;
    endDate: string;
    setEndDate: (date: string) => void;
}

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
    startDate,
    setStartDate,
    endDate,
    setEndDate
}) => {
    const handleStartDateChange = (e: ChangeEvent<HTMLInputElement>) => {
        setStartDate(e.target.value);
    };

    const handleEndDateChange = (e: ChangeEvent<HTMLInputElement>) => {
        setEndDate(e.target.value);
    };

    return (
        <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Stack direction="row" spacing={2}>
                <FormControl fullWidth>
                    <FormLabel>Start Date</FormLabel>
                    <TextField
                        type="date"
                        value={startDate}
                        onChange={handleStartDateChange}
                        placeholder="Select start date"
                        inputProps={{
                            'aria-label': 'Start Date'
                        }}
                        size="small"
                        fullWidth
                    />
                </FormControl>

                <FormControl fullWidth>
                    <FormLabel>End Date</FormLabel>
                    <TextField
                        type="date"
                        value={endDate}
                        onChange={handleEndDateChange}
                        placeholder="Select end date"
                        inputProps={{
                            'aria-label': 'End Date'
                        }}
                        size="small"
                        fullWidth
                    />
                </FormControl>
            </Stack>
        </Paper>
    );
};

export default DateRangeSelector; 