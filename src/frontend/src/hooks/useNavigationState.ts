import { addDays, differenceInCalendarWeeks, endOfWeek, format, startOfWeek } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";

export interface NavigationState {
  // State
  useWeekBasedNavigation: boolean;
  dateRange: DateRange | undefined;
  weekAmount: number;
  selectedVersion: number | undefined;
  
  // Actions
  setUseWeekBasedNavigation: (value: boolean) => void;
  setDateRange: (range: DateRange | undefined) => void;
  setWeekAmount: (amount: number) => void;
  setSelectedVersion: (version: number | undefined) => void;
  
  // Handlers
  handleWeekChange: (direction: 'next' | 'prev') => void;
  handleDurationChange: (newDuration: number) => void;
  handleDateRangeChange: (range: DateRange | undefined) => void;
  
  // Computed values
  isValidDateRange: boolean;
  formattedDateRange: string;
}

interface UseNavigationStateOptions {
  initialWeekAmount?: number;
  initialUseWeekBased?: boolean;
  onDateRangeChange?: (range: DateRange | undefined) => void;
  onVersionChange?: (version: number | undefined) => void;
}

export function useNavigationState(options: UseNavigationStateOptions = {}): NavigationState {
  const {
    initialWeekAmount = 1,
    initialUseWeekBased = false,
    onDateRangeChange,
    onVersionChange,
  } = options;

  // Initialize today once to avoid re-renders
  const today = useMemo(() => new Date(), []);

  // State management
  const [useWeekBasedNavigation, setUseWeekBasedNavigation] = useState<boolean>(initialUseWeekBased);
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const initialToday = new Date();
    return {
      from: startOfWeek(initialToday, { weekStartsOn: 1 }),
      to: endOfWeek(initialToday, { weekStartsOn: 1 }),
    };
  });
  
  const [weekAmount, setWeekAmount] = useState<number>(initialWeekAmount);
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(undefined);

  // Computed values
  const isValidDateRange = useMemo(() => {
    return !!(dateRange?.from && dateRange?.to);
  }, [dateRange]);

  const formattedDateRange = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return "";
    return `${format(dateRange.from, "dd.MM.yyyy")} - ${format(dateRange.to, "dd.MM.yyyy")}`;
  }, [dateRange]);

  // Event handlers
  const handleWeekChange = useCallback((direction: 'next' | 'prev') => {
    if (!dateRange?.from) return;
    
    const weekOffset = direction === 'next' ? 7 : -7;
    const newFrom = addDays(dateRange.from, weekOffset);
    const newTo = addDays(newFrom, (weekAmount * 7) - 1);
    
    const newRange = { from: newFrom, to: newTo };
    setDateRange(newRange);
    onDateRangeChange?.(newRange);
  }, [dateRange, weekAmount, onDateRangeChange]);

  const handleDurationChange = useCallback((newDuration: number) => {
    setWeekAmount(newDuration);
    
    if (dateRange?.from) {
      const newTo = addDays(dateRange.from, (newDuration * 7) - 1);
      const newRange = { from: dateRange.from, to: newTo };
      setDateRange(newRange);
      onDateRangeChange?.(newRange);
    }
  }, [dateRange, onDateRangeChange]);

  const handleDateRangeChange = useCallback((range: DateRange | undefined) => {
    setDateRange(range);
    
    // Auto-calculate week amount based on date range
    if (range?.from && range?.to) {
      const calculatedWeeks = differenceInCalendarWeeks(range.to, range.from, { weekStartsOn: 1 }) + 1;
      if (calculatedWeeks > 0 && calculatedWeeks !== weekAmount) {
        setWeekAmount(calculatedWeeks);
      }
    }
    
    onDateRangeChange?.(range);
  }, [weekAmount, onDateRangeChange]);

  // Enhanced version setter with callback
  const handleVersionChange = useCallback((version: number | undefined) => {
    setSelectedVersion(version);
    onVersionChange?.(version);
  }, [onVersionChange]);

  // Effect to ensure date range is initialized
  useEffect(() => {
    if (!dateRange || !dateRange.from || !dateRange.to) {
      const from = startOfWeek(today, { weekStartsOn: 1 });
      from.setHours(0, 0, 0, 0);
      const to = addDays(from, (weekAmount * 7) - 1);
      to.setHours(23, 59, 59, 999);
      
      const newRange = { from, to };
      setDateRange(newRange);
      onDateRangeChange?.(newRange);
    }
  }, [weekAmount, today, dateRange, onDateRangeChange]);

  return {
    // State
    useWeekBasedNavigation,
    dateRange,
    weekAmount,
    selectedVersion,
    
    // Setters
    setUseWeekBasedNavigation,
    setDateRange,
    setWeekAmount,
    setSelectedVersion: handleVersionChange,
    
    // Handlers
    handleWeekChange,
    handleDurationChange,
    handleDateRangeChange,
    
    // Computed
    isValidDateRange,
    formattedDateRange,
  };
}
