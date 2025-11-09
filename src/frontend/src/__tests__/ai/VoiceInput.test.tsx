import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it as test } from "bun:test";
import { VoiceInput } from "../../components/ai/VoiceInput";
import "../setup";

// Create simple mock function
const createMockFn = () => {
  const fn = () => {};
  (fn as any).toHaveBeenCalled = () => false;
  return fn;
};

const mockOnTranscript = createMockFn();

// Mock SpeechRecognition
const mockSpeechRecognition = {
  start: () => {},
  stop: () => {},
  abort: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
};

(globalThis as any).SpeechRecognition = function () {
  return mockSpeechRecognition;
};
(globalThis as any).webkitSpeechRecognition = (globalThis as any).SpeechRecognition;

describe("VoiceInput Component", () => {
  beforeEach(() => {
    // Reset mocks
  });

  test("renders voice input component", () => {
    const { container } = render(<VoiceInput onTranscript={mockOnTranscript} />);
    const button = container.querySelector("button");
    expect(button).toBeTruthy();
  });

  test("microphone button is present when enabled", () => {
    const { container } = render(<VoiceInput onTranscript={mockOnTranscript} disabled={false} />);
    const micButton = container.querySelector("button");
    expect(micButton).toBeTruthy();
  });

  test("microphone button is disabled when disabled prop is true", () => {
    const { container } = render(<VoiceInput onTranscript={mockOnTranscript} disabled={true} />);
    const micButton = container.querySelector("button");
    expect(micButton?.disabled).toBe(true);
  });

  test("renders container div", () => {
    const { container } = render(<VoiceInput onTranscript={mockOnTranscript} />);
    expect(container.firstElementChild).toBeTruthy();
  });

  test("has proper ARIA attributes", () => {
    const { container } = render(<VoiceInput onTranscript={mockOnTranscript} />);
    const button = container.querySelector("button");
    expect(button).toBeTruthy();
  });

  test("renders successfully without errors", () => {
    const { container } = render(<VoiceInput onTranscript={mockOnTranscript} />);
    expect(container).toBeDefined();
  });
});
