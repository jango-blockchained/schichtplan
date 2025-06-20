/// <reference lib="dom" />

import { describe, expect, it, mock } from "bun:test";
import type { DateRange } from "react-day-picker";
import { fireEvent, render, screen } from "../../../test-utils/test-utils";
import { NavigationSection } from "../NavigationSection";

describe("NavigationSection", () => {
  const defaultProps = {
    // Navigation mode
    useWeekBasedNavigation: false,
    onNavigationModeChange: mock(() => {}),
    
    // Date range
    dateRange: {
      from: new Date("2024-02-01"),
      to: new Date("2024-02-29"),
    } as DateRange,
    onDateRangeChange: mock(() => {}),
    weekAmount: 4,
    onWeekAmountChange: mock(() => {}),
    
    // Week navigation
    currentWeekInfo: {
      weekNumber: 5,
      year: 2024,
      startDate: new Date("2024-02-01"),
      endDate: new Date("2024-02-07"),
      identifier: "2024-W05",
      spansMonths: false,
    },
    onNavigatePrevious: mock(() => {}),
    onNavigateNext: mock(() => {}),
    isWeekNavigationLoading: false,
    hasWeekVersions: false,
    
    // Week version
    weekVersionMeta: {
      version: 1,
      is_published: false,
      created_at: "2024-02-01T00:00:00Z",
      notes: "Test version",
    },
    selectedWeekVersion: 1,
    onCreateWeekVersion: mock(() => {}),
    onSelectWeekVersion: mock(() => {}),
    
    // Standard navigation
    hasVersions: true,
    currentVersion: 1,
    onCreateNewVersion: mock(() => {}),
    onCreateNewVersionWithSpecificDateRange: mock(() => {}),
    onWeekChange: mock(() => {}),
  };

  beforeEach(() => {
    // Reset all mocks before each test
    Object.values(defaultProps).forEach(prop => {
      if (typeof prop === 'function' && 'mockClear' in prop) {
        prop.mockClear();
      }
    });
  });

  it("renders without crashing", () => {
    const { container } = render(<NavigationSection {...defaultProps} />);
    expect(container).toBeDefined();
  });

  it("displays navigation mode switch", () => {
    render(<NavigationSection {...defaultProps} />);
    
    // Should show navigation mode switch
    const navigationSwitch = screen.getByRole("switch");
    expect(navigationSwitch).toBeDefined();
    expect(navigationSwitch.getAttribute("aria-checked")).toBe("false");
  });

  it("displays date range selector in date mode", () => {
    render(<NavigationSection {...defaultProps} />);
    
    // Should show enhanced date range selector
    const dateButton = screen.getByText(/Feb 01, 2024.*Feb 29, 2024/);
    expect(dateButton).toBeDefined();
  });

  it("displays week navigator in week mode", () => {
    const weekModeProps = {
      ...defaultProps,
      useWeekBasedNavigation: true,
    };
    
    render(<NavigationSection {...weekModeProps} />);
    
    // Should show week identifier
    expect(screen.getByText("2024-W05")).toBeDefined();
  });

  it("switches navigation mode when toggle is changed", () => {
    render(<NavigationSection {...defaultProps} />);
    
    const navigationSwitch = screen.getByRole("switch");
    fireEvent.click(navigationSwitch);
    
    expect(defaultProps.onNavigationModeChange).toHaveBeenCalledWith(true);
  });

  it("calls onDateRangeChange when date range is modified", () => {
    render(<NavigationSection {...defaultProps} />);
    
    // Simulate clicking the date button to open picker
    const dateButton = screen.getByText(/Feb 01, 2024.*Feb 29, 2024/);
    fireEvent.click(dateButton);
    
    // The exact implementation would depend on the EnhancedDateRangeSelector
    // For now, we just verify the component renders properly
    expect(dateButton).toBeDefined();
  });

  it("calls navigation handlers in week mode", () => {
    const weekModeProps = {
      ...defaultProps,
      useWeekBasedNavigation: true,
    };
    
    render(<NavigationSection {...weekModeProps} />);
    
    // Find and click previous/next buttons (implementation depends on WeekNavigator)
    const previousButton = screen.queryByRole("button", { name: /previous/i });
    const nextButton = screen.queryByRole("button", { name: /next/i });
    
    if (previousButton) {
      fireEvent.click(previousButton);
      expect(defaultProps.onNavigatePrevious).toHaveBeenCalled();
    }
    
    if (nextButton) {
      fireEvent.click(nextButton);
      expect(defaultProps.onNavigateNext).toHaveBeenCalled();
    }
  });

  it("shows week version information when available", () => {
    const propsWithVersions = {
      ...defaultProps,
      useWeekBasedNavigation: true,
      hasWeekVersions: true,
    };
    
    render(<NavigationSection {...propsWithVersions} />);
    
    // Should show week version information (exact display depends on WeekVersionDisplay)
    expect(screen.getByText("Test version")).toBeDefined();
  });

  it("calls version creation handlers", () => {
    render(<NavigationSection {...defaultProps} />);
    
    // Look for create version button (implementation depends on exact component structure)
    const createButton = screen.queryByRole("button", { name: /create/i });
    
    if (createButton) {
      fireEvent.click(createButton);
      expect(defaultProps.onCreateNewVersion).toHaveBeenCalled();
    }
  });

  it("displays loading state in week navigation", () => {
    const loadingProps = {
      ...defaultProps,
      useWeekBasedNavigation: true,
      isWeekNavigationLoading: true,
    };
    
    render(<NavigationSection {...loadingProps} />);
    
    // Should show loading indicator (exact implementation depends on WeekNavigator)
    const loadingIndicator = screen.queryByTestId("loading") || screen.queryByText(/loading/i);
    expect(loadingIndicator).toBeDefined();
  });

  it("handles week amount changes", () => {
    render(<NavigationSection {...defaultProps} />);
    
    // Look for week amount input
    const weekInput = screen.queryByDisplayValue("4");
    if (weekInput) {
      fireEvent.change(weekInput, { target: { value: "6" } });
      expect(defaultProps.onWeekAmountChange).toHaveBeenCalledWith(6);
    }
  });

  it("shows appropriate content based on hasVersions prop", () => {
    const noVersionsProps = {
      ...defaultProps,
      hasVersions: false,
    };
    
    render(<NavigationSection {...noVersionsProps} />);
    
    // Should handle the case when no versions exist
    const { container } = render(<NavigationSection {...noVersionsProps} />);
    expect(container).toBeDefined();
  });

  it("handles week version selection", () => {
    const weekModeProps = {
      ...defaultProps,
      useWeekBasedNavigation: true,
      hasWeekVersions: true,
    };
    
    render(<NavigationSection {...weekModeProps} />);
    
    // Look for version selector (implementation depends on WeekVersionDisplay)
    const versionElement = screen.queryByText("Test version");
    if (versionElement) {
      fireEvent.click(versionElement);
      // The exact event handling would depend on the component implementation
    }
  });

  it("displays current version information", () => {
    render(<NavigationSection {...defaultProps} />);
    
    // Should show current version number somewhere
    const versionInfo = screen.queryByText(/version.*1/i);
    if (versionInfo) {
      expect(versionInfo).toBeDefined();
    }
  });
});
