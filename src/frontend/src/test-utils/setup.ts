import { expect } from "bun:test";
import * as matchers from "@testing-library/jest-dom/matchers";
import {
  TextEncoder as NodeTextEncoder,
  TextDecoder as NodeTextDecoder,
} from "util";
import { Window } from "happy-dom";
import "@testing-library/jest-dom";
import { beforeAll, beforeEach, afterEach } from "bun:test";
import { cleanup } from "@testing-library/react";

// Add jest-dom matchers to Bun's expect
Object.assign(expect, matchers);

// Create a new window with happy-dom
const window = new Window();
const document = window.document;

// Create and append body if it doesn't exist
if (!document.body) {
  const body = document.createElement("body");
  document.appendChild(body);
}

// Setup global objects
Object.defineProperty(globalThis, "window", { value: window });
Object.defineProperty(globalThis, "document", { value: document });
Object.defineProperty(globalThis, "navigator", { value: window.navigator });
Object.defineProperty(globalThis, "DocumentFragment", {
  value: window.DocumentFragment,
});
Object.defineProperty(globalThis, "Element", { value: window.Element });
Object.defineProperty(globalThis, "HTMLElement", { value: window.HTMLElement });
Object.defineProperty(globalThis, "HTMLInputElement", {
  value: window.HTMLInputElement,
});
Object.defineProperty(globalThis, "HTMLSelectElement", {
  value: window.HTMLSelectElement,
});
Object.defineProperty(globalThis, "Node", { value: window.Node });
Object.defineProperty(globalThis, "Event", { value: window.Event });
Object.defineProperty(globalThis, "getComputedStyle", {
  value: window.getComputedStyle.bind(window),
});

// Mock window.matchMedia
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

// Reset the DOM after each test
// Remove this beforeEach block
/*
beforeEach(() => {
  if (!document.body) {
    console.error("!!! document.body does NOT exist in beforeEach !!!");
  } else {
    // console.log("--- document.body exists in beforeEach ---"); // Optional: uncomment for positive confirmation
  }
  cleanup();
  // Enable pointer events for testing
  document.body.style.pointerEvents = "auto";
});
*/

// Add cleanup in afterEach
afterEach(() => {
  cleanup();
});

// Polyfill for TextEncoder/TextDecoder
global.TextEncoder = NodeTextEncoder as typeof global.TextEncoder;
global.TextDecoder = NodeTextDecoder as typeof global.TextDecoder;

// Polyfill for requestAnimationFrame
if (typeof global.requestAnimationFrame === 'undefined') {
  global.requestAnimationFrame = (callback: FrameRequestCallback): number => {
    // Simple timeout based polyfill for testing environments
    const handle = setTimeout(callback, 0);
    // Return a number handle (required by the type)
    // In a real browser this would be more sophisticated
    // We convert the Timeout object to a number for type compatibility
    return Number(handle); 
  };
}

// Mock MutationObserver
class MockMutationObserver implements MutationObserver {
  observe(_target: Node, _options?: MutationObserverInit): void {}
  disconnect(): void {}
  takeRecords(): MutationRecord[] {
    return [];
  }
}
global.MutationObserver = MockMutationObserver;

// Mock Element.prototype methods that might be missing
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// Add ResizeObserver
global.ResizeObserver = class ResizeObserver
  implements globalThis.ResizeObserver
{
  observe(_target: Element): void {}
  unobserve(_target: Element): void {}
  disconnect(): void {}
};

// Add missing focus management APIs
document.hasFocus = () => true;

// Add missing event handling for legacy browsers
interface LegacyElement extends Element {
  attachEvent(event: string, handler: EventListener): void;
  detachEvent(event: string, handler: EventListener): void;
}

(Element.prototype as LegacyElement).attachEvent = function (
  event: string,
  handler: EventListener,
): void {
  this.addEventListener(event.slice(2), handler);
};

(Element.prototype as LegacyElement).detachEvent = function (
  event: string,
  handler: EventListener,
): void {
  this.removeEventListener(event.slice(2), handler);
};

// Export test utilities
export { expect };
