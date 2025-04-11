import { describe, test, expect, spyOn } from 'bun:test';
import { render, screen, waitFor } from '@/test-utils/test-utils';
import { ShiftsPage } from '../ShiftsPage';
import * as api from '@/services/api';

// Mock data
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

const mockSettings = {
  general: {
    store_opening: "08:00",
    store_closing: "20:00",
    opening_days: [1, 2, 3, 4, 5],
  },
  shift_types: [
    { id: "EARLY", name: "Früh" }
  ]
};

describe("ShiftsPage", () => {
  test("renders shifts page and loads data", async () => {
    // Mock API calls
    spyOn(api, 'getShifts').mockResolvedValue([mockShift]);
    spyOn(api, 'getSettings').mockResolvedValue(mockSettings);

    render(<ShiftsPage />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText("Schichten")).toBeDefined();
    });

    // Verify shift data is displayed
    expect(screen.getByText("08:00")).toBeDefined();
    expect(screen.getByText("16:00")).toBeDefined();
  });
});
