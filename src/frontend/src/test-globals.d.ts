/// <reference types="react" />

declare global {
  // Tests refer to TypingIndicator without importing — provide a loose global type
  let TypingIndicator: React.ComponentType<{
    typing?: boolean;
    users?: string[] | undefined;
    className?: string;
  }> | undefined;

  // Some tests reference an `onTranscription` global helper
  let onTranscription: ((text: string, confidence?: number) => void) | undefined;

  // Allow tests to mock SpeechRecognition APIs without compile errors
  // Tests mock SpeechRecognition as function returning mock object; allow any on globalThis
  interface GlobalThis {
    // Allow tests to freely assign mocked constructors or factories
    SpeechRecognition: { new (): any } | any;
    webkitSpeechRecognition: { new (): any } | any;
  }

  // Provide a global value so un-imported references to `TypingIndicator` in tests resolve
  const TypingIndicator: React.ComponentType<any> | undefined;

  // Also allow using <TypingIndicator .../> as a global JSX intrinsic element in tests
  namespace JSX {
    interface IntrinsicElements {
      TypingIndicator: { typing?: boolean; users?: string[] | undefined; className?: string };
    }
  }

  // Minimal typings for bun:test's mock helpers used in tests
  // Allow mock.fn() style usage and mock.module()
  // Keep mock as any to align with bun:test runtime shape in tests
  let mock: any;
}

// Provide a global mockSettings object used in some tests
declare const mockSettings: any;


