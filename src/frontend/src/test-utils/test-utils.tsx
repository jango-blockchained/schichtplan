import "@happy-dom/global-registrator";
import "@testing-library/jest-dom";
import { afterEach } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../providers/ThemeProvider";

// Set up a basic DOM environment
// happy-dom global-registrator ensures document/window are available.

// Provide a simple fetch mock and XMLHttpRequest so modules that initialize
// network clients (axios) use these shims during tests.
if (!(globalThis as any).fetch) {
  (globalThis as any).fetch = async (input: RequestInfo) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    let body: any = {};
    if (url.includes("/api/v2/settings")) body = (globalThis as any).mockSettings || {};
    else if (url.includes("/api/v2/files/upload")) body = { id: "file_1", name: "test.txt" };
    else if (url.includes("/api/v2/employees")) body = [];
    else if (url.includes("/api/v2/shifts")) body = [];

    return {
      ok: true,
      status: 200,
      json: async () => body,
    } as Response;
  };
}

if (!(globalThis as any).XMLHttpRequest) {
  class MockXHR {
    method: string = "";
    url: string = "";
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    status: number = 200;
    responseText: string = "";
    open(method: string, url: string) {
      this.method = method;
      this.url = url;
    }
    setRequestHeader() {}
    send(_body?: any) {
      const url = this.url || "";
      let body: any = {};
      if (url.includes("/api/v2/settings")) body = (globalThis as any).mockSettings || {};
      else if (url.includes("/api/v2/employees")) body = [];
      else if (url.includes("/api/v2/shifts")) body = [];
      else if (url.includes("/api/v2/files/upload")) body = { id: "file_1", name: "test.txt" };

      this.status = 200;
      this.responseText = JSON.stringify(body);
      if (this.onload) setTimeout(() => this.onload && this.onload(), 0);
    }
    abort() {}
  }
  (globalThis as any).XMLHttpRequest = MockXHR as any;
}

// Provide a mockable navigator.mediaDevices.getUserMedia so tests can set
// `.mockReturnValue` like they expect.
if (!(globalThis as any).navigator) (globalThis as any).navigator = {};
if (!(globalThis as any).navigator.mediaDevices) (globalThis as any).navigator.mediaDevices = {};
if (!(globalThis as any).navigator.mediaDevices.getUserMedia) {
  const fn: any = (..._args: any[]) => {
    if (typeof fn.mockImplementation === "function") return fn.mockImplementation(..._args);
    if (typeof fn.mockReturnValue !== "undefined") return fn.mockReturnValue;
    return Promise.resolve({ getTracks: () => [], getAudioTracks: () => [], stop: () => {} });
  };
  fn.mockReturnValue = undefined;
  fn.mockImplementation = undefined;
  (globalThis as any).navigator.mediaDevices.getUserMedia = fn;
}

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
function customRender(ui: React.ReactElement, options = {}) {
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
