import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { render } from "@/test-utils/test-utils";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { SettingsPage } from "../SettingsPage";
import * as api from "../../services/api";
import type { Settings } from "../../types";
import { Window } from 'happy-dom';

// Mock the API functions
const mockGetSettings = mock<() => Promise<Partial<Settings>>>(() =>
  Promise.resolve({
    store_name: "Test Store",
    theme: "light",
  }),
);

const mockUpdateSettings = mock<(settings: Partial<Settings>) => Promise<Partial<Settings>>>((settings) => Promise.resolve(settings));

// Replace the original functions with mocks using Bun's API
(mock as any).module("@/services/api", () => ({
  getSettings: mockGetSettings,
  updateSettings: mockUpdateSettings,
  // Mock other exports from api if needed by SettingsPage, otherwise keep minimal
  generateDemoData: mock(() => Promise.resolve()),
  generateOptimizedDemoData: mock(() => Promise.resolve()),
  resetOptimizedDemoDataStatus: mock(() => Promise.resolve()),
  backupDatabase: mock(() => Promise.resolve(new Blob())),
  restoreDatabase: mock(() => Promise.resolve()),
  wipeTables: mock(() => Promise.resolve()),
}));

// Mock the useTheme hook using Bun's mock.module
(mock as any).module("@/hooks/use-theme", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: mock(() => {}), // Use Bun's mock fn
  }),
}));

describe("SettingsPage", () => {
  let happyWindow: Window | null = null;

  beforeEach(() => {
    // Create and setup happy-dom window *before* rendering
    happyWindow = new Window();
    (global as any).window = happyWindow;
    (global as any).document = happyWindow.document;
    (global as any).navigator = happyWindow.navigator;
    (global as any).Node = happyWindow.Node;
    (global as any).Text = happyWindow.Text;
    (global as any).Comment = happyWindow.Comment;
    (global as any).Element = happyWindow.Element;
    (global as any).HTMLElement = happyWindow.HTMLElement;
    (global as any).SVGElement = happyWindow.SVGElement;
    (global as any).HTMLInputElement = happyWindow.HTMLInputElement;
    (global as any).HTMLSelectElement = happyWindow.HTMLSelectElement;
    (global as any).HTMLTextAreaElement = happyWindow.HTMLTextAreaElement;
    (global as any).HTMLButtonElement = happyWindow.HTMLButtonElement;
    (global as any).requestAnimationFrame = happyWindow.requestAnimationFrame;
    (global as any).cancelAnimationFrame = happyWindow.cancelAnimationFrame;
    (global as any).getComputedStyle = happyWindow.getComputedStyle;
    
    // Use Object.defineProperty to set storage properties
    Object.defineProperty(global, 'localStorage', {
      value: happyWindow.localStorage,
      writable: true, // Allow modification/clearing if needed
      configurable: true, 
    });
    Object.defineProperty(global, 'sessionStorage', {
      value: happyWindow.sessionStorage,
      writable: true,
      configurable: true,
    });

    mockGetSettings.mockClear();
    mockUpdateSettings.mockClear();
    // Ensure any mocks from useTheme are cleared if stateful
    render(<SettingsPage />); // Render *after* setting up happy-dom
  });

  afterEach(() => {
    // Clean up happy-dom window after each test
    happyWindow?.happyDOM.cancelAsync();
    happyWindow = null;
    // Clean up globals defined in beforeEach
    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).navigator;
    delete (global as any).Node;
    delete (global as any).Text;
    delete (global as any).Comment;
    delete (global as any).Element;
    delete (global as any).HTMLElement;
    delete (global as any).SVGElement;
    delete (global as any).HTMLInputElement;
    delete (global as any).HTMLSelectElement;
    delete (global as any).HTMLTextAreaElement;
    delete (global as any).HTMLButtonElement;
    delete (global as any).requestAnimationFrame;
    delete (global as any).cancelAnimationFrame;
    delete (global as any).getComputedStyle;
    delete (global as any).localStorage;
    delete (global as any).sessionStorage;
  });

  it("renders the store name", async () => {
    const storeName = await screen.findByText("Test Store");
    expect(storeName).toBeDefined();
  });

  it("renders the settings form", async () => {
    const storeNameInput = await screen.findByLabelText("Store Name");
    expect(storeNameInput).toBeDefined();
  });

  it("renders the settings page", async () => {
    // Wait for the store name to appear
    const storeName = await screen.findByText("Test Store");
    expect(storeName).toBeDefined();

    // Verify that getSettings was called
    expect(api.getSettings).toHaveBeenCalled();
  });

  it("renders the settings page with title", async () => {
    const title = await screen.findByText("Settings");
    expect(title).toBeDefined();
    // Wait for initial data load
    await screen.findByText("Test Store");
    expect(api.getSettings).toHaveBeenCalled();
  });

  it("handles settings update", async () => {
    // Use Bun's fake timers
    (mock as any).timers.enable();

    // Wait for initial settings to load and the component to render
    await waitFor(() => {
      expect(screen.getByLabelText("Store Name")).toHaveValue(
        "Test Store",
      );
    });

    // Find the theme switch
    const themeSwitch = screen.getByRole("switch", { name: /theme/i });

    // Simulate clicking the switch to change the theme (light -> dark)
    fireEvent.click(themeSwitch);

    // Advance Bun's timers by 1 second
    (mock as any).timers.tick(1000);

    // Check if updateSettings was called correctly after the debounce
    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledTimes(1);
    });
    expect(mockUpdateSettings).toHaveBeenCalledWith({ theme: "dark" });

    // Restore real timers using Bun's API
    (mock as any).timers.disable();
  });

  it("handles settings update when theme is changed", async () => {
    // Enable fake timers if this path also uses debounce
    // (mock as any).timers.enable(); 

    // 1. Wait for initial render/data
    await screen.findByText("General Settings");

    // 2. Find the Theme Toggle button by its accessible name
    const themeToggleButton = screen.getByRole("button", { name: /toggle theme/i });
    expect(themeToggleButton).toBeDefined();

    // 3. Simulate clicking the toggle button (state update wrapped in act)
    await act(async () => {
      fireEvent.click(themeToggleButton);
      // Advance timers if needed
      // (mock as any).timers.tick(1000);
    });

    // 4. Assert that the update function was called
    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalled();
    });

    // Find the specific call that updated the theme
    const updateCall = mockUpdateSettings.mock.calls.find(
        (call: [Partial<Settings>]) => call[0]?.theme !== undefined
    );

    // Assert the call structure and the new theme value
    expect(updateCall).toBeDefined();
    expect(updateCall?.[0]?.theme).toMatch(/dark|system/i);

    // Disable fake timers if enabled
    // (mock as any).timers.disable(); 
  });
});
