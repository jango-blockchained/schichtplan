import { describe, test, expect, spyOn } from 'bun:test';
import { render, screen } from '@/test-utils/test-utils';
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

// Mock API functions
const getShiftsSpy = spyOn(api, 'getShifts').mockImplementation(() => Promise.resolve([mockShift]));
const getSettingsSpy = spyOn(api, 'getSettings').mockImplementation(() => Promise.resolve(mockSettings));

describe("ShiftsPage", () => {
  test("renders shifts list", async () => {
    render(<ShiftsPage />);
    expect(screen.getByText(/Schichten/i)).toBeDefined();
    expect(getShiftsSpy).toHaveBeenCalled();
    expect(getSettingsSpy).toHaveBeenCalled();
  });
});
