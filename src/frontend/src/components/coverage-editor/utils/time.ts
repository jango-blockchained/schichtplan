export const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
};

export const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
};

export const snapToQuarterHour = (timeStr: string): string => {
  const totalMinutes = timeToMinutes(timeStr);
  const roundedMinutes = Math.round(totalMinutes / 15) * 15;
  return minutesToTime(roundedMinutes);
};

export const formatDuration = (startTime: string, endTime: string): string => {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const diffMinutes = Math.round((endMinutes - startMinutes) / 15) * 15;
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

export const normalizeTime = (timeStr: string): string => {
  return minutesToTime(timeToMinutes(timeStr));
};

export const isValidTimeFormat = (timeStr: string): boolean => {
  return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr);
};

export const calculateGridPosition = (
  time: string,
  gridStartTime: string,
  totalMinutes: number,
  gridWidth: number,
): number => {
  const timeMinutes = timeToMinutes(time);
  const startMinutes = timeToMinutes(gridStartTime);
  const position = ((timeMinutes - startMinutes) / totalMinutes) * gridWidth;
  return Math.round(position);
};
