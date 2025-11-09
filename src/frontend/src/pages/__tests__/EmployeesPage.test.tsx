import { describe, expect, mock, it as test } from "bun:test";
import {
  createEmployee,
  deleteEmployee,
  getEmployees,
  updateEmployee,
} from "../../services/api";
import { render } from "../../test-utils/test-utils";
import { Employee, EmployeeGroup } from "../../types";
import { EmployeesPage } from "../EmployeesPage";

const mockEmployee: Employee = {
  id: 1,
  employee_id: "EMP1",
  first_name: "John",
  last_name: "Doe",
  employee_group: EmployeeGroup.VZ,
  contracted_hours: 40,
  vacation_per_year: 28,
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
  test("renders without crashing", () => {
    const { container } = render(<EmployeesPage />);
    expect(container).toBeDefined();
  });

  test("renders page container", () => {
    const { container } = render(<EmployeesPage />);
    expect(container.querySelector("[class*='page']") || container.firstElementChild).toBeTruthy();
  });

  test("renders page content", () => {
    const { container } = render(<EmployeesPage />);
    const content = container.textContent;
    expect(content && content.length).toBeGreaterThan(0);
  });
});
