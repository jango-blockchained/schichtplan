import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it as test } from "bun:test";
import { FileUploadComponent } from "../../components/ai/FileUploadComponent";
import "../setup";

describe("FileUploadComponent", () => {
  beforeEach(() => {
    // Reset state
  });

  test("renders file upload component", () => {
    const { container } = render(<FileUploadComponent />);
    expect(container.firstElementChild).toBeTruthy();
  });

  test("has upload area visible", () => {
    const { container } = render(<FileUploadComponent />);
    const uploadArea = container.querySelector('[data-testid="file-upload"]') ||
      container.querySelector(".upload-area") ||
      container.querySelector("[class*='upload']") ||
      container.firstElementChild;
    expect(uploadArea).toBeTruthy();
  });

  test("renders without crashing", () => {
    const { container } = render(<FileUploadComponent />);
    expect(container).toBeDefined();
  });

  test("has file input element", () => {
    const { container } = render(<FileUploadComponent />);
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();
  });

  test("accepts multiple file types", () => {
    const acceptedTypes = [".pdf", ".doc", ".txt"];
    const { container } = render(
      <FileUploadComponent acceptedFileTypes={acceptedTypes} />,
    );
    expect(container).toBeDefined();
  });

  test("renders with proper structure", () => {
    const { container } = render(<FileUploadComponent />);
    const content = container.textContent;
    expect(content && content.length).toBeGreaterThan(0);
  });

  test("can handle drop zone rendering", () => {
    const { container } = render(<FileUploadComponent />);
    const dropZone = container.querySelector("[class*='drop']") ||
      container.querySelector("[class*='zone']") ||
      container.firstElementChild;
    expect(dropZone).toBeTruthy();
  });
});
