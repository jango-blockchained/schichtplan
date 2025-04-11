import { afterEach } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../providers/ThemeProvider";
// import { JSDOM } from "jsdom"; // REMOVED - Rely on setup.ts (happy-dom)
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom"; // Import MemoryRouter
// Removed explicit HappyDOM setup

// Mock localStorage (Keep this, may be needed specifically for tests using this util)
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
        return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

// Assign mock only if localStorage doesn't exist (setup.ts might provide one)
if (typeof global.localStorage === 'undefined') {
    Object.defineProperty(global, 'localStorage', {
        value: localStorageMock,
        writable: false, // Prevent accidental overwrite
    });
}

// MOVED UP: Create a new QueryClient for each test
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries for tests
        gcTime: Infinity, // Prevent garbage collection during tests
      },
    },
    // logger: { // Uncomment for debugging react-query
    //   log: console.log,
    //   warn: console.warn,
    //   error: console.error,
    // },
  });

// Custom render function that includes providers
function customRender(
  ui: React.ReactElement,
  { queryClient = createTestQueryClient(), ...options } = {},
) {
  return render(
    // Added MemoryRouter
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>{ui}</ThemeProvider>
      </QueryClientProvider>
    </MemoryRouter>,
    options,
  );
}

// Clean up after each test
afterEach(() => {
  cleanup(); // Cleans up React Testing Library DOM
  // Clear mock storage if it was assigned by this file
  if (global.localStorage === localStorageMock) {
      localStorageMock.clear();
  }
});

// Re-exporting custom render
export { customRender as render };
