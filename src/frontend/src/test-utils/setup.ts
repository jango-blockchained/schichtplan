import { afterEach, expect } from 'bun:test';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Window } from 'happy-dom';

// Create a new window
const window = new Window();
const document = window.document;

// Create and append body if it doesn't exist
if (!document.body) {
  const body = document.createElement('body');
  document.appendChild(body);
}

// Setup global objects
Object.defineProperty(global, 'window', { value: window });
Object.defineProperty(global, 'document', { value: document });
Object.defineProperty(global, 'navigator', { value: window.navigator });
Object.defineProperty(global, 'HTMLElement', { value: window.HTMLElement });
Object.defineProperty(global, 'Element', { value: window.Element });
Object.defineProperty(global, 'Node', { value: window.Node });
Object.defineProperty(global, 'getComputedStyle', { value: window.getComputedStyle.bind(window) });

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock matchMedia
window.matchMedia = () => ({
  matches: false,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
});

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback: FrameRequestCallback): number => {
  return setTimeout(() => callback(Date.now()), 0);
};

// Mock cancelAnimationFrame
global.cancelAnimationFrame = (handle: number): void => {
  clearTimeout(handle);
};

// Cleanup after each test
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

// Add custom matchers
expect.extend({
  toBeInTheDocument: (received: unknown) => {
    const pass = received !== null && received !== undefined;
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be in the document`
          : `expected ${received} to be in the document`,
    };
  },
});
