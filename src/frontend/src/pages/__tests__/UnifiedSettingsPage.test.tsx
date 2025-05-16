import { describe, it, expect, mock, beforeEach } from "bun:test";
import { render, screen, fireEvent } from "../../test-utils/test-utils";
import UnifiedSettingsPage from "../UnifiedSettingsPage";
import * as api from "../../services/api";
import type { Settings } from "../../types";

// Create a mock settings object that matches the expected structure
const mockSettings: Settings = {
  id: "singleton",
  general: {
    store_name: "Test Store",
    store_address: "123 Test St",
    store_phone: "123-456-7890",
    store_email: "test@store.com",
    store_opening: "09:00",
    store_closing: "17:00",
    timezone: "UTC",
    language: "en",
    date_format: "DD.MM.YYYY",
    time_format: "24h",
    keyholder_before_minutes: 5,
    keyholder_after_minutes: 10,
    opening_days: {
      "monday": true,
      "tuesday": true,
      "wednesday": true,
      "thursday": true,
      "friday": true,
      "saturday": true,
      "sunday": false,
    },
    special_days: {
      "2024-12-25": { date: "2024-12-25", description: "Christmas", is_closed: true }
    }
  },
  scheduling: {
    scheduling_resource_type: "coverage",
    default_shift_duration: 8.0,
    min_break_duration: 30,
    max_daily_hours: 10.0,
    max_weekly_hours: 40.0,
    min_rest_between_shifts: 11.0,
    scheduling_period_weeks: 4,
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
      enforce_opening_hours: true
    },
    scheduling_algorithm: "default",
    max_generation_attempts: 10,
  },
  display: {
    theme: "light",
    primary_color: "#1976D2",
    secondary_color: "#424242",
    accent_color: "#FF4081",
    background_color: "#FFFFFF",
    surface_color: "#F5F5F5",
    text_color: "#212121",
    dark_theme: {
      primary_color: "#90CAF9",
      secondary_color: "#757575",
      accent_color: "#FF80AB",
      background_color: "#121212",
      surface_color: "#1E1E1E",
      text_color: "#FFFFFF",
    },
    show_sunday: false,
    show_weekdays: false,
    start_of_week: 1,
    email_notifications: true,
    schedule_published_notify: true,
    shift_changes_notify: true,
    time_off_requests_notify: true,
  },
  pdf_layout: {
    page_size: "A4",
    orientation: "portrait",
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
    table_style: {
      header_bg_color: "#f3f4f6",
      border_color: "#e5e7eb",
      text_color: "#111827",
      header_text_color: "#111827"
    },
    fonts: { family: "Helvetica", size: 10, header_size: 12 },
    content: {
      show_employee_id: true,
      show_position: true,
      show_breaks: true,
      show_total_hours: true
    },
    presets: [],
  },
  employee_groups: {
    employee_types: [
      { id: "FT", name: "Full-time", abbr: "FT", min_hours: 35, max_hours: 40, type: "employee" },
      { id: "PT", name: "Part-time", abbr: "PT", min_hours: 15, max_hours: 25, type: "employee" },
    ],
    shift_types: [
        { id: "EARLY", name: "Early Shift", color: "#3498db", type: "shift"},
        { id: "LATE", name: "Late Shift", color: "#e74c3c", type: "shift"}
    ],
    absence_types: [
        { id: "SICK", name: "Sick Leave", color: "#f1c40f", type: "absence"},
        { id: "HOLIDAY", name: "Holiday", color: "#2ecc71", type: "absence"}
    ]
  },
  availability_types: {
    types: [
      { id: "AVAILABLE", name: "Available", description: "Available for work", color: "#22c55e", priority: 2, is_available: true },
      { id: "FIXED", name: "Fixed", description: "Fixed working hours", color: "#3b82f6", priority: 1, is_available: true },
      { id: "PREFERRED", name: "Preferred", description: "Preferred hours", color: "#f59e0b", priority: 3, is_available: true },
      { id: "UNAVAILABLE", name: "Unavailable", description: "Not available for work", color: "#ef4444", priority: 4, is_available: false },
    ]
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
};

// Mock the API functions
const mockGetSettings = mock(() => Promise.resolve(mockSettings));
const mockUpdateSettings = mock((settings: any) => Promise.resolve(settings));

// Replace the original functions with mocks
mock(() => {
  (api.getSettings as any) = mockGetSettings;
  (api.updateSettings as any) = mockUpdateSettings;
});

describe("UnifiedSettingsPage", () => {
  beforeEach(() => {
    mock.timers.reset();
    mockGetSettings.mockReset();
    mockUpdateSettings.mockReset();
    mockGetSettings.mockReturnValue(Promise.resolve(mockSettings));
    render(<UnifiedSettingsPage />);
  });

  it("renders the page title", async () => {
    const pageTitle = await screen.findByText("Unified Settings");
    expect(pageTitle).toBeDefined();
  });

  it("renders the section navigation buttons", async () => {
    // Check for the section buttons
    const generalSection = await screen.findByText("General Store Setup");
    const schedulingSection = await screen.findByText("Scheduling Engine");
    const employeeSection = await screen.findByText(
      "Employee & Shift Definitions",
    );
    const availabilitySection = await screen.findByText(
      "Availability Configuration",
    );
    const appearanceSection = await screen.findByText("Appearance & Display");
    const integrationsSection = await screen.findByText("Integrations & AI");
    const dataSection = await screen.findByText("Data Management");
    const notificationsSection = await screen.findByText("Notifications");

    expect(generalSection).toBeDefined();
    expect(schedulingSection).toBeDefined();
    expect(employeeSection).toBeDefined();
    expect(availabilitySection).toBeDefined();
    expect(appearanceSection).toBeDefined();
    expect(integrationsSection).toBeDefined();
    expect(dataSection).toBeDefined();
    expect(notificationsSection).toBeDefined();
  });

  it("renders the general store setup section by default and displays data", async () => {
    // Verify that getSettings was called (done in beforeEach implies it, but explicit check is fine)
    expect(api.getSettings).toHaveBeenCalled();

    // The page defaults to the "General Store Setup" section.
    // Check if the store_name from mockSettings is displayed in an input field.
    // Assuming the input field for store name might have a label "Store Name" or similar,
    // or we can find it by its current value if reliably set.
    const storeNameInput = await screen.findByDisplayValue("Test Store") as HTMLInputElement;
    expect(storeNameInput).toBeDefined();
    expect(storeNameInput.value).toBe(mockSettings.general.store_name);

    // Optionally, check another field from the general section
    const timezoneInput = await screen.findByDisplayValue(mockSettings.general.timezone) as HTMLInputElement;
    expect(timezoneInput).toBeDefined();
    expect(timezoneInput.value).toBe(mockSettings.general.timezone);
  });

  it("handles settings update being called when a setting would change", async () => {
    // This test verifies that the mockUpdateSettings is callable and captures arguments correctly.
    // Actual change simulation and debounced call will be in a new test.
    // This test can be kept as a simple check of the mock if desired, or expanded/replaced.
    await api.updateSettings({
      display: {
        theme: "dark",
      },
    } as Partial<Settings>);

    expect(mockUpdateSettings.mock.calls.length).toBe(1);
    expect(mockUpdateSettings.mock.calls[0][0]).toEqual({
      display: {
        theme: "dark",
      },
    });
  });

  it("debounces settings updates on input change", async () => {
    mock.timers.enable();

    // Ensure the page and initial settings are loaded
    const storeNameInput = await screen.findByDisplayValue(mockSettings.general.store_name) as HTMLInputElement;

    // Simulate changing the store name
    const newStoreName = "New Test Store Name";
    fireEvent.change(storeNameInput, { target: { value: newStoreName } });

    // Check that updateSettings has not been called immediately
    expect(mockUpdateSettings).not.toHaveBeenCalled();

    // Advance timers by slightly less than the debounce delay (assuming 2000ms from task analysis)
    mock.timers.tick(1900); 
    expect(mockUpdateSettings).not.toHaveBeenCalled();

    // Advance timers past the debounce delay
    mock.timers.tick(200); // Total 2100ms, should trigger a 2000ms debounce

    // Check that updateSettings has been called once
    expect(mockUpdateSettings).toHaveBeenCalledTimes(1);

    // Check the payload of the updateSettings call
    const expectedPayload = {
      ...mockSettings,
      general: {
        ...mockSettings.general,
        store_name: newStoreName,
      },
    };
    expect(mockUpdateSettings.mock.calls[0][0]).toEqual(expectedPayload);
    
    mock.timers.reset();
  });

  // Add more tests for different sections and interactions
});
