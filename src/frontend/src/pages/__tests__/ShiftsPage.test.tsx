import { describe, it, expect, mock, beforeEach } from "bun:test";
import { render } from "@/test-utils/test-utils";
import { screen, fireEvent } from "@testing-library/react";
import { ShiftsPage } from "../ShiftsPage";
import {
  getShifts,
  createShift,
  updateShift,
  deleteShift,
  createDefaultShifts,
} from "../../services/api";

// Mock the API functions
const mockShift = {
  id: 1,
  start_time: "08:00",
  end_time: "16:00",
  duration_hours: 8,
  requires_break: true,
  active_days: { "0": true, "1": true, "2": true, "3": true, "4": true },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Mock the API functions using Bun's mock with proper types
const mockGetShifts = mock(() => Promise.resolve([mockShift]));
const mockCreateShift = mock(() => Promise.resolve(mockShift));
const mockUpdateShift = mock(() => Promise.resolve(mockShift));
const mockDeleteShift = mock(() => Promise.resolve());
const mockCreateDefaultShifts = mock(() => Promise.resolve({ count: 5 }));

// Override the imported functions with mocks
Object.assign(globalThis, {
  getShifts: mockGetShifts,
  createShift: mockCreateShift,
  updateShift: mockUpdateShift,
  deleteShift: mockDeleteShift,
  createDefaultShifts: mockCreateDefaultShifts,
});

describe("ShiftsPage", () => {
  test("renders shifts list", async () => {
    mockGetShifts.mockImplementation(() => Promise.resolve([mockShift]));

    render(<ShiftsPage />);

    // Wait for the shift time to appear
    const shiftTime = await screen.findByText("08:00 - 16:00");
    expect(shiftTime).toBeDefined();
  });

  test("can create new shift", async () => {
    render(<ShiftsPage />);

    // Click the "Add Shift" button
    const addButton = screen.getByText(/add shift/i);
    fireEvent.click(addButton);

    // Fill out the form
    const startTimeInput = screen.getByLabelText(/start time/i);
    fireEvent.change(startTimeInput, { target: { value: "09:00" } });

    const endTimeInput = screen.getByLabelText(/end time/i);
    fireEvent.change(endTimeInput, { target: { value: "17:00" } });

    // Submit the form
    const submitButton = screen.getByText(/save/i);
    fireEvent.click(submitButton);

    // Verify the create function was called
    expect(mockCreateShift).toHaveBeenCalled();
  });

  test("can delete shift", async () => {
    mockGetShifts.mockImplementation(() => Promise.resolve([mockShift]));

    render(<ShiftsPage />);

    // Wait for the delete button to appear and click it
    const deleteButton = await screen.findByLabelText(/delete shift/i);
    fireEvent.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByText(/confirm/i);
    fireEvent.click(confirmButton);

    // Verify the delete function was called
    expect(mockDeleteShift).toHaveBeenCalledWith(1);
  });
});
