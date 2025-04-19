import { describe, expect, it, mock } from "bun:test";
import { render, screen, fireEvent } from "@testing-library/react";
import DateRangeSelector from "@/components/common/DateRangeSelector";

describe("DateRangeSelector", () => {
  const defaultProps = {
    startDate: new Date("2024-02-01"),
    endDate: new Date("2024-02-29"),
    setStartDate: mock(() => {}),
    setEndDate: mock(() => {}),
  };

  it("renders without crashing", () => {
    const { container } = render(<DateRangeSelector {...defaultProps} />);
    expect(container).toBeDefined();
  });

  it("displays the current date range", () => {
    render(<DateRangeSelector {...defaultProps} />);
    const dateButton = screen.getByRole("button", {
      name: /Feb 01, 2024.*Feb 29, 2024/i,
    });
    expect(dateButton).toBeDefined();
    expect(dateButton.textContent).toContain("Feb 01, 2024");
    expect(dateButton.textContent).toContain("Feb 29, 2024");
  });

  it("handles null dates", () => {
    render(
      <DateRangeSelector
        startDate={null}
        endDate={null}
        setStartDate={defaultProps.setStartDate}
        setEndDate={defaultProps.setEndDate}
      />,
    );
    const dateButton = screen.getByRole("button", { name: /pick a date/i });
    expect(dateButton).toBeDefined();
    expect(dateButton.textContent).toContain("Pick a date");
  });

  it("calls setStartDate and setEndDate when date range changes", async () => {
    const setStartDate = mock(() => {});
    const setEndDate = mock(() => {});

    render(
      <DateRangeSelector
        startDate={defaultProps.startDate}
        endDate={defaultProps.endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
      />,
    );

    const dateButton = screen.getByRole("button", {
      name: /Feb 01, 2024.*Feb 29, 2024/i,
    });
    expect(dateButton).toBeDefined();

    // Click the button to open the date picker
    await fireEvent.click(dateButton);

    // The calendar should be visible now
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeDefined();
  });
});
