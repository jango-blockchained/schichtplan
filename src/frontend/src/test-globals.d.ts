import React from "react";

declare global {
  // Tests refer to TypingIndicator without importing — provide a loose global type
  let TypingIndicator: React.ComponentType<unknown> | undefined;

  // Some tests reference an `onTranscription` global helper
  let onTranscription: ((text: string, confidence?: number) => void) | undefined;

  // Allow tests to mock SpeechRecognition APIs without compile errors
  // Tests mock SpeechRecognition as function returning mock object; allow any on globalThis
  interface GlobalThis {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }

  // Also allow using <TypingIndicator .../> as a global JSX intrinsic element in tests
  namespace JSX {
    interface IntrinsicElements {
      TypingIndicator: { typing?: boolean; users?: string[] | undefined; className?: string };
    }
  }
}

export { };

