import { useQuery } from "@tanstack/react-query";
import { getSettings } from "@/services/api";
import { useMemo } from 'react';
import type { Settings, EmployeeTypeSetting } from '@/types/index';

export interface EmployeeGroup {
  id: string; // Matches backend's EmployeeGroup enum values: VZ, TZ, GFB, TL
  name: string;
  description?: string;
  minHours: number;
  maxHours: number;
  isFullTime: boolean;
}

export const useEmployeeGroups = () => {
  const { data: settings, isLoading: isLoadingSettings } = useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const employeeGroups: EmployeeGroup[] = useMemo(() => {
    if (isLoadingSettings || !settings?.employee_types) {
      return [];
    }
    
    return settings.employee_types.map((type: EmployeeTypeSetting) => ({
      id: type.id,
      name: type.name,
      minHours: type.min_hours ?? 0,
      maxHours: type.max_hours ?? 40,
      isFullTime: (type.min_hours ?? 0) >= 35,
    }));
  }, [settings, isLoadingSettings]);

  const getGroup = (id: string) => {
    return employeeGroups.find((group) => group.id === id);
  };

  const getHoursRange = (id: string): [number, number] => {
    const group = getGroup(id);
    return group ? [group.minHours, group.maxHours] : [0, 0];
  };

  return {
    employeeGroups,
    isLoading: isLoadingSettings,
    getGroup,
    getHoursRange,
  };
};
