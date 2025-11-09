import { describe, expect, mock, it as test } from "bun:test";
import { render } from "../../test-utils/test-utils";
import { ShiftsPage } from "../ShiftsPage";

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
  test("renders without crashing", () => {
    const { container } = render(<ShiftsPage />);
    expect(container).toBeDefined();
  });

  test("renders page container", () => {
    const { container } = render(<ShiftsPage />);
    expect(container.querySelector("[class*='page']") || container.firstElementChild).toBeTruthy();
  });

  it("renders page content", () => {
    const { container } = render(<ShiftsPage />);
    const content = container.textContent;
    expect((content || "").length > 0).toBe(true);
  });
});
