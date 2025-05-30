import { describe, it, expect, mock, beforeEach } from "bun:test";
import { render, screen, fireEvent } from "../../../test-utils/test-utils"; 
import NotificationsSection from "../NotificationsSection";
import type { Settings } from "../../../types"; 

describe("NotificationsSection", () => {
  let mockOnDisplaySettingChange: ReturnType<typeof mock>; // Simpler type for the mock object

  beforeEach(() => {
    // Create a new mock for each test to ensure isolation
    mockOnDisplaySettingChange = mock(() => {}); // Simplest mock returning undefined
  });

  const initialDisplaySettings: Settings["display"] = {
    theme: "light",
    primary_color: "#000000",
    secondary_color: "#000000",
    accent_color: "#000000",
    background_color: "#ffffff",
    surface_color: "#ffffff",
    text_color: "#000000",
    dark_theme: null,
    show_sunday: false,
    show_weekdays: true,
    start_of_week: 1,
    calendar_start_day: "monday",
    calendar_default_view: "month",
    email_notifications: true,
    schedule_published_notify: false,
    shift_changes_notify: true,
    time_off_requests_notify: null, // Test null case
  };

  it("renders correctly with provided settings", () => {
    render(
      <NotificationsSection
        settings={initialDisplaySettings}
        onDisplaySettingChange={mockOnDisplaySettingChange}
      />
    );

    expect(screen.getByText("Email Notifications")).toBeDefined();
    expect(screen.getByText("Schedule Published")).toBeDefined();
    expect(screen.getByText("Shift Changes")).toBeDefined();
    expect(screen.getByText("Time Off Requests")).toBeDefined();

    // Check switch states based on initialDisplaySettings
    // For Switch, role is 'switch'. The label is associated via htmlFor.
    const emailSwitch = screen.getByLabelText("Email Notifications");
    expect(emailSwitch.getAttribute("aria-checked")).toBe("true");
    
    const schedulePublishedSwitch = screen.getByLabelText("Schedule Published");
    expect(schedulePublishedSwitch.getAttribute("aria-checked")).toBe("false");

    const shiftChangesSwitch = screen.getByLabelText("Shift Changes");
    expect(shiftChangesSwitch.getAttribute("aria-checked")).toBe("true");

    const timeOffSwitch = screen.getByLabelText("Time Off Requests");
    expect(timeOffSwitch.getAttribute("aria-checked")).toBe("false"); // null ?? false
  });

  it("handles undefined settings prop", () => {
    render(
      <NotificationsSection
        settings={undefined}
        onDisplaySettingChange={mockOnDisplaySettingChange}
      />
    );
    expect(screen.getByText("Loading notification settings...")).toBeDefined();
  });

  it("calls onDisplaySettingChange with correct payload when email_notifications toggled", () => {
    render(
      <NotificationsSection
        settings={{ ...initialDisplaySettings, email_notifications: false }}
        onDisplaySettingChange={mockOnDisplaySettingChange}
      />
    );
    const emailSwitch = screen.getByLabelText("Email Notifications");
    fireEvent.click(emailSwitch);
    expect(mockOnDisplaySettingChange).toHaveBeenCalledWith("email_notifications", true);
  });

  it("calls onDisplaySettingChange for schedule_published_notify", () => {
    render(
      <NotificationsSection
        settings={{ ...initialDisplaySettings, schedule_published_notify: false }}
        onDisplaySettingChange={mockOnDisplaySettingChange}
      />
    );
    const scheduleSwitch = screen.getByLabelText("Schedule Published");
    fireEvent.click(scheduleSwitch);
    expect(mockOnDisplaySettingChange).toHaveBeenCalledWith("schedule_published_notify", true);
  });

  it("calls onDisplaySettingChange for shift_changes_notify", () => {
    render(
      <NotificationsSection
        settings={{ ...initialDisplaySettings, shift_changes_notify: false }}
        onDisplaySettingChange={mockOnDisplaySettingChange}
      />
    );
    const shiftSwitch = screen.getByLabelText("Shift Changes");
    fireEvent.click(shiftSwitch);
    expect(mockOnDisplaySettingChange).toHaveBeenCalledWith("shift_changes_notify", true);
  });

  it("calls onDisplaySettingChange for time_off_requests_notify", () => {
    render(
      <NotificationsSection
        settings={{ ...initialDisplaySettings, time_off_requests_notify: false }}
        onDisplaySettingChange={mockOnDisplaySettingChange}
      />
    );
    const timeOffSwitch = screen.getByLabelText("Time Off Requests");
    fireEvent.click(timeOffSwitch);
    expect(mockOnDisplaySettingChange).toHaveBeenCalledWith("time_off_requests_notify", true);
  });
});
