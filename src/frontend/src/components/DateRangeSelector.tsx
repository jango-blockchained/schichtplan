import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";

interface DateRangeSelectorProps {
    startDate: Date | null;
    endDate: Date | null;
    setStartDate: (date: Date | null) => void;
    setEndDate: (date: Date | null) => void;
}

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
    startDate,
    endDate,
    setStartDate,
    setEndDate,
}) => {
    const handleDateRangeChange = (range: DateRange | undefined) => {
        setStartDate(range?.from || null);
        setEndDate(range?.to || null);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Date Range</CardTitle>
            </CardHeader>
            <CardContent>
                <DateRangePicker
                    dateRange={
                        startDate && endDate
                            ? { from: startDate, to: endDate }
                            : undefined
                    }
                    onChange={handleDateRangeChange}
                />
            </CardContent>
        </Card>
    );
};

export default DateRangeSelector; 