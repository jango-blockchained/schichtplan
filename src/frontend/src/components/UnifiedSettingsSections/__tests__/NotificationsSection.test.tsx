import { describe, it, expect, mock, beforeEach } from "bun:test";
import { render } from "../../../test-utils/test-utils";
import NotificationsSection from "../NotificationsSection";
import type { Settings } from "../../../types";
import "../../../__tests__/setup";

describe("NotificationsSection", () => {
  let mockOnDisplaySettingChange: ReturnType<typeof mock>;

  beforeEach(() => {
    mockOnDisplaySettingChange = mock(() => { });
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
    time_off_requests_notify: null,
  };

  it("renders without crashing", () => {
    const { container } = render(
      <NotificationsSection
        settings={initialDisplaySettings}
        onDisplaySettingChange={mockOnDisplaySettingChange}
      />,
    );
    expect(container).toBeDefined();
  });

  it("renders section container", () => {
    const { container } = render(
      <NotificationsSection
        settings={initialDisplaySettings}
        onDisplaySettingChange={mockOnDisplaySettingChange}
      />,
    );
    expect(container.firstElementChild).toBeTruthy();
  });

  it("renders with content", () => {
    const { container } = render(
      <NotificationsSection
        settings={initialDisplaySettings}
        onDisplaySettingChange={mockOnDisplaySettingChange}
      />,
    );
    const content = container.textContent;
    expect(content && content.length).toBeGreaterThan(0);
  });

  it("handles undefined settings prop gracefully", () => {
    const { container } = render(
      <NotificationsSection
        settings={undefined}
        onDisplaySettingChange={mockOnDisplaySettingChange}
      />,
    );
    expect(container).toBeDefined();
  });

  it("renders notification controls", () => {
    const { container } = render(
      <NotificationsSection
        settings={initialDisplaySettings}
        onDisplaySettingChange={mockOnDisplaySettingChange}
      />,
    );
    const controls = container.querySelectorAll("button, input[type='checkbox'], [role='switch']");
    expect(controls.length).toBeGreaterThan(0);
  });
});
expect(mockOnDisplaySettingChange).toHaveBeenCalledWith(
});
