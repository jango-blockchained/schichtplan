export const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

export const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

export const snapToQuarterHour = (timeStr: string): string => {
    const totalMinutes = timeToMinutes(timeStr);
    const roundedMinutes = Math.round(totalMinutes / 15) * 15;
    return minutesToTime(roundedMinutes);
};

export const formatDuration = (startTime: string, endTime: string): string => {
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    const diffHours = (endMinutes - startMinutes) / 60;
    return diffHours === Math.floor(diffHours) ? `${diffHours}h` : `${diffHours.toFixed(1)}h`;
}; 