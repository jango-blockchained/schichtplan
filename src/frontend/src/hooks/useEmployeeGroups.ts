import { useQuery } from "@tanstack/react-query";
import { getSettings } from "@/services/api";

export interface EmployeeGroup {
  id: string; // Matches backend's EmployeeGroup enum values: VZ, TZ, GFB, TL
  name: string;
  description?: string;
  minHours: number;
  maxHours: number;
  isFullTime: boolean;
}

export const useEmployeeGroups = () => {
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const employeeGroups: EmployeeGroup[] =
    settings?.employee_groups.employee_types.map((type) => ({
      id: type.id,
      name: type.name,
      minHours: type.min_hours,
      maxHours: type.max_hours,
      isFullTime: type.min_hours >= 35, // Consider full time if min hours is 35 or more
    })) ?? [];

  const getGroup = (id: string) => {
    return employeeGroups.find((group) => group.id === id);
  };

  const getHoursRange = (id: string): [number, number] => {
    const group = getGroup(id);
    return group ? [group.minHours, group.maxHours] : [0, 0];
  };

  return {
    employeeGroups,
    getGroup,
    getHoursRange,
  };
};
