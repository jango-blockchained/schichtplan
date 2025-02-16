import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SettingsPage } from '../SettingsPage';
import { getStoreConfig, updateStoreConfig, resetStoreConfig } from '../../services/api';

// Mock the API functions
jest.mock('../../services/api', () => ({
  getStoreConfig: jest.fn(),
  updateStoreConfig: jest.fn(),
  resetStoreConfig: jest.fn(),
}));

describe('SettingsPage', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const mockConfig = {
    id: 1,
    store_name: 'TEDI Testfiliale',
    opening_time: '09:00',
    closing_time: '20:00',
    min_employees_per_shift: 2,
    max_employees_per_shift: 5,
    break_duration_minutes: 30,
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    // Setup default mock implementations
    (getStoreConfig as jest.Mock).mockResolvedValue(mockConfig);
    (updateStoreConfig as jest.Mock).mockResolvedValue({ success: true });
    (resetStoreConfig as jest.Mock).mockResolvedValue(mockConfig);
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <SettingsPage />
      </QueryClientProvider>
    );
  };

  it('renders the settings page with title', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Filialeinstellungen')).toBeInTheDocument();
    });
  });

  it('displays store configuration', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByDisplayValue('TEDI Testfiliale')).toBeInTheDocument();
      expect(screen.getByDisplayValue('09:00')).toBeInTheDocument();
      expect(screen.getByDisplayValue('20:00')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2')).toBeInTheDocument();
      expect(screen.getByDisplayValue('5')).toBeInTheDocument();
      expect(screen.getByDisplayValue('30')).toBeInTheDocument();
    });
  });

  it('updates store configuration successfully', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByDisplayValue('TEDI Testfiliale')).toBeInTheDocument();
    });

    // Change store name
    fireEvent.change(screen.getByLabelText('Filialname'), {
      target: { value: 'TEDI Neustadt' },
    });

    // Change opening time
    fireEvent.change(screen.getByLabelText('Öffnungszeit'), {
      target: { value: '08:00' },
    });

    // Submit changes
    fireEvent.click(screen.getByText('Änderungen speichern'));

    await waitFor(() => {
      expect(updateStoreConfig).toHaveBeenCalledWith(expect.objectContaining({
        store_name: 'TEDI Neustadt',
        opening_time: '08:00',
      }));
    });
  });

  it('resets store configuration to defaults', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByDisplayValue('TEDI Testfiliale')).toBeInTheDocument();
    });

    // Click reset button
    fireEvent.click(screen.getByText('Auf Standard zurücksetzen'));

    await waitFor(() => {
      expect(resetStoreConfig).toHaveBeenCalled();
    });
  });

  it('shows error message when loading configuration fails', async () => {
    (getStoreConfig as jest.Mock).mockRejectedValue(new Error('Failed to load config'));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Fehler beim Laden der Filialeinstellungen')).toBeInTheDocument();
    });
  });

  it('validates numeric inputs', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByDisplayValue('2')).toBeInTheDocument();
    });

    // Try to set invalid values
    fireEvent.change(screen.getByLabelText('Mindestanzahl Mitarbeiter pro Schicht'), {
      target: { value: '-1' },
    });

    fireEvent.change(screen.getByLabelText('Pausendauer (Minuten)'), {
      target: { value: '-15' },
    });

    // Submit changes
    fireEvent.click(screen.getByText('Änderungen speichern'));

    // Verify that the form prevents negative values
    expect(screen.getByLabelText('Mindestanzahl Mitarbeiter pro Schicht')).toHaveAttribute('min', '1');
    expect(screen.getByLabelText('Pausendauer (Minuten)')).toHaveAttribute('min', '0');
  });
}); 