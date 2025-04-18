import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Window } from 'happy-dom';
import { expect } from 'vitest';

// Create a new window
const window = new Window();
const document = window.document;

// Create and append body if it doesn't exist
if (!document.body) {
  const body = document.createElement('body');
  document.appendChild(body);
}

// Setup global objects
global.window = window;
global.document = document;
global.navigator = window.navigator;
global.HTMLElement = window.HTMLElement;
global.Element = window.Element;
global.Node = window.Node;
global.DocumentFragment = window.DocumentFragment;
global.localStorage = {
  getItem: (key: string) => null,
  setItem: (key: string, value: string) => {},
  removeItem: (key: string) => {},
  clear: () => {},
  key: (index: number) => null,
  length: 0,
};

// Mock ResizeObserver
class MockResizeObserver implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = MockResizeObserver;

// Mock IntersectionObserver
class MockIntersectionObserver implements IntersectionObserver {
  root: Element | null = null;
  rootMargin: string = '0px';
  thresholds: ReadonlyArray<number> = [0];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
}
global.IntersectionObserver = MockIntersectionObserver;

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }),
});

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback: FrameRequestCallback): number => {
  return setTimeout(() => callback(Date.now()), 0) as unknown as number;
};

// Mock cancelAnimationFrame
global.cancelAnimationFrame = (handle: number): void => {
  clearTimeout(handle);
};

// Clean up after each test
afterEach(() => {
  cleanup();
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
