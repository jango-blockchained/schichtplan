import { describe, it, expect, mock, beforeEach } from "bun:test";
import { render } from "@/test-utils/test-utils";
import { screen } from "@testing-library/react";
import { ShiftTable } from "../ShiftTable";
import { WeeklySchedule } from "@/types";

// Mock data matching the WeeklySchedule structure
const mockWeekData: WeeklySchedule[] = [
  {
    employee_id: 1,
    name: "Alice",
    position: "Cashier",
    contracted_hours: 40,
    shifts: [
      {
        day: 1,
        start_time: "09:00",
        end_time: "17:00",
        break: { start: "12:00", end: "12:30", notes: "Lunch" },
      },
      {
        day: 2,
        start_time: "09:00",
        end_time: "17:00",
        break: { start: "12:00", end: "12:30", notes: "Lunch" },
      },
    ],
  },
  {
    employee_id: 2,
    name: "Bob",
    position: "Stocker",
    contracted_hours: 30,
    shifts: [
      {
        day: 3,
        start_time: "10:00",
        end_time: "18:00",
        break: { start: "13:00", end: "13:30", notes: "Lunch" },
      },
    ],
  },
];

describe("ShiftTable", () => {
  it("renders shift data correctly", () => {
    render(
      <ShiftTable
        weekStart={new Date("2023-01-01")}
        weekEnd={new Date("2023-01-07")}
        data={mockWeekData}
        isLoading={false}
        error={null}
      />,
    );

    // Check that the employee name is displayed
    expect(screen.getByText("Test Employee")).toBeDefined();

    // Check that the shift time is displayed
    expect(screen.getByText("09:00 - 17:00")).toBeDefined();
  });

  it("shows loading state", () => {
    render(
      <ShiftTable
        weekStart={new Date("2023-01-01")}
        weekEnd={new Date("2023-01-07")}
        data={[]}
        isLoading={true}
        error={null}
      />,
    );

    // Check for loading indicator
    const loadingElements = screen.getAllByRole("status");
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it("shows error state", () => {
    render(
      <ShiftTable
        weekStart={new Date("2023-01-01")}
        weekEnd={new Date("2023-01-07")}
        data={[]}
        isLoading={false}
        error="Failed to load schedule data"
      />,
    );

    // Check for error message
    expect(screen.getByText("Failed to load schedule data")).toBeDefined();
  });
});
