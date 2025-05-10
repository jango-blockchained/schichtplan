import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AddScheduleDialog } from '../Schedule/AddScheduleDialog'; // Adjust path as necessary
import { useToast } from '../ui/use-toast'; // Mock this
import * as scheduleService from '../../api/scheduleService'; // Mock this
import * as availabilityService from '../../api/availabilityService'; // Mock this
import { EmployeeWithAvailability, ShiftForEmployee, ScheduleEntry } from '../../types'; // Import the types

// Mock dependencies
const mockToast = jest.fn();
jest.mock('../ui/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

jest.mock('../../api/scheduleService');
jest.mock('../../api/availabilityService');

const mockScheduleService = scheduleService as jest.Mocked<typeof scheduleService>;
const mockAvailabilityService = availabilityService as jest.Mocked<typeof availabilityService>;

describe('AddScheduleDialog', () => {
  const mockOnOpenChange = jest.fn();
  const mockOnScheduleAdded = jest.fn();
  const testDefaultDate = new Date('2024-03-15T00:00:00.000Z'); // Friday
  const testDefaultDateString = '2024-03-15';
  const testVersion = 1;

  const availableEmployee: EmployeeWithAvailability = { employee_id: 'E1', first_name: 'John', last_name: 'Doe', status: 'Available', is_active: true };
  const preferredShift: ShiftForEmployee = { shift_id: 'S2', name: 'Late Shift (12:00-20:00)', availability_type: 'PREFERRED' };
  const availableShift: ShiftForEmployee = { shift_id: 'S1', name: 'Early Shift (08:00-16:00)', availability_type: 'AVAILABLE' };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default Mock API responses for most tests
    mockAvailabilityService.fetchEmployeesWithAvailabilityByDate.mockResolvedValue([availableEmployee]);
    mockAvailabilityService.fetchApplicableShiftsForEmployee.mockResolvedValue([availableShift, preferredShift]);
    mockScheduleService.updateSchedule.mockResolvedValue({
      id: 'gen-1', // Simulate a generated ID for a new entry
      employee_id: availableEmployee.employee_id,
      shift_id: preferredShift.shift_id,
      date: testDefaultDateString,
      version: testVersion,
      availability_type: preferredShift.availability_type,
      notes: ''
    } as ScheduleEntry);
  });

  test('renders correctly when open', () => {
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
      />
    );

    expect(screen.getByText('Add New Schedule Entry')).toBeInTheDocument();
    expect(screen.getByLabelText(/Date/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Employee/i})).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Shift/i})).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Schedule/i })).toBeInTheDocument();
  });

  test('fetches, populates, and correctly enables/disables employee options', async () => {
    const mockEmployees: EmployeeWithAvailability[] = [
      availableEmployee,
      { employee_id: 'E2', first_name: 'Jane', last_name: 'Smith', status: 'Absence: Vacation', is_active: true },
    ];
    mockAvailabilityService.fetchEmployeesWithAvailabilityByDate.mockResolvedValue(mockEmployees);

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
      />
    );

    await waitFor(() => {
      expect(mockAvailabilityService.fetchEmployeesWithAvailabilityByDate).toHaveBeenCalledWith(testDefaultDateString);
    });

    const employeeDropdown = screen.getByRole('combobox', { name: /Employee/i });
    fireEvent.click(employeeDropdown);

    await waitFor(() => {
      const johnDoeOption = screen.getByRole('option', { name: /John Doe \(Available\)/i });
      const janeSmithOption = screen.getByRole('option', { name: /Jane Smith \(Absence: Vacation\)/i });
      expect(johnDoeOption).toBeInTheDocument();
      expect(janeSmithOption).toBeInTheDocument();
      expect(johnDoeOption).not.toHaveAttribute('aria-disabled', 'true');
      expect(janeSmithOption).toHaveAttribute('aria-disabled', 'true');
    });
  });

  test('fetches and populates shift dropdown after selecting an employee', async () => {
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
      />
    );

    const employeeDropdown = screen.getByRole('combobox', { name: /Employee/i });
    fireEvent.click(employeeDropdown);
    await waitFor(() => {
      const johnDoeOption = screen.getByRole('option', { name: /John Doe \(Available\)/i });
      fireEvent.click(johnDoeOption);
    });

    await waitFor(() => {
      expect(mockAvailabilityService.fetchApplicableShiftsForEmployee).toHaveBeenCalledWith(testDefaultDateString, availableEmployee.employee_id);
    });

    const shiftDropdown = screen.getByRole('combobox', { name: /Shift/i });
    fireEvent.click(shiftDropdown);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Early Shift .* AVAILABLE/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Late Shift .* PREFERRED/i })).toBeInTheDocument();
    });
  });

  test('submits the correct payload including inferred availability_type', async () => {
    render(
      <AddScheduleDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        onScheduleAdded={mockOnScheduleAdded}
        scheduleId={null} // For creating a new entry
        defaultDate={testDefaultDate}
        defaultEmployeeId={null}
        defaultShiftId={null}
        version={testVersion}
      />
    );

    // Select employee
    const employeeDropdown = screen.getByRole('combobox', { name: /Employee/i });
    fireEvent.click(employeeDropdown);
    await waitFor(() => screen.getByRole('option', { name: /John Doe \(Available\)/i }));
    fireEvent.click(screen.getByRole('option', { name: /John Doe \(Available\)/i }));

    // Select shift (the one with PREFERRED availability)
    const shiftDropdown = screen.getByRole('combobox', { name: /Shift/i });
    fireEvent.click(shiftDropdown);
    await waitFor(() => screen.getByRole('option', { name: /Late Shift .* PREFERRED/i }));
    fireEvent.click(screen.getByRole('option', { name: /Late Shift .* PREFERRED/i }));

    // Click save
    const saveButton = screen.getByRole('button', { name: /Save Schedule/i });
    fireEvent.click(saveButton);

    // Verify updateSchedule call
    await waitFor(() => {
      expect(mockScheduleService.updateSchedule).toHaveBeenCalledTimes(1);
      expect(mockScheduleService.updateSchedule).toHaveBeenCalledWith(
        null, // scheduleId is null for creation
        {
          employee_id: availableEmployee.employee_id,
          shift_id: preferredShift.shift_id, // Selected S2
          date: testDefaultDateString,
          version: testVersion,
          availability_type: preferredShift.availability_type, // Should be PREFERRED
          notes: '' // Assuming notes are empty if not entered
        }
      );
    });

    // Verify callbacks and toast
    expect(mockOnScheduleAdded).toHaveBeenCalledTimes(1);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false); // Dialog should close
    expect(mockToast).toHaveBeenCalledWith({
      title: "Success",
      description: "Schedule entry saved successfully.",
    });
  });

  // TODO: Add more tests based on REFACTOR_NEW_SHIFT_MODAL.md
  // - Verify correct input reordering (Date, Employee, Shift). (Partially covered by render test)
  // - Test handling of pre-selected values.
  // - Test loading and error states.

}); 