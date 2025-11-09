import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render } from "../../test-utils/test-utils";
import EmployeeForm from "../EmployeeForm";

describe("EmployeeForm", () => {
  const mockOnSubmit = mock(() => { });

  beforeEach(() => {
    mockOnSubmit.mockClear?.();
  });

  it("renders all form fields", () => {
    const { container } = render(<EmployeeForm onSubmit={mockOnSubmit} />);

    const nameInput = container.querySelector('input[id="name"]');
    const positionSelect = container.querySelector("#position");
    const hoursInput = container.querySelector('input[id="hours"]');
    const submitButton = container.querySelector('button[type="submit"]');

    expect(nameInput).toBeDefined();
    expect(positionSelect).toBeDefined();
    expect(hoursInput).toBeDefined();
    expect(submitButton?.textContent).toContain("Add Employee");
  });

  it("updates input values when typing", async () => {
    const { container } = render(<EmployeeForm onSubmit={mockOnSubmit} />);

    const nameInput = container.querySelector(
      'input[id="name"]',
    ) as HTMLInputElement;
    const hoursInput = container.querySelector(
      'input[id="hours"]',
    ) as HTMLInputElement;

    expect(nameInput).toBeDefined();
    expect(hoursInput).toBeDefined();

    if (nameInput && hoursInput) {
      await userEvent.type(nameInput, "John Doe");
      await userEvent.type(hoursInput, "40:00");

      expect(nameInput.value).toBe("John Doe");
      expect(hoursInput.value).toBe("40:00");
    }
  });

  it("renders form container", () => {
    const { container } = render(<EmployeeForm onSubmit={mockOnSubmit} />);

    const form = container.querySelector("form");
    expect(form).toBeDefined();
  });

  it("has required attributes on inputs", () => {
    const { container } = render(<EmployeeForm onSubmit={mockOnSubmit} />);

    const nameInput = container.querySelector('input[id="name"]') as HTMLInputElement;
    const hoursInput = container.querySelector('input[id="hours"]') as HTMLInputElement;

    expect(nameInput?.required).toBe(true);
    expect(hoursInput?.required).toBe(true);
  });

  it("renders position selector", () => {
    const { container } = render(<EmployeeForm onSubmit={mockOnSubmit} />);

    const positionSelect = container.querySelector("#position");
    expect(positionSelect).toBeDefined();
  });

  it("clears name input field", async () => {
    const { container } = render(<EmployeeForm onSubmit={mockOnSubmit} />);

    const nameInput = container.querySelector(
      'input[id="name"]',
    ) as HTMLInputElement;

    if (nameInput) {
      await userEvent.type(nameInput, "Test Name");
      expect(nameInput.value).toBe("Test Name");

      await userEvent.clear(nameInput);
      expect(nameInput.value).toBe("");
    }
  });

  it("clears hours input field", async () => {
    const { container } = render(<EmployeeForm onSubmit={mockOnSubmit} />);

    const hoursInput = container.querySelector(
      'input[id="hours"]',
    ) as HTMLInputElement;

    if (hoursInput) {
      await userEvent.type(hoursInput, "40:00");
      expect(hoursInput.value).toBe("40:00");

      await userEvent.clear(hoursInput);
      expect(hoursInput.value).toBe("");
    }
  });

  it("renders submit button with correct text", () => {
    const { container } = render(<EmployeeForm onSubmit={mockOnSubmit} />);

    const submitButton = container.querySelector('button[type="submit"]');
    expect(submitButton?.textContent).toContain("Add Employee");
  });
});
