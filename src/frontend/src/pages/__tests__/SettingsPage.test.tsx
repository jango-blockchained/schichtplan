import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { render, screen } from '../../test-utils/test-utils';
import { SettingsPage } from '../SettingsPage';
import * as api from '../../services/api';
import type { Settings } from '../../types';

// Mock the API functions
const mockGetSettings = mock(() => Promise.resolve({
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
    time_format: '24h'
  },
  display: {
    theme: 'light',
    accent_color: '#FF4081',
    primary_color: '#1976D2',
    secondary_color: '#424242',
    background_color: '#FFFFFF',
    surface_color: '#F5F5F5',
    text_color: '#212121'
  }
}));

const mockUpdateSettings = mock((settings: any) => Promise.resolve(settings));

// Replace the original functions with mocks
mock(() => {
  (api.getSettings as any) = mockGetSettings;
  (api.updateSettings as any) = mockUpdateSettings;
});

describe('SettingsPage', () => {
  beforeEach(() => {
    mockGetSettings.mockReset();
    mockUpdateSettings.mockReset();
    render(<SettingsPage />);
  });

  it('renders the store name', async () => {
    const storeName = await screen.findByText('Test Store');
    expect(storeName).toBeDefined();
  });

  it('renders the settings form', async () => {
    const storeNameInput = await screen.findByLabelText('Store Name');
    expect(storeNameInput).toBeDefined();
  });

  it('renders the settings page', async () => {
    // Wait for the store name to appear
    const storeName = await screen.findByText('Test Store');
    expect(storeName).toBeDefined();

    // Verify that getSettings was called
    expect(api.getSettings).toHaveBeenCalled();
  });

  it('renders the settings page with title', async () => {
    // Check for the page title
    const title = await screen.findByText('Settings');
    expect(title).toBeDefined();
  });

  it('handles settings update', async () => {
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
}); 