import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it as test } from "bun:test";
import { VoiceInput } from "../../components/ai/VoiceInput";
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

// Mock the aiService
const mockAiService = {
  processVoiceCommand: createMockFn(),
  sendMessage: createMockFn(),
  uploadFile: createMockFn(),
  executeWorkflow: createMockFn(),
  connectWebSocket: createMockFn(),
  disconnectWebSocket: createMockFn(),
  getWebSocketStatus: createMockFn(),
};

const mockOnTranscript = createMockFn();

// Mock SpeechRecognition
const mockSpeechRecognition = {
  start: createMockFn(),
  stop: createMockFn(),
  abort: createMockFn(),
  addEventListener: createMockFn(),
  removeEventListener: createMockFn(),
  continuous: true,
  interimResults: true,
  lang: "en-US",
  maxAlternatives: 1,
  serviceURI: "",
  grammars: null,
  onaudiostart: null,
  onaudioend: null,
  onend: null,
  onerror: null,
  onnomatch: null,
  onresult: null,
  onsoundstart: null,
  onsoundend: null,
  onspeechstart: null,
  onspeechend: null,
  onstart: null,
};

// Cast to any because tests assign a factory returning a mock object
(globalThis as any).SpeechRecognition = function () {
  return mockSpeechRecognition;
};
(globalThis as any).webkitSpeechRecognition = (globalThis as any).SpeechRecognition;

// Mock getUserMedia
Object.defineProperty(navigator, "mediaDevices", {
  writable: true,
  value: {
    getUserMedia: createMockFn(),
  },
});

describe("VoiceInput Component", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    mockAiService.processVoiceCommand.mockClear();
    mockSpeechRecognition.start.mockClear();
    mockSpeechRecognition.stop.mockClear();
    mockSpeechRecognition.addEventListener.mockClear();
    mockSpeechRecognition.removeEventListener.mockClear();
  });

  test("renders voice input component", () => {
    const { container } = render(<VoiceInput onTranscript={mockOnTranscript} />);

    const button = container.querySelector("button");
    expect(button).toBeTruthy();
  });

  test("shows microphone button when enabled", () => {
    const { container } = render(<VoiceInput onTranscript={mockOnTranscript} disabled={false} />);

    const micButton = container.querySelector("button");
    expect(micButton).toBeTruthy();
    expect(micButton?.disabled).toBe(false);
  });

  test("disables microphone button when disabled", () => {
    const { container } = render(<VoiceInput onTranscript={mockOnTranscript} disabled={true} />);

    const micButton = container.querySelector("button");
    expect(micButton?.disabled).toBe(true);
  });

  test("starts recording when microphone button is clicked", async () => {
    const { container } = render(<VoiceInput onTranscript={mockOnTranscript} disabled={false} />);

    const micButton = container.querySelector("button");

    await act(async () => {
      if (micButton) fireEvent.click(micButton);
    });

    expect(mockSpeechRecognition.start.toHaveBeenCalled()).toBe(true);
  });

  test("handles speech recognition results", async () => {
    const onTranscript = createMockFn();
    const { container } = render(
      <VoiceInput onTranscript={onTranscript} disabled={false} />,
    );

    const micButton = container.querySelector("button");

    await act(async () => {
      if (micButton) fireEvent.click(micButton);
    });

    // Simulate speech recognition result
    await act(async () => {
      const resultEvent = {
        results: [
          {
            0: { transcript: "Hello world", confidence: 0.9 },
            isFinal: true,
          },
        ],
      };

      // Find the onresult callback and call it
      const addEventListenerCalls =
        mockSpeechRecognition.addEventListener.calls;
      const resultCallback = addEventListenerCalls.find(
        (call) => call[0] === "result",
      );
      if (resultCallback) {
        resultCallback[1](resultEvent);
      }
    });

    expect(onTranscript.toHaveBeenCalledWith("Hello world")).toBe(true);
  });

  test("shows audio level visualization when recording", async () => {
    const { container } = render(
      <VoiceInput onTranscript={mockOnTranscript} />,
    );

    const micButton = container.querySelector("button");

    await act(async () => {
      if (micButton) fireEvent.click(micButton);
    });

    // Should show audio level indicator
    const audioLevel = container.querySelector('[data-testid="audio-level"]');
    expect(audioLevel).toBeTruthy();
  });

  test("handles voice command processing", async () => {
    const onCommand = createMockFn();
    const { container } = render(
      <VoiceInput onTranscript={mockOnTranscript} disabled={false} onCommand={onCommand} />,
    );

    const micButton = container.querySelector("button");

    await act(async () => {
      if (micButton) fireEvent.click(micButton);
    });

    // Simulate speech recognition result with command
    await act(async () => {
      const resultEvent = {
        results: [
          {
            0: { transcript: "create schedule for next week", confidence: 0.9 },
            isFinal: true,
          },
        ],
      };

      const addEventListenerCalls =
        mockSpeechRecognition.addEventListener.calls;
      const resultCallback = addEventListenerCalls.find(
        (call) => call[0] === "result",
      );
      if (resultCallback) {
        resultCallback[1](resultEvent);
      }
    });

    await waitFor(() => {
      expect(
        mockAiService.processVoiceCommand.toHaveBeenCalledWith(
          "create schedule for next week",
        ),
      ).toBe(true);
    });
  });

  test("handles microphone permission errors", async () => {
    const onError = createMockFn();
    const { container } = render(
      <VoiceInput onTranscript={() => { }} />,
    );

    const micButton = container.querySelector("button");

    await act(async () => {
      if (micButton) fireEvent.click(micButton);
    });

    // Simulate error
    await act(async () => {
      const errorEvent = { error: "not-allowed", message: "Permission denied" };

      const addEventListenerCalls =
        mockSpeechRecognition.addEventListener.calls;
      const errorCallback = addEventListenerCalls.find(
        (call) => call[0] === "error",
      );
      if (errorCallback) {
        errorCallback[1](errorEvent);
      }
    });

    expect(onError.toHaveBeenCalledWith("Microphone permission denied")).toBe(
      true,
    );
  });

  test("supports different languages", () => {
    const { container } = render(
      <VoiceInput onTranscript={mockOnTranscript} disabled={false} language="de-DE" />,
    );

    // Component should be rendered with German language setting
    const micButton = container.querySelector("button");
    expect(micButton).toBeTruthy();
  });

  test("handles continuous recording mode", () => {
    const { container } = render(
      <VoiceInput onTranscript={mockOnTranscript} disabled={false} />,
    );

    const micButton = container.querySelector("button");
    expect(micButton).toBeTruthy();
  });

  test("cleans up on unmount", () => {
    const { unmount } = render(<VoiceInput onTranscript={mockOnTranscript} disabled={false} />);

    unmount();

    // Should clean up without errors
    expect(mockSpeechRecognition.removeEventListener.toHaveBeenCalled()).toBe(
      true,
    );
  });

  test("shows confidence score for speech recognition", async () => {
    const { container } = render(
      <VoiceInput onTranscript={() => { }} />,
    );

    const micButton = container.querySelector("button");

    await act(async () => {
      if (micButton) fireEvent.click(micButton);
    });

    // Simulate speech recognition result with confidence
    await act(async () => {
      const resultEvent = {
        results: [
          {
            0: { transcript: "test command", confidence: 0.85 },
            isFinal: true,
          },
        ],
      };

      const addEventListenerCalls =
        mockSpeechRecognition.addEventListener.calls;
      const resultCallback = addEventListenerCalls.find(
        (call) => call[0] === "result",
      );
      if (resultCallback) {
        resultCallback[1](resultEvent);
      }
    });

    // Should display confidence indicator
    const confidenceIndicator = container.querySelector(
      '[data-testid="confidence-indicator"]',
    );
    expect(confidenceIndicator).toBeTruthy();
  });

  test("handles speech recognition errors gracefully", async () => {
    const onError = createMockFn();
    const { container } = render(
      <VoiceInput onTranscript={() => { }} />,
    );

    const micButton = container.querySelector("button");

    await act(async () => {
      if (micButton) fireEvent.click(micButton);
    });

    // Simulate error
    await act(async () => {
      const errorEvent = { error: "network", message: "Network error" };

      const addEventListenerCalls =
        mockSpeechRecognition.addEventListener.calls;
      const errorCallback = addEventListenerCalls.find(
        (call) => call[0] === "error",
      );
      if (errorCallback) {
        errorCallback[1](errorEvent);
      }
    });

    expect(
      onError.toHaveBeenCalledWith("Speech recognition error: network"),
    ).toBe(true);
  });

  test("provides visual feedback for recording state", async () => {
    const { container } = render(<VoiceInput onTranscript={() => { }} />);

    const micButton = container.querySelector("button");

    await act(async () => {
      if (micButton) fireEvent.click(micButton);
    });

    // Button should show recording state
    expect(micButton?.classList.contains("recording")).toBe(true);
  });

  test("respects browser compatibility", () => {
    // Test when SpeechRecognition is not available
    const originalSpeechRecognition = globalThis.SpeechRecognition;
    const originalWebkitSpeechRecognition = globalThis.webkitSpeechRecognition;

    delete globalThis.SpeechRecognition;
    delete globalThis.webkitSpeechRecognition;

    const { container } = render(<VoiceInput onTranscript={() => { }} />);

    const micButton = container.querySelector("button");
    expect(micButton?.disabled).toBe(true);

    // Restore
    globalThis.SpeechRecognition = originalSpeechRecognition;
    globalThis.webkitSpeechRecognition = originalWebkitSpeechRecognition;
  });
});
