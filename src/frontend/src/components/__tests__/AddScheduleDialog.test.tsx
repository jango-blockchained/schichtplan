import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { AddScheduleDialog } from "../Schedule/AddScheduleDialog"; // Adjust path as necessary
import { useToast } from "../ui/use-toast"; // Mock this
import * as scheduleService from "../../api/scheduleService"; // Mock this
import * as availabilityService from "../../api/availabilityService"; // Mock this
import {
  EmployeeWithAvailability,
  ShiftForEmployee,
  ScheduleEntry,
} from "../../types"; // Import the types
import { createSchedule } from "../../services/api";

// Mock dependencies
const mockToast = jest.fn();
jest.mock("../ui/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

jest.mock("../../api/scheduleService");
jest.mock("../../api/availabilityService");

const mockScheduleService = scheduleService as jest.Mocked<
  typeof scheduleService
>;
const mockAvailabilityService = availabilityService as jest.Mocked<
  typeof availabilityService
>;

describe("AddScheduleDialog", () => {
  const mockOnOpenChange = jest.fn();
  const mockOnScheduleAdded = jest.fn();
  const testDefaultDate = new Date("2024-03-15T00:00:00.000Z"); // Friday
  const testDefaultDateString = "2024-03-15";
  const testVersion = 1;

  const availableEmployee: EmployeeWithAvailability = {
    employee_id: "E1",
    first_name: "John",
    last_name: "Doe",
    status: "Available",
    is_active: true,
  };
  const preferredShift: ShiftForEmployee = {
    shift_id: "S2",
    name: "Late Shift (12:00-20:00)",
    availability_type: "PREFERRED",
  };
  const availableShift: ShiftForEmployee = {
    shift_id: "S1",
    name: "Early Shift (08:00-16:00)",
    availability_type: "AVAILABLE",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAvailabilityService.fetchEmployeesWithAvailabilityByDate.mockResolvedValue(
      [availableEmployee],
    );
    mockAvailabilityService.fetchApplicableShiftsForEmployee.mockResolvedValue([
      availableShift,
      preferredShift,
    ]);
    mockScheduleService.updateSchedule.mockResolvedValue({
      id: "gen-1",
      employee_id: availableEmployee.employee_id,
      shift_id: preferredShift.shift_id,
      date: testDefaultDateString,
      version: testVersion,
      availability_type: preferredShift.availability_type,
      notes: "",
    } as ScheduleEntry);
  });

  test("renders correctly when open", () => {
    render(
      <AddScheduleDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        onScheduleAdded={mockOnScheduleAdded}
        scheduleId={null}
        defaultDate={testDefaultDate}
        defaultEmployeeId={null}
        defaultShiftId={null}
        version={testVersion}
      />,
    );

    expect(screen.getByText("Add New Schedule Entry")).toBeInTheDocument();
    expect(screen.getByLabelText(/Date/i)).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /Employee/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /Shift/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Save Schedule/i }),
    ).toBeInTheDocument();
  });

  test("fetches, populates, and correctly enables/disables employee options", async () => {
    const anotherEmployee: EmployeeWithAvailability = {
      employee_id: "E2",
      first_name: "Jane",
      last_name: "Smith",
      status: "Absence: Vacation",
      is_active: true,
    };
    mockAvailabilityService.fetchEmployeesWithAvailabilityByDate.mockResolvedValue(
      [availableEmployee, anotherEmployee],
    );

    render(
      <AddScheduleDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        onScheduleAdded={mockOnScheduleAdded}
        scheduleId={null}
        defaultDate={testDefaultDate}
        defaultEmployeeId={null}
        defaultShiftId={null}
        version={testVersion}
      />,
    );

    await waitFor(() => {
      expect(
        mockAvailabilityService.fetchEmployeesWithAvailabilityByDate,
      ).toHaveBeenCalledWith(testDefaultDateString);
    });

    const employeeDropdown = screen.getByRole("combobox", {
      name: /Employee/i,
    });
    fireEvent.click(employeeDropdown);

    await waitFor(() => {
      const johnDoeOption = screen.getByRole("option", {
        name: /John Doe \(Available\)/i,
      });
      const janeSmithOption = screen.getByRole("option", {
        name: /Jane Smith \(Absence: Vacation\)/i,
      });
      expect(johnDoeOption).toBeInTheDocument();
      expect(janeSmithOption).toBeInTheDocument();
      expect(johnDoeOption).not.toHaveAttribute("aria-disabled", "true");
      expect(janeSmithOption).toHaveAttribute("aria-disabled", "true");
    });
  });

  test("fetches and populates shift dropdown after selecting an employee", async () => {
    render(
      <AddScheduleDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        onScheduleAdded={mockOnScheduleAdded}
        scheduleId={null}
        defaultDate={testDefaultDate}
        defaultEmployeeId={null}
        defaultShiftId={null}
        version={testVersion}
      />,
    );

    const employeeDropdown = screen.getByRole("combobox", {
      name: /Employee/i,
    });
    fireEvent.click(employeeDropdown);
    await waitFor(() => {
      const johnDoeOption = screen.getByRole("option", {
        name: /John Doe \(Available\)/i,
      });
      fireEvent.click(johnDoeOption);
    });

    await waitFor(() => {
      expect(
        mockAvailabilityService.fetchApplicableShiftsForEmployee,
      ).toHaveBeenCalledWith(
        testDefaultDateString,
        availableEmployee.employee_id,
      );
    });

    const shiftDropdown = screen.getByRole("combobox", { name: /Shift/i });
    fireEvent.click(shiftDropdown);

    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: /Early Shift .* AVAILABLE/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: /Late Shift .* PREFERRED/i }),
      ).toBeInTheDocument();
    });
  });

  test("submits the correct payload including inferred availability_type", async () => {
    render(
      <AddScheduleDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        onScheduleAdded={mockOnScheduleAdded}
        scheduleId={null}
        defaultDate={testDefaultDate}
        defaultEmployeeId={null}
        defaultShiftId={null}
        version={testVersion}
      />,
    );

    const employeeDropdown = screen.getByRole("combobox", {
      name: /Employee/i,
    });
    fireEvent.click(employeeDropdown);
    await waitFor(() =>
      screen.getByRole("option", { name: /John Doe \(Available\)/i }),
    );
    fireEvent.click(
      screen.getByRole("option", { name: /John Doe \(Available\)/i }),
    );

    const shiftDropdown = screen.getByRole("combobox", { name: /Shift/i });
    fireEvent.click(shiftDropdown);
    await waitFor(() =>
      screen.getByRole("option", { name: /Late Shift .* PREFERRED/i }),
    );
    fireEvent.click(
      screen.getByRole("option", { name: /Late Shift .* PREFERRED/i }),
    );

    const saveButton = screen.getByRole("button", { name: /Save Schedule/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockScheduleService.updateSchedule).toHaveBeenCalledTimes(1);
      expect(mockScheduleService.updateSchedule).toHaveBeenCalledWith(null, {
        employee_id: availableEmployee.employee_id,
        shift_id: preferredShift.shift_id,
        date: testDefaultDateString,
        version: testVersion,
        availability_type: preferredShift.availability_type,
        notes: "",
      });
    });

    expect(mockOnScheduleAdded).toHaveBeenCalledTimes(1);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    expect(mockToast).toHaveBeenCalledWith({
      title: "Success",
      description: "Schedule entry saved successfully.",
    });
  });

  test("handles pre-selected employee and shift values correctly", async () => {
    mockAvailabilityService.fetchEmployeesWithAvailabilityByDate.mockResolvedValue(
      [availableEmployee],
    );
    mockAvailabilityService.fetchApplicableShiftsForEmployee.mockResolvedValue([
      availableShift,
      preferredShift,
    ]);

    render(
      <AddScheduleDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        onScheduleAdded={mockOnScheduleAdded}
        scheduleId={null}
        defaultDate={testDefaultDate}
        defaultEmployeeId={availableEmployee.employee_id}
        defaultShiftId={preferredShift.shift_id}
        version={testVersion}
      />,
    );

    await waitFor(() => {
      expect(
        mockAvailabilityService.fetchEmployeesWithAvailabilityByDate,
      ).toHaveBeenCalledWith(testDefaultDateString);
    });

    await waitFor(() => {
      expect(
        mockAvailabilityService.fetchApplicableShiftsForEmployee,
      ).toHaveBeenCalledWith(
        testDefaultDateString,
        availableEmployee.employee_id,
      );
    });

    const employeeDropdown = screen.getByRole("combobox", {
      name: /Employee/i,
    });
    expect(employeeDropdown).toHaveTextContent(
      `${availableEmployee.first_name} ${availableEmployee.last_name}`,
    );

    const shiftDropdown = screen.getByRole("combobox", { name: /Shift/i });
    expect(shiftDropdown).toHaveTextContent(
      new RegExp(
        `${preferredShift.name} - ${preferredShift.availability_type}`,
        "i",
      ),
    );

    const saveButton = screen.getByRole("button", { name: /Save Schedule/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockScheduleService.updateSchedule).toHaveBeenCalledWith(null, {
        employee_id: availableEmployee.employee_id,
        shift_id: preferredShift.shift_id,
        date: testDefaultDateString,
        version: testVersion,
        availability_type: preferredShift.availability_type,
        notes: "",
      });
    });
    expect(mockOnScheduleAdded).toHaveBeenCalledTimes(1);
  });

  test("shows loading state for employee dropdown", async () => {
    let resolveEmployees: any;
    mockAvailabilityService.fetchEmployeesWithAvailabilityByDate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveEmployees = resolve;
        }),
    );

    render(
      <AddScheduleDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        onScheduleAdded={mockOnScheduleAdded}
        scheduleId={null}
        defaultDate={testDefaultDate}
        defaultEmployeeId={null}
        defaultShiftId={null}
        version={testVersion}
      />,
    );

    expect(
      screen.getByRole("combobox", { name: /Employee/i }),
    ).toHaveTextContent(/Loading employees.../i);

    await act(async () => {
      resolveEmployees!([availableEmployee]);
    });
    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: /Employee/i }),
      ).not.toHaveTextContent(/Loading employees.../i);
    });
  });

  test("shows loading state for shift dropdown", async () => {
    mockAvailabilityService.fetchEmployeesWithAvailabilityByDate.mockResolvedValue(
      [availableEmployee],
    );

    let resolveShifts: any;
    mockAvailabilityService.fetchApplicableShiftsForEmployee.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveShifts = resolve;
        }),
    );

    render(
      <AddScheduleDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        onScheduleAdded={mockOnScheduleAdded}
        scheduleId={null}
        defaultDate={testDefaultDate}
        defaultEmployeeId={null}
        defaultShiftId={null}
        version={testVersion}
      />,
    );

    const employeeDropdown = screen.getByRole("combobox", {
      name: /Employee/i,
    });
    fireEvent.click(employeeDropdown);
    await waitFor(() =>
      screen.getByRole("option", { name: /John Doe \(Available\)/i }),
    );
    fireEvent.click(
      screen.getByRole("option", { name: /John Doe \(Available\)/i }),
    );

    expect(screen.getByRole("combobox", { name: /Shift/i })).toHaveTextContent(
      /Loading shifts.../i,
    );

    await act(async () => {
      resolveShifts!([availableShift]);
    });
    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: /Shift/i }),
      ).not.toHaveTextContent(/Loading shifts.../i);
    });
  });

  test("shows error state for employee dropdown", async () => {
    const errorMessage = "Failed to fetch employees";
    mockAvailabilityService.fetchEmployeesWithAvailabilityByDate.mockRejectedValueOnce(
      new Error(errorMessage),
    );

    render(
      <AddScheduleDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        onScheduleAdded={mockOnScheduleAdded}
        scheduleId={null}
        defaultDate={testDefaultDate}
        defaultEmployeeId={null}
        defaultShiftId={null}
        version={testVersion}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: /Employee/i }),
      ).toHaveTextContent(/Error loading employees/i);
      expect(mockToast).toHaveBeenCalledWith({
        variant: "destructive",
        title: "Error",
        description: `Could not load employees: ${errorMessage}`,
      });
    });

    const shiftDropdown = screen.getByRole("combobox", { name: /Shift/i });
    expect(shiftDropdown).toBeDisabled();
  });

  test("shows error state for shift dropdown", async () => {
    mockAvailabilityService.fetchEmployeesWithAvailabilityByDate.mockResolvedValue(
      [availableEmployee],
    );

    const errorMessage = "Failed to fetch shifts";
    mockAvailabilityService.fetchApplicableShiftsForEmployee.mockRejectedValueOnce(
      new Error(errorMessage),
    );

    render(
      <AddScheduleDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        onScheduleAdded={mockOnScheduleAdded}
        scheduleId={null}
        defaultDate={testDefaultDate}
        defaultEmployeeId={null}
        defaultShiftId={null}
        version={testVersion}
      />,
    );

    const employeeDropdown = screen.getByRole("combobox", {
      name: /Employee/i,
    });
    fireEvent.click(employeeDropdown);
    await waitFor(() =>
      screen.getByRole("option", { name: /John Doe \(Available\)/i }),
    );
    fireEvent.click(
      screen.getByRole("option", { name: /John Doe \(Available\)/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: /Shift/i }),
      ).toHaveTextContent(/Error loading shifts/i);
      expect(mockToast).toHaveBeenCalledWith({
        variant: "destructive",
        title: "Error",
        description: `Could not load shifts for ${availableEmployee.first_name} ${availableEmployee.last_name}: ${errorMessage}`,
      });
    });
  });

  test("handles error during form submission", async () => {
    const submissionErrorMessage = "Network Error";
    // Override updateSchedule for this test to make it fail
    mockScheduleService.updateSchedule.mockRejectedValueOnce(
      new Error(submissionErrorMessage),
    );

    render(
      <AddScheduleDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        onScheduleAdded={mockOnScheduleAdded}
        scheduleId={null}
        defaultDate={testDefaultDate}
        defaultEmployeeId={null}
        defaultShiftId={null}
        version={testVersion}
      />,
    );

    // Simulate selecting employee and shift
    const employeeDropdown = screen.getByRole("combobox", {
      name: /Employee/i,
    });
    fireEvent.click(employeeDropdown);
    await waitFor(() =>
      screen.getByRole("option", { name: /John Doe \(Available\)/i }),
    );
    fireEvent.click(
      screen.getByRole("option", { name: /John Doe \(Available\)/i }),
    );

    const shiftDropdown = screen.getByRole("combobox", { name: /Shift/i });
    fireEvent.click(shiftDropdown);
    await waitFor(() =>
      screen.getByRole("option", { name: /Early Shift .* AVAILABLE/i }),
    );
    fireEvent.click(
      screen.getByRole("option", { name: /Early Shift .* AVAILABLE/i }),
    );

    // Click save
    const saveButton = screen.getByRole("button", { name: /Save Schedule/i });
    fireEvent.click(saveButton);

    // Wait for error handling
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        variant: "destructive",
        title: "Error Saving Schedule",
        description: `Could not save schedule entry: ${submissionErrorMessage}`,
      });
    });

    // Ensure dialog does not close and onScheduleAdded is not called
    expect(mockOnOpenChange).not.toHaveBeenCalledWith(false);
    expect(mockOnScheduleAdded).not.toHaveBeenCalled();
  });
});
