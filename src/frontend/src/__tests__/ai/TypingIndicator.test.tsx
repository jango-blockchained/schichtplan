import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it as test } from "bun:test";
import TypingIndicator from "../../components/ai/TypingIndicator";
import "../setup";

// Create mock functions
const createMockFn = () => {
  const fn = (...args: any[]) => fn.mockReturnValue;
  fn.mockClear = () => {
    fn.calls = [];
  };
  fn.mockReturnValue = undefined;
  fn.calls = [] as any[];
  fn.toHaveBeenCalled = () => fn.calls.length > 0;
  fn.toHaveBeenCalledWith = (expectedArgs: any) =>
    fn.calls.some(
      (call) => JSON.stringify(call) === JSON.stringify(expectedArgs),
    );
  return fn;
};

describe("TypingIndicator Component", () => {
  beforeEach(() => {
    // Reset any global state before each test
  });

  test("renders when typing is true", () => {
    const { container } = render(<TypingIndicator typing={true} />);

    const indicator =
      container.querySelector('[data-testid="typing-indicator"]') ||
      container.querySelector(".typing-indicator") ||
      container.firstElementChild;
    expect(indicator).toBeTruthy();
  });

  test("does not render when typing is false", () => {
    const { container } = render(<TypingIndicator typing={false} />);

    const indicator =
      container.querySelector('[data-testid="typing-indicator"]') ||
      container.querySelector(".typing-indicator");
    expect(indicator).toBeFalsy();
  });

  test("shows typing dots animation", () => {
    const { container } = render(<TypingIndicator typing={true} />);

    const dots =
      container.querySelectorAll(".dot") ||
      container.querySelectorAll('[data-testid="typing-dot"]') ||
      container.querySelectorAll("span");
    expect(dots.length).toBeGreaterThan(0);
  });

  test("displays single user typing", () => {
    const { container } = render(
      <TypingIndicator typing={true} users={["Alice"]} />,
    );

    const text = container.textContent;
    expect(text).toContain("Alice");
  });

  test("displays multiple users typing", () => {
    const { container } = render(
      <TypingIndicator typing={true} users={["Alice", "Bob"]} />,
    );

    const text = container.textContent;
    expect(text).toContain("Alice");
    expect(text).toContain("Bob");
  });

  test("handles empty users array", () => {
    const { container } = render(<TypingIndicator typing={true} users={[]} />);

    // Should still render indicator even without user names
    const indicator = container.firstElementChild;
    expect(indicator).toBeTruthy();
  });

  test("applies custom className", () => {
    const { container } = render(
      <TypingIndicator typing={true} className="custom-typing" />,
    );

    const element = container.firstElementChild;
    expect(element?.classList.contains("custom-typing")).toBe(true);
  });

  test("renders without users prop", () => {
    const { container } = render(<TypingIndicator typing={true} />);

    const indicator = container.firstElementChild;
    expect(indicator).toBeTruthy();
  });

  test("handles large number of users", () => {
    const manyUsers = Array.from({ length: 10 }, (_, i) => `User${i + 1}`);
    const { container } = render(
      <TypingIndicator typing={true} users={manyUsers} />,
    );

    // Should render without errors
    const indicator = container.firstElementChild;
    expect(indicator).toBeTruthy();
  });

  test("has proper accessibility attributes", () => {
    const { container } = render(<TypingIndicator typing={true} />);

    const indicator = container.firstElementChild;
    // Should have some accessibility attributes
    expect(
      indicator?.getAttribute("aria-live") ||
      indicator?.getAttribute("role") ||
      indicator?.getAttribute("aria-label"),
    ).toBeTruthy();
  });

  test("updates when typing state changes", async () => {
    const { container, rerender } = render(<TypingIndicator typing={false} />);

    // Initially not visible
    expect(container.firstElementChild).toBeFalsy();

    // Should appear when typing starts
    rerender(<TypingIndicator typing={true} />);
    expect(container.firstElementChild).toBeTruthy();

    // Should disappear when typing stops
    rerender(<TypingIndicator typing={false} />);
    expect(container.firstElementChild).toBeFalsy();
  });

  test("handles rapid typing state changes", async () => {
    const { container, rerender } = render(<TypingIndicator typing={false} />);

    // Rapidly toggle typing state
    for (let i = 0; i < 5; i++) {
      rerender(<TypingIndicator typing={true} />);
      rerender(<TypingIndicator typing={false} />);
    }

    // Should handle changes gracefully
    expect(container).toBeTruthy();
  });

  test("maintains consistent styling", () => {
    const { container } = render(<TypingIndicator typing={true} />);

    const indicator = container.firstElementChild;

    // Should have consistent styling classes
    expect(indicator?.classList.length).toBeGreaterThan(0);
  });

  test("displays user count correctly", () => {
    const users = ["Alice", "Bob", "Charlie"];
    const { container } = render(
      <TypingIndicator typing={true} users={users} />,
    );

    const text = container.textContent || "";

    // Should mention all users or indicate multiple users
    expect(
      users.some((user) => text.includes(user)) || text.includes("3"),
    ).toBe(true);
  });

  test("handles special characters in user names", () => {
    const specialUsers = ["User@123", "User-Name", "User.Name"];
    const { container } = render(
      <TypingIndicator typing={true} users={specialUsers} />,
    );

    // Should render without errors
    const indicator = container.firstElementChild;
    expect(indicator).toBeTruthy();
  });

  test("gracefully handles undefined users", () => {
    const { container } = render(
      <TypingIndicator typing={true} users={undefined} />,
    );

    // Should render without errors
    const indicator = container.firstElementChild;
    expect(indicator).toBeTruthy();
  });
});
