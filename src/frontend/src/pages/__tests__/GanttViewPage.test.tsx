import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import GanttViewPage from "../GanttViewPage";
import * as api from "@/services/api";

// Mock the API module
vi.mock("@/services/api", () => ({
  getSchedules: vi.fn(),
  getAbsences: vi.fn(),
  getEmployees: vi.fn(),
  getShifts: vi.fn(),
}));

// Mock frappe-gantt
vi.mock("frappe-gantt", () => ({
  default: vi.fn(() => ({
    change_view_mode: vi.fn(),
  })),
}));

const mockEmployees = [
  {
    id: 1,
    employee_id: "E001",
    first_name: "John",
    last_name: "Doe",
    employee_group: "VZ",
    contracted_hours: 40,
    vacation_per_year: 25,
    is_keyholder: true,
    is_active: true,
    birthday: null,
    email: null,
    phone: null,
    created_at: null,
    updated_at: null,
    max_daily_hours: 8,
    max_weekly_hours: 40,
  },
];

const mockSchedules = {
  schedules: [
    {
      id: 1,
      employee_id: 1,
      date: "2024-01-01",
      shift_id: 1,
      shift_start: "09:00",
      shift_end: "17:00",
      is_empty: false,
      version: 1,
    },
  ],
};

const mockAbsences = [
  {
    id: 1,
    employee_id: 1,
    absence_type_id: "vacation",
    start_date: "2024-01-05",
    end_date: "2024-01-10",
    status: "approved",
  },
];

const mockShifts = [
  {
    id: 1,
    start_time: "09:00",
    end_time: "17:00",
    duration_hours: 8,
    requires_break: true,
    active_days: [0, 1, 2, 3, 4],
  },
];

describe("GanttViewPage", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    // Reset mocks
    vi.clearAllMocks();

    // Setup default mock implementations - cast to vi.Mock
    (api.getEmployees as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockEmployees,
    );
    (api.getSchedules as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSchedules,
    );
    (api.getAbsences as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockAbsences,
    );
    (api.getShifts as ReturnType<typeof vi.fn>).mockResolvedValue(mockShifts);
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <GanttViewPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );
  };

  it("renders the component", () => {
    const { container } = renderComponent();
    expect(container).toBeTruthy();
  });

  it("fetches employees on mount", async () => {
    renderComponent();
    await waitFor(() => {
      expect(api.getEmployees).toHaveBeenCalled();
    });
  });

  it("fetches schedules when schedules data type is selected", async () => {
    renderComponent();
    await waitFor(() => {
      expect(api.getSchedules).toHaveBeenCalled();
    });
  });
});
