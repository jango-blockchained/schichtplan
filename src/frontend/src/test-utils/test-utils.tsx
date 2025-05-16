import { afterEach } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../providers/ThemeProvider";
import { JSDOM } from "jsdom";
import "@testing-library/jest-dom";

// Set up a basic DOM environment
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
  pretendToBeVisual: true,
});

// Set up global objects
global.window = dom.window as unknown as Window & typeof globalThis;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.getComputedStyle = dom.window.getComputedStyle;
global.requestAnimationFrame = (callback) => setTimeout(callback, 0);

// Mock getComputedStyle
global.window.getComputedStyle = (element: Element) => ({
  getPropertyValue: (prop: string) => "",
  ...({} as CSSStyleDeclaration),
});

// Mock matchMedia
global.window.matchMedia = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
});

// Mock localStorage
const localStorageMock = {
  getItem: (key: string) => null,
  setItem: (key: string, value: string) => {},
  removeItem: (key: string) => {},
  clear: () => {},
  length: 0,
  key: (index: number) => null,
};

global.localStorage = localStorageMock;

// Create a new QueryClient for each test
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

// Custom render function that includes providers
function customRender(
  ui: React.ReactElement,
  { queryClient = createTestQueryClient(), ...options } = {},
) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>,
    options,
  );
}

// Clean up after each test
afterEach(() => {
  cleanup();
  localStorage.clear();
});

// Re-export everything
export * from "@testing-library/react";
export { customRender as render };
