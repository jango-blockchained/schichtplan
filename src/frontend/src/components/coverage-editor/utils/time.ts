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
    const diffMinutes = endMinutes - startMinutes;
    const diffHours = diffMinutes / 60;

    if (diffHours === Math.floor(diffHours)) {
        return `${diffHours}h`;
    } else {
        const hours = Math.floor(diffHours);
        const minutes = diffMinutes % 60;
        if (minutes === 0) {
            return `${hours}h`;
        } else if (hours === 0) {
            return `${minutes}m`;
        } else {
            return `${hours}h ${minutes}m`;
        }
    }
}; 