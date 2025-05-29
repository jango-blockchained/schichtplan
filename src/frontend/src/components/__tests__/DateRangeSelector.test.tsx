/// <reference lib="dom" />

import { describe, expect, it, mock } from "bun:test";
import { render, screen, fireEvent } from "../../test-utils/test-utils";
import { DateRangeSelector } from "../DateRangeSelector";

describe("DateRangeSelector", () => {
  const defaultProps = {
    dateRange: {
      from: new Date("2024-02-01"),
      to: new Date("2024-02-29"),
    },
    scheduleDuration: 4, // Assuming a default number of weeks
    onWeekChange: mock(() => {}),
    onDurationChange: mock(() => {}),
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
        dateRange={undefined}
        scheduleDuration={defaultProps.scheduleDuration}
        onWeekChange={defaultProps.onWeekChange}
        onDurationChange={defaultProps.onDurationChange}
      />,
    );
    const dateButton = screen.getByRole("button", { name: /pick a date/i });
    expect(dateButton).toBeDefined();
    expect(dateButton.textContent).toContain("Pick a date");
  });

  it("calls setStartDate and setEndDate when date range changes", async () => {
    const onWeekChange = mock(() => {});
    const onDurationChange = mock(() => {});

    render(
      <DateRangeSelector
        dateRange={defaultProps.dateRange}
        scheduleDuration={defaultProps.scheduleDuration}
        onWeekChange={onWeekChange}
        onDurationChange={onDurationChange}
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
