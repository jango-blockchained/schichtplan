import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it as test } from "bun:test";
import TypingIndicator from "../../components/ai/TypingIndicator";
import "../setup";

describe("TypingIndicator Component", () => {
  beforeEach(() => {
    // Reset any global state before each test
  });

  test("renders when typing is true", () => {
    const { container } = render(<TypingIndicator typing={true} />);

    const indicator = container.firstElementChild;
    expect(indicator).toBeTruthy();
  });

  test("does not render when typing is false", () => {
    const { container } = render(<TypingIndicator typing={false} />);

    // Should not render any elements or minimal elements
    const children = container.children;
    expect(children.length).toBeLessThanOrEqual(0);
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

  test("renders properly for single user", () => {
    const { container } = render(
      <TypingIndicator typing={true} users={["Alice"]} />,
    );

    const indicator = container.firstElementChild;
    expect(indicator).toBeTruthy();
  });

  test("renders properly for multiple users", () => {
    const { container } = render(
      <TypingIndicator typing={true} users={["Alice", "Bob"]} />,
    );

    const indicator = container.firstElementChild;
    expect(indicator).toBeTruthy();
  });

  test("updates when typing state changes", async () => {
    const { container, rerender } = render(<TypingIndicator typing={false} />);

    // Initially not visible
    expect(container.children.length).toBeLessThanOrEqual(0);

    // Should appear when typing starts
    rerender(<TypingIndicator typing={true} />);
    expect(container.firstElementChild).toBeTruthy();

    // Should disappear when typing stops
    rerender(<TypingIndicator typing={false} />);
    expect(container.children.length).toBeLessThanOrEqual(0);
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
