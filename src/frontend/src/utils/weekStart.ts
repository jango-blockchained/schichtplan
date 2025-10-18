import type { Settings } from "@/types";

type SettingsLike = Pick<Settings, "week_navigation"> | undefined | null;

// Utility to derive weekStartsOn (0=Sunday,1=Monday) from settings
export function getWeekStartsOn(settings?: SettingsLike): 0 | 1 {
  const configured = settings?.week_navigation?.week_weekend_start;
  return configured === "SUNDAY" ? 0 : 1;
}

export function resolveWeekStartsOn(
  override: number | undefined,
  settings?: SettingsLike,
): 0 | 1 {
  if (override === 0 || override === 1) return override as 0 | 1;
  return getWeekStartsOn(settings);
}
