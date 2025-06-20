import { useScheduleData } from "@/hooks/useScheduleData";
import { useVersionControl } from "@/hooks/useVersionControl";
import { useWeekBasedVersionControl } from "@/hooks/useWeekBasedVersionControl";
import { getEmployees, getWeekVersions } from "@/services/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfWeek, startOfWeek } from "date-fns";
import { useMemo, useState } from "react";
import { DateRange } from "react-day-picker";

export function useScheduleQueries({ settings }) {
  const queryClient = useQueryClient();

  const today = useMemo(() => new Date(), []);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: startOfWeek(today, { weekStartsOn: 1 }),
    to: endOfWeek(today, { weekStartsOn: 1 }),
  }));
  const [weekAmount, setWeekAmount] = useState<number>(1);
  const [includeEmpty, setIncludeEmpty] = useState<boolean>(true);
  const [useWeekBasedNavigation, setUseWeekBasedNavigation] = useState(false);

  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: getEmployees });

  const weekBasedVersionControl = useWeekBasedVersionControl({
    onWeekChanged: () => {},
    onVersionSelected: () => {},
  });

  const currentWeekVersionMeta = useQuery({
    queryKey: ["week-version", weekBasedVersionControl.navigationState.currentWeek],
    queryFn: () => getWeekVersions(weekBasedVersionControl.navigationState.currentWeek).then(versions => versions.length > 0 ? versions[0] : null),
    enabled: useWeekBasedNavigation && !!weekBasedVersionControl.navigationState.currentWeek,
  });

  const versionControl = useVersionControl({
    dateRange,
    initialVersion: undefined,
    onVersionSelected: (version) => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });

  const effectiveSelectedVersion = useWeekBasedNavigation
    ? (currentWeekVersionMeta.data?.version ? parseInt(currentWeekVersionMeta.data.version.toString()) : undefined)
    : versionControl.selectedVersion;

  const scheduleData = useScheduleData(
    dateRange?.from ?? new Date(),
    dateRange?.to ?? new Date(),
    effectiveSelectedVersion,
    includeEmpty,
  );

  const refetchAll = () => {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ["settings"] }),
      queryClient.invalidateQueries({ queryKey: ["employees"] }),
      queryClient.invalidateQueries({ queryKey: ["versions"] }),
      queryClient.invalidateQueries({ queryKey: ["schedules"] }),
      queryClient.invalidateQueries({ queryKey: ["week-version"] }),
    ]);
  };

  return {
    // Data
    employees: employeesQuery.data,
    schedule: scheduleData,
    versions: versionControl,
    weekVersions: currentWeekVersionMeta,

    // State
    navigation: {
      dateRange,
      setDateRange,
      weekAmount,
      setWeekAmount,
      useWeekBasedNavigation,
      setUseWeekBasedNavigation,
      includeEmpty,
      setIncludeEmpty,
    },
    versionControl,
    weekBasedVersionControl,
    effectiveSelectedVersion,

    // Loadings
    isLoading: employeesQuery.isLoading || scheduleData.loading || versionControl.isLoading,

    // Actions
    refetchAll,
  };
}
