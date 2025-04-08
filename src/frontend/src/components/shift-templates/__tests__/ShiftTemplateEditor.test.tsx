import { describe, test, expect, mock } from "bun:test";
import { render } from "@/test-utils/test-utils";
import { screen, fireEvent } from "@testing-library/react";
import { ShiftTemplateEditor } from "../components/ShiftTemplateEditor";

const mockShift = {
  id: 1,
  start_time: "08:00",
  end_time: "16:00",
  duration_hours: 8,
  requires_break: true,
  active_days: { "0": true, "1": true, "2": true, "3": true, "4": true },
  shift_type_id: "EARLY",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockSettings = {
  general: {
    store_opening: "08:00",
    store_closing: "20:00",
    opening_days: {
      "0": true,
      "1": true,
      "2": true,
      "3": true,
      "4": true,
      "5": true,
      "6": true,
    },
  },
  shift_types: [
    { id: "EARLY", name: "Früh", color: "#22c55e" },
    { id: "MIDDLE", name: "Mitte", color: "#3b82f6" },
    { id: "LATE", name: "Spät", color: "#f59e0b" },
  ],
};

describe("ShiftTemplateEditor", () => {
  test("renders shift cards correctly", () => {
    const onUpdateShift = mock(() => {});

    render(
      <ShiftTemplateEditor
        shifts={[mockShift]}
        settings={mockSettings as any}
        onUpdateShift={onUpdateShift}
      />,
    );

    // Check that the shift time is displayed
    expect(screen.getByText("08:00 - 16:00")).toBeDefined();

    // Check that the shift ID is displayed
    expect(screen.getByText("Schicht 1")).toBeDefined();
  });

  test("has add shift button", () => {
    const onAddShift = mock(() => {});

    render(
      <ShiftTemplateEditor
        shifts={[]}
        settings={mockSettings as any}
        onAddShift={onAddShift}
      />,
    );

    // Check for Add Shift button
    const addButton = screen.getByText("Add Shift");
    expect(addButton).toBeDefined();

    // Click the button and verify callback
    fireEvent.click(addButton);
    expect(onAddShift).toHaveBeenCalled();
  });
});
