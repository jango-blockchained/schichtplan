import type { Settings } from "@/types";
import { getWeekStartsOn } from "@/utils/weekStart";
import { format, startOfWeek } from "date-fns";

function buildSettings(weekStart: "MONDAY" | "SUNDAY"): Settings {
  return {
    id: 1,
    general: {
      store_name: null,
      store_address: null,
      store_phone: null,
      store_email: null,
      timezone: null,
      language: null,
      date_format: null,
      time_format: null,
      store_opening: null,
      store_closing: null,
      keyholder_before_minutes: null,
      keyholder_after_minutes: null,
      opening_days: null,
      special_days: null,
    },
    scheduling: {
      scheduling_resource_type: null,
      default_shift_duration: null,
      min_break_duration: null,
      max_daily_hours: null,
      max_weekly_hours: null,
      min_rest_between_shifts: null,
      scheduling_period_weeks: null,
      auto_schedule_preferences: null,
      generation_requirements: null,
    },
    display: {
      theme: null,
      primary_color: null,
      secondary_color: null,
      accent_color: null,
      background_color: null,
      surface_color: null,
      text_color: null,
      show_sunday: null,
      show_weekdays: null,
      start_of_week: null,
      calendar_start_day: null,
      calendar_default_view: null,
      email_notifications: null,
      schedule_published_notify: null,
      shift_changes_notify: null,
      time_off_requests_notify: null,
    },
    pdf_layout: null,
    employee_groups: null,
    availability_types: null,
    actions: null,
    ai_scheduling: null,
    week_navigation: {
      week_weekend_start: weekStart,
      week_month_boundary_mode: "keep_intact",
    },
  };
}

describe("getWeekStartsOn", () => {
  test("returns 1 for Monday", () => {
    expect(getWeekStartsOn(buildSettings("MONDAY"))).toBe(1);
  });
  test("returns 0 for Sunday", () => {
    expect(getWeekStartsOn(buildSettings("SUNDAY"))).toBe(0);
  });
});

describe("week boundary calculation integration", () => {
  test("startOfWeek respects Monday", () => {
    const d = new Date("2025-08-20"); // Wednesday
    const ws = getWeekStartsOn(buildSettings("MONDAY"));
    const start = startOfWeek(d, { weekStartsOn: ws });
    expect(format(start, "yyyy-MM-dd")).toBe("2025-08-18"); // Monday
  });
  test("startOfWeek respects Sunday", () => {
    const d = new Date("2025-08-20"); // Wednesday
    const ws = getWeekStartsOn(buildSettings("SUNDAY"));
    const start = startOfWeek(d, { weekStartsOn: ws });
    expect(format(start, "yyyy-MM-dd")).toBe("2025-08-17"); // Sunday
  });
});
