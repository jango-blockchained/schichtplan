// Lightweight test globals used by many unit tests
import type { Settings } from "../types";

export const mockSettings: Settings = {
  general: {
    store_name: "Test Store",
    timezone: "Europe/Berlin",
  } as any,
  display: {
    theme: "light",
  } as any,
} as unknown as Settings;

// Simple api mock used by page tests
// Lightweight spy wrapper so tests can assert call counts and args
function makeSpy<T extends (...args: any[]) => any>(fn: T) {
  const calls: any[] = [];
  const spy: any = (...args: any[]) => {
    calls.push(args);
    return (fn as any)(...args);
  };
  spy.calls = calls;
  spy.mockClear = () => { calls.length = 0; };
  spy.toHaveBeenCalled = () => calls.length > 0;
  spy.toHaveBeenCalledTimes = (n: number) => calls.length === n;
  spy.toHaveBeenCalledWith = (...expected: any[]) => calls.some((c: any[]) => JSON.stringify(c) === JSON.stringify(expected));
  return spy as T & { calls: any[] };
}

export const api = {
  getSettings: makeSpy(async () => Promise.resolve(mockSettings)),
  updateSettings: makeSpy(async (s: Partial<Settings>) => Promise.resolve(s)),
};

// Attach to globalThis for tests that expect globals
(globalThis as any).mockSettings = mockSettings;
(globalThis as any).api = api;

export default {};
