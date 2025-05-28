import { afterEach } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../providers/ThemeProvider";
import { JSDOM } from "jsdom";
import "@testing-library/jest-dom";

// Set up a basic DOM environment
// Removed JSDOM setup as it conflicts with happy-dom setup in setup.ts

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
  options = {},
) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={client}>
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
