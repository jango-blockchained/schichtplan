import "@happy-dom/global-registrator";
import "@testing-library/jest-dom";

// Ensure document and window are available
if (typeof document === "undefined" || !document.body) {
  try {
    const body = document.createElement("body");
    document.documentElement.appendChild(body);
  } catch {
    // Ignore if already exists
  }
}

// Mock window.matchMedia
if (typeof beforeAll !== "undefined") {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {}, // deprecated
        removeListener: () => {}, // deprecated
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {},
      }),
    });
  });
} else {
  // For bun:test
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {}, // deprecated
      removeListener: () => {}, // deprecated
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}
