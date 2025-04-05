import { describe, it as test, expect, mock } from "bun:test";
import { render, screen, fireEvent } from "../../test-utils/test-utils";
import { EmployeesPage } from "../EmployeesPage";
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "../../services/api";
import { Employee, EmployeeGroup } from "../../types";

const mockEmployee: Employee = {
  id: 1,
  employee_id: "EMP1",
  first_name: "John",
  last_name: "Doe",
  employee_group: EmployeeGroup.VZ,
  contracted_hours: 40,
  is_keyholder: false,
  is_active: true,
  birthday: null,
  email: null,
  phone: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  max_daily_hours: 10,
  max_weekly_hours: 48,
};

// Mock the API functions using Bun's mock with proper types
const mockGetEmployees = mock<typeof getEmployees>(() =>
  Promise.resolve([mockEmployee]),
);
const mockCreateEmployee = mock<typeof createEmployee>((data) =>
  Promise.resolve({
    ...mockEmployee,
    first_name: data.first_name,
    last_name: data.last_name,
    employee_group: data.employee_group,
    contracted_hours: data.contracted_hours,
    is_keyholder: data.is_keyholder,
    is_active: data.is_active,
    birthday: data.birthday,
    email: data.email,
    phone: data.phone,
  }),
);
const mockUpdateEmployee = mock<typeof updateEmployee>((id, data) =>
  Promise.resolve({
    ...mockEmployee,
    id,
    ...data,
  }),
);
const mockDeleteEmployee = mock<typeof deleteEmployee>(() => Promise.resolve());

// Override the imported functions with mocks
Object.assign(globalThis, {
  getEmployees: mockGetEmployees,
  createEmployee: mockCreateEmployee,
  updateEmployee: mockUpdateEmployee,
  deleteEmployee: mockDeleteEmployee,
});

describe("EmployeesPage", () => {
  test("renders employee list", async () => {
    mockGetEmployees.mockImplementation(() => Promise.resolve([mockEmployee]));

    render(<EmployeesPage />);

    // Wait for the employee name to appear
    const employeeName = await screen.findByText("John Doe");
    expect(employeeName).toBeDefined();
  });

  test("can create new employee", async () => {
    render(<EmployeesPage />);

    // Click the "Add Employee" button
    const addButton = screen.getByText(/add employee/i);
    fireEvent.click(addButton);

    // Fill out the form
    const firstNameInput = screen.getByLabelText(/first name/i);
    fireEvent.change(firstNameInput, { target: { value: "Jane" } });

    const lastNameInput = screen.getByLabelText(/last name/i);
    fireEvent.change(lastNameInput, { target: { value: "Smith" } });

    const hoursInput = screen.getByLabelText(/contracted hours/i);
    fireEvent.change(hoursInput, { target: { value: "35" } });

    // Submit the form
    const submitButton = screen.getByText(/save/i);
    fireEvent.click(submitButton);

    // Verify the create function was called
    expect(mockCreateEmployee).toHaveBeenCalled();
  });

  test("can delete employee", async () => {
    mockGetEmployees.mockImplementation(() => Promise.resolve([mockEmployee]));

    render(<EmployeesPage />);

    // Wait for the delete button to appear and click it
    const deleteButton = await screen.findByLabelText(/delete employee/i);
    fireEvent.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByText(/confirm/i);
    fireEvent.click(confirmButton);

    // Verify the delete function was called
    expect(mockDeleteEmployee).toHaveBeenCalledWith(1);
  });
});
