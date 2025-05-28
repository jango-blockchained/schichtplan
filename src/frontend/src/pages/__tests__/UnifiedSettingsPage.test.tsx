import { describe, it, expect, mock, beforeEach, waitFor } from "bun:test";
import { render, screen, fireEvent } from "../../test-utils/test-utils";
import UnifiedSettingsPage from "../UnifiedSettingsPage";
import type { Settings } from "../../types";
import { act } from "react-dom/test-utils";

// Mock the API functions
const mockGetSettings = mock.fn();
const mockUpdateSettings = mock.fn((settings) => Promise.resolve(settings));

mock.module("../../services/api", () => ({
  getSettings: mockGetSettings,
  updateSettings: mockUpdateSettings,
}));

// Create a mock settings object that matches the expected structure

describe("UnifiedSettingsPage", () => {
  beforeEach(async () => {
    // Add a small delay to ensure DOM is ready
    await new Promise(resolve => setTimeout(resolve, 50));

    // Reset mocks before each test
    mockGetSettings.mockReset();
    mockUpdateSettings.mockReset();

    // Ensure getSettings mock returns the mock data
    mockGetSettings.mockReturnValue(Promise.resolve(mockSettings));
    
    render(<UnifiedSettingsPage />);
  });

  it("renders the page title", async () => {
    const pageTitle = await screen.findByText("Unified Settings");
    expect(pageTitle).toBeDefined();
  });

  it("renders the section navigation buttons", async () => {
    // Check for the section buttons
    const generalSection = await screen.findByText("General Store Setup");
    const schedulingSection = await screen.findByText("Scheduling Engine");
    const employeeSection = await screen.findByText(
      "Employee & Shift Definitions",
    );
    const availabilitySection = await screen.findByText(
      "Availability Configuration",
    );
    const appearanceSection = await screen.findByText("Appearance & Display");
    const integrationsSection = await screen.findByText("Integrations & AI");
    const dataSection = await screen.findByText("Data Management");
    const notificationsSection = await screen.findByText("Notifications");

    expect(generalSection).toBeDefined();
    expect(schedulingSection).toBeDefined();
    expect(employeeSection).toBeDefined();
    expect(availabilitySection).toBeDefined();
    expect(appearanceSection).toBeDefined();
    expect(integrationsSection).toBeDefined();
    expect(dataSection).toBeDefined();
    expect(notificationsSection).toBeDefined();
  });

  it("renders the general store setup section by default and displays data", async () => {
    // Verify that getSettings was called (done in beforeEach implies it, but explicit check is fine)
    expect(api.getSettings).toHaveBeenCalled();

    // The page defaults to the "General Store Setup" section.
    // Check if the store_name from mockSettings is displayed in an input field.
    // Assuming the input field for store name might have a label "Store Name" or similar,
    // or we can find it by its current value if reliably set.
    const storeNameInput = await screen.findByDisplayValue("Test Store") as HTMLInputElement;
    expect(storeNameInput).toBeDefined();
    expect(storeNameInput.value).toBe(mockSettings.general.store_name);

    // Optionally, check another field from the general section
    const timezoneInput = await screen.findByDisplayValue(mockSettings.general.timezone) as HTMLInputElement;
    expect(timezoneInput).toBeDefined();
    expect(timezoneInput.value).toBe(mockSettings.general.timezone);
  });

  it("verifies updateSettings mock is callable", async () => {
    // This test verifies that the mockUpdateSettings is callable and captures arguments correctly.
    await api.updateSettings({
      display: {
        theme: "dark",
      },
    } as Partial<Settings>);

    expect(mockUpdateSettings).toHaveBeenCalledTimes(1);
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      display: {
        theme: "dark",
      },
    });
  });

  it("debounces settings updates on input change", async () => {
    // Ensure the page and initial settings are loaded
    const storeNameInput = await screen.findByDisplayValue(mockSettings.general.store_name) as HTMLInputElement;

    // Simulate changing the store name
    const newStoreName = "New Test Store Name";
    await act(async () => {
      fireEvent.change(storeNameInput, { target: { value: newStoreName } });
    });

    // Check that updateSettings has not been called immediately
    expect(mockUpdateSettings).not.toHaveBeenCalled();

    // Use waitFor to wait for the debounced call to happen
    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 }); // Use a timeout slightly longer than the debounce delay

    // Check the payload of the updateSettings call after waiting
    const expectedPayload = {
      ...mockSettings,
      general: {
        ...mockSettings.general,
        store_name: newStoreName,
      },
    };
    expect(mockUpdateSettings).toHaveBeenCalledWith(expectedPayload);
  });

  // Add more tests for different sections and interactions
});
