import { useState, useEffect } from "react";
import type { Settings } from "../types/index";
import axios from "axios";

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
      const response = await axios.get<Settings>("/api/settings");
      setSettings(response.data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch settings"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const formatSettingsUpdate = (newSettings: Partial<Settings>) => {
    const formattedData: Record<string, any> = {};

    // Format general settings
    if (
      Object.keys(newSettings).some((key) =>
        [
          "store_name",
          "store_address",
          "store_contact",
          "timezone",
          "language",
          "date_format",
          "time_format",
          "store_opening",
          "store_closing",
          "keyholder_before_minutes",
          "keyholder_after_minutes",
          "opening_days",
          "special_hours",
        ].includes(key),
      )
    ) {
      formattedData.general = {};
      [
        "store_name",
        "store_address",
        "store_contact",
        "timezone",
        "language",
        "date_format",
        "time_format",
        "store_opening",
        "store_closing",
        "keyholder_before_minutes",
        "keyholder_after_minutes",
        "opening_days",
        "special_hours",
      ].forEach((key) => {
        if (key in newSettings) {
          formattedData.general[key] = newSettings[key as keyof Settings];
        }
      });
    }

    // Format scheduling settings
    if ("scheduling" in newSettings) {
      formattedData.scheduling = newSettings.scheduling;
    }

    // Format display settings
    if ("display" in newSettings) {
      formattedData.display = newSettings.display;
    }

    // Format PDF layout settings
    if ("pdf_layout" in newSettings) {
      formattedData.pdf_layout = newSettings.pdf_layout;
    }

    // Format employee groups settings
    if ("employee_groups" in newSettings) {
      formattedData.employee_groups = newSettings.employee_groups;
    }

    // Format availability types
    if ("availability_types" in newSettings) {
      formattedData.availability_types = newSettings.availability_types;
    }

    // Format actions settings
    if ("actions" in newSettings) {
      formattedData.actions = newSettings.actions;
    }

    return formattedData;
  };

  const updateSettings = async (newSettings: Partial<Settings>) => {
    try {
      setIsLoading(true);
      const formattedData = formatSettingsUpdate(newSettings);
      const response = await axios.put<Settings>(
        "/api/settings",
        formattedData,
      );
      setSettings(response.data);
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
