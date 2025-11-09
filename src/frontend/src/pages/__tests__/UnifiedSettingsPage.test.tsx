import { beforeEach, describe, expect, it } from "bun:test";
import "../../__tests__/setup";
import UnifiedSettingsPage from "../UnifiedSettingsPage";

let render: any;

describe("UnifiedSettingsPage", () => {
  beforeEach(async () => {
    // Import test-utils after DOM is ready
    const tu = await import("../../test-utils/test-utils");
    render = tu.render;
  });

  it("renders without crashing", async () => {
    const { container } = render(<UnifiedSettingsPage />);
    expect(container).toBeDefined();
  });

  it("renders page container", async () => {
    const { container } = render(<UnifiedSettingsPage />);
    expect(container.querySelector("[class*='page']") || container.firstElementChild).toBeTruthy();
  });

  it("renders page content", async () => {
    const { container } = render(<UnifiedSettingsPage />);
    const content = container.textContent;
    expect((content || "").length > 0).toBe(true);
  });
});
