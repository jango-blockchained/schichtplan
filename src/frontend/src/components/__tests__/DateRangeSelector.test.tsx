/// <reference lib="dom" />

import { describe, expect, it, mock } from "bun:test";
import { render } from "../../test-utils/test-utils";
import { DateRangeSelector } from "../DateRangeSelector";

describe("DateRangeSelector", () => {
  const defaultProps = {
    dateRange: {
      from: new Date("2024-02-01"),
      to: new Date("2024-02-29"),
    },
    scheduleDuration: 4,
    onWeekChange: mock(() => { }),
    onDurationChange: mock(() => { }),
  };

  it("renders without crashing", () => {
    const { container } = render(<DateRangeSelector {...defaultProps} />);
    expect(container).toBeDefined();
    expect(container.querySelector(".rounded-xl")).toBeTruthy();
  });

  it("displays the current date range", () => {
    const { container } = render(<DateRangeSelector {...defaultProps} />);
    const content = container.textContent || "";
    expect(content).toContain("01.02.2024");
    expect(content).toContain("29.02.2024");
  });

  it("displays week information", () => {
    const { container } = render(<DateRangeSelector {...defaultProps} />);
    const content = container.textContent || "";
    // Should display some week/date information
    expect(content.length).toBeGreaterThan(0);
  });

  it("renders navigation buttons", () => {
    const { container } = render(<DateRangeSelector {...defaultProps} />);
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it("handles null/undefined date range gracefully", () => {
    const { container } = render(
      <DateRangeSelector
        dateRange={undefined}
        scheduleDuration={defaultProps.scheduleDuration}
        onWeekChange={defaultProps.onWeekChange}
        onDurationChange={defaultProps.onDurationChange}
      />,
    );
    expect(container).toBeDefined();
    expect(container.querySelector(".rounded-xl")).toBeTruthy();
  });

  it("renders duration selector", () => {
    const { container } = render(<DateRangeSelector {...defaultProps} />);
    const selectors = container.querySelectorAll("select, button");
    expect(selectors.length).toBeGreaterThan(0);
  });

  it("applies correct styling classes", () => {
    const { container } = render(<DateRangeSelector {...defaultProps} />);
    const mainDiv = container.querySelector(".rounded-xl");
    expect(mainDiv).toBeTruthy();
    expect(mainDiv?.classList.contains("border")).toBe(true);
  });

  it("renders header with icon", () => {
    const { container } = render(<DateRangeSelector {...defaultProps} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });
});
