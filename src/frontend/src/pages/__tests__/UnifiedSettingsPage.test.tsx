import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { render, screen } from '../../test-utils/test-utils';
import UnifiedSettingsPage from '../UnifiedSettingsPage';
import * as api from '../../services/api';
import type { Settings } from '../../types';

// Create a mock settings object that matches the expected structure
const mockSettings: Partial<Settings> = {
  actions: {
    demo_data: {
      last_execution: null,
      selected_module: "",
    }
  },
  general: {
    store_name: 'Test Store',
    store_address: '123 Test St',
    store_contact: '123-456-7890',
    store_opening: '09:00',
    store_closing: '17:00',
    timezone: 'UTC',
    language: 'en',
    date_format: 'DD/MM/YYYY',
    time_format: '24h',
    opening_days: {
      '0': true, // Sunday
      '1': true, // Monday
      '2': true, // Tuesday
      '3': true, // Wednesday
      '4': true, // Thursday
      '5': true, // Friday
      '6': true // Saturday
    }
  },
  display: {
    theme: 'light',
    accent_color: '#FF4081',
    primary_color: '#1976D2',
    secondary_color: '#424242',
    background_color: '#FFFFFF',
    surface_color: '#F5F5F5',
    text_color: '#212121'
  },
  scheduling: {
    enable_diagnostics: false,
    generation_requirements: {
      min_shift_coverage: 1,
      max_weekly_hours: 40,
      min_weekly_hours: 10,
      max_consecutive_days: 5
    }
  },
  ai_scheduling: {
    enabled: true,
    api_key: 'test-api-key'
  },
  employee_groups: {
    types: [
      { id: 1, name: 'Full-time', color: '#4CAF50', max_weekly_hours: 40 },
      { id: 2, name: 'Part-time', color: '#2196F3', max_weekly_hours: 20 }
    ]
  },
  availability_types: {
    types: [
      { id: 1, name: 'Fixed', color: '#4CAF50', priority: 1 },
      { id: 2, name: 'Preferred', color: '#2196F3', priority: 2 },
      { id: 3, name: 'Available', color: '#FFC107', priority: 3 }
    ]
  }
};

// Mock the API functions
const mockGetSettings = mock(() => Promise.resolve(mockSettings));
const mockUpdateSettings = mock((settings: any) => Promise.resolve(settings));

// Replace the original functions with mocks
mock(() => {
  (api.getSettings as any) = mockGetSettings;
  (api.updateSettings as any) = mockUpdateSettings;
});

describe('UnifiedSettingsPage', () => {
  beforeEach(() => {
    mockGetSettings.mockReset();
    mockUpdateSettings.mockReset();
    mockGetSettings.mockReturnValue(Promise.resolve(mockSettings));
    render(<UnifiedSettingsPage />);
  });

  it('renders the page title', async () => {
    const pageTitle = await screen.findByText('Unified Settings');
    expect(pageTitle).toBeDefined();
  });

  it('renders the section navigation buttons', async () => {
    // Check for the section buttons
    const generalSection = await screen.findByText('General Store Setup');
    const schedulingSection = await screen.findByText('Scheduling Engine');
    const employeeSection = await screen.findByText('Employee & Shift Definitions');
    const availabilitySection = await screen.findByText('Availability Configuration');
    const appearanceSection = await screen.findByText('Appearance & Display');
    const integrationsSection = await screen.findByText('Integrations & AI');
    const dataSection = await screen.findByText('Data Management');
    const notificationsSection = await screen.findByText('Notifications');

    expect(generalSection).toBeDefined();
    expect(schedulingSection).toBeDefined();
    expect(employeeSection).toBeDefined();
    expect(availabilitySection).toBeDefined();
    expect(appearanceSection).toBeDefined();
    expect(integrationsSection).toBeDefined();
    expect(dataSection).toBeDefined();
    expect(notificationsSection).toBeDefined();
  });

  it('renders the general store setup section by default', async () => {
    // Verify that getSettings was called
    expect(api.getSettings).toHaveBeenCalled();
    
    // Look for content specific to the general store setup section
    const storeName = await screen.findByText('Test Store');
    expect(storeName).toBeDefined();
  });

  it('handles settings update', async () => {
    // Simulate updating a setting
    await api.updateSettings({
      display: {
        theme: 'dark',
      },
    } as any);

    expect(mockUpdateSettings.mock.calls.length).toBe(1);
    expect(mockUpdateSettings.mock.calls[0][0]).toEqual({
      display: {
        theme: 'dark',
      },
    });
  });

  // Add more tests for different sections and interactions
}); 