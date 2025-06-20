import axios from "axios";
import { useEffect, useState } from "react";
import type { Settings } from "../types/index";

// Default settings object to use as fallback
export const DEFAULT_SETTINGS: Settings = {
  id: 0,
  general: {
    store_name: "TEDi Filiale #6729",
    store_address: null,
    store_phone: null,
    store_email: null,
    timezone: "Europe/Berlin",
    language: "de",
    date_format: "DD.MM.YYYY",
    time_format: "24h",
    store_opening: "09:00",
    store_closing: "20:00",
    keyholder_before_minutes: 5,
    keyholder_after_minutes: 10,
    opening_days: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: false
    },
    special_days: {},
  },
  availability_types: { 
    types: [
      {
        id: "UNAVAILABLE",
        name: "Unavailable",
        description: "Employee is not available for this shift",
        color: "#FF5252",
        priority: 4,
        is_available: false,
        type: "availability_type" as const,
      },
      {
        id: "AVAILABLE",
        name: "Available",
        description: "Employee is available for this shift",
        color: "#4CAF50",
        priority: 2,
        is_available: true,
        type: "availability_type" as const,
      },
      {
        id: "PREFERRED",
        name: "Preferred",
        description: "Employee prefers to work this shift",
        color: "#2196F3",
        priority: 3,
        is_available: true,
        type: "availability_type" as const,
      },
      {
        id: "FIXED",
        name: "Fixed",
        description: "Employee must work this shift",
        color: "#FFC107",
        priority: 1,
        is_available: true,
        type: "availability_type" as const,
      }
    ] 
  },
  scheduling: {
    scheduling_resource_type: "shifts",
    default_shift_duration: 8,
    min_break_duration: 30,
    max_daily_hours: 10,
    max_weekly_hours: 40,
    min_rest_between_shifts: 11,
    scheduling_period_weeks: 1,
    auto_schedule_preferences: true,
    enable_diagnostics: false,
    generation_requirements: {
      enforce_minimum_coverage: true,
      enforce_contracted_hours: true,
      enforce_keyholder_coverage: true,
      enforce_rest_periods: true,
      enforce_early_late_rules: true,
      enforce_employee_group_rules: true,
      enforce_break_rules: true,
      enforce_max_hours: true,
      enforce_consecutive_days: true,
      enforce_weekend_distribution: true,
      enforce_shift_distribution: true,
      enforce_availability: true,
      enforce_qualifications: true,
      enforce_opening_hours: true,
    },
    scheduling_algorithm: "standard",
  },
  display: {
    theme: "light",
    primary_color: "#000000",
    secondary_color: "#000000",
    accent_color: "#000000",
    background_color: "#ffffff",
    surface_color: "#ffffff",
    text_color: "#000000",
    dark_theme: {
      primary_color: "#ffffff",
      secondary_color: "#ffffff",
      accent_color: "#ffffff",
      background_color: "#000000",
      surface_color: "#000000",
      text_color: "#ffffff",
    },
    show_sunday: false,
    show_weekdays: true,
    start_of_week: 1,
    calendar_start_day: "monday",
    calendar_default_view: "month",
    email_notifications: false,
    schedule_published_notify: false,
    shift_changes_notify: false,
    time_off_requests_notify: false,
  },
  pdf_layout: {
    page_size: "A4",
    orientation: "portrait",
    margins: {
      top: 20,
      right: 20,
      bottom: 20,
      left: 20,
    },
    table_style: {
      header_bg_color: "#f5f5f5",
      border_color: "#e0e0e0",
      text_color: "#000000",
      header_text_color: "#000000",
    },
    fonts: {
      family: "Arial",
      size: 12,
      header_size: 14,
    },
    content: {
      show_employee_id: true,
      show_position: true,
      show_breaks: true,
      show_total_hours: true,
    },
  },
  employee_groups: {
    employee_types: [
      { id: "VZ", name: "Vollzeit", min_hours: 35, max_hours: 40, type: "employee_type" as const },
      { id: "TZ", name: "Teilzeit", min_hours: 20, max_hours: 30, type: "employee_type" as const },
      { id: "GFB", name: "Geringfügig", min_hours: 10, max_hours: 15, type: "employee_type" as const },
    ],
    shift_types: [
      { id: "EARLY", name: "Frühschicht", color: "#4CAF50", type: "shift_type" as const, autoAssignOnly: false },
      { id: "MID", name: "Mittelschicht", color: "#2196F3", type: "shift_type" as const, autoAssignOnly: false },
      { id: "LATE", name: "Spätschicht", color: "#FFC107", type: "shift_type" as const, autoAssignOnly: false },
      { id: "NO_WORK", name: "Kein Dienst", color: "#9E9E9E", type: "shift_type" as const, autoAssignOnly: true },
      { id: "UNAVAILABLE", name: "Nicht verfügbar", color: "#ef4444", type: "shift_type" as const, autoAssignOnly: true },
    ],
    absence_types: [
      { id: "URL", name: "Urlaub", color: "#FF9800", type: "absence_type" as const },
      { id: "KRK", name: "Krank", color: "#F44336", type: "absence_type" as const },
      { id: "SCH", name: "Schule", color: "#00BCD4", type: "absence_type" as const },
    ],
  },
  actions: {
    demo_data: {
      selected_module: "",
      last_execution: null,
    },
  },
  ai_scheduling: {
    enabled: false,
    api_key: "",
  },
  week_navigation: {
    enable_week_navigation: false,
    week_weekend_start: "MONDAY",
    week_month_boundary_mode: "keep_intact",
    week_navigation_default: false,
  },
};

// Add this mapping
const NUM_KEY_TO_DAY_NAME: { [key: string]: string } = {
  "0": "monday",
  "1": "tuesday",
  "2": "wednesday",
  "3": "thursday",
  "4": "friday",
  "5": "saturday",
  "6": "sunday",
};

// Add the reverse mapping
const DAY_NAME_TO_NUM_KEY: { [key: string]: string } = {
  "monday": "0",
  "tuesday": "1", 
  "wednesday": "2", 
  "thursday": "3",
  "friday": "4", 
  "saturday": "5", 
  "sunday": "6"
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get<Settings>("/api/v2/settings");
      
      // Transform numeric opening_days keys to day names if needed
      const data = response.data;
      if (data.general && data.general.opening_days) {
        const currentOpeningDays = data.general.opening_days as Record<string, boolean>;
        const transformedOpeningDays: Record<string, boolean> = {};
        
        // Check if we need to transform
        let needsTransformation = false;
        for (const key in currentOpeningDays) {
          if (Object.prototype.hasOwnProperty.call(currentOpeningDays, key)) {
            if (NUM_KEY_TO_DAY_NAME.hasOwnProperty(key)) {
              needsTransformation = true;
              break;
            }
          }
        }
        
        if (needsTransformation) {
          for (const key in currentOpeningDays) {
            if (Object.prototype.hasOwnProperty.call(currentOpeningDays, key)) {
              const dayValue = currentOpeningDays[key];
              if (NUM_KEY_TO_DAY_NAME.hasOwnProperty(key)) {
                transformedOpeningDays[NUM_KEY_TO_DAY_NAME[key]] = dayValue;
              } else {
                transformedOpeningDays[key] = dayValue;
              }
            }
          }
          data.general.opening_days = transformedOpeningDays;
        }
      }
      
      setSettings(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch settings"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const formatSettingsUpdate = (currentFullSettings: Settings, changes: Partial<Settings>) => {
    const payload = JSON.parse(JSON.stringify(currentFullSettings));

    (Object.keys(changes) as Array<keyof Settings>).forEach(categoryKey => {
      if (changes[categoryKey] && typeof changes[categoryKey] === 'object') {
        if (payload[categoryKey] && typeof payload[categoryKey] === 'object') {
          payload[categoryKey] = { ...payload[categoryKey], ...changes[categoryKey] };
        } else {
          payload[categoryKey] = changes[categoryKey];
        }
      } else if (changes[categoryKey] !== undefined) {
        payload[categoryKey] = changes[categoryKey];
      }
    });

    // Transform day-name keys back to numeric keys for the backend
    if (payload.general && payload.general.opening_days && typeof payload.general.opening_days === 'object') {
      const currentOpeningDays = payload.general.opening_days as Record<string, boolean>;
      
      // First check if we need to transform
      let needsTransformation = false;
      for (const key in currentOpeningDays) {
        if (Object.prototype.hasOwnProperty.call(currentOpeningDays, key)) {
          if (DAY_NAME_TO_NUM_KEY.hasOwnProperty(key)) {
            needsTransformation = true;
            break;
          }
        }
      }

      if (needsTransformation) {
        const transformedOpeningDays: Record<string, boolean> = {};
        for (const key in currentOpeningDays) {
          if (Object.prototype.hasOwnProperty.call(currentOpeningDays, key)) {
            const dayValue = currentOpeningDays[key];
            if (DAY_NAME_TO_NUM_KEY.hasOwnProperty(key)) {
              transformedOpeningDays[DAY_NAME_TO_NUM_KEY[key]] = dayValue;
            } else {
              transformedOpeningDays[key] = dayValue;
            }
          }
        }
        // Update the payload with the transformed opening_days
        payload.general.opening_days = transformedOpeningDays;
      }
    }

    // Ensure scheduling_algorithm is always valid before sending to backend
    if (payload.scheduling) {
      if (
        !payload.scheduling.scheduling_algorithm ||
        payload.scheduling.scheduling_algorithm === "default"
      ) {
        payload.scheduling.scheduling_algorithm = "standard";
      }
    }
    
    return payload; 
  };

  const updateSettings = async (updatedFields: Partial<Settings>) => {
    if (!settings) {
      setError(new Error("Settings not loaded yet, cannot update."));
      throw new Error("Settings not loaded yet, cannot update.");
    }
    try {
      setIsLoading(true);
      // Merge updatedFields into the current settings to form the complete payload
      const payload = formatSettingsUpdate(settings, updatedFields);
      
      const response = await axios.put<Settings>(
        "/api/v2/settings",
        payload, // Send the merged, complete settings object
      );
      setSettings(response.data); // Backend returns the full updated settings
      setError(null);
      return response.data;
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to update settings"),
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    settings,
    isLoading,
    error,
    updateSettings,
    refetch: fetchSettings,
  };
}
