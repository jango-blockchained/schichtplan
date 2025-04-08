import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ScheduleView from '../components/schedule/ScheduleView';
import * as apiService from '../services/api';

// Mock the API service
vi.mock('../services/api', () => ({
  getScheduleVersions: vi.fn(),
  getScheduleByVersion: vi.fn(),
  generateSchedule: vi.fn(),
  updateScheduleVersionStatus: vi.fn(),
  createScheduleVersion: vi.fn()
}));

// Create a QueryClient for testing
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      cacheTime: 0,
      staleTime: 0,
      refetchOnWindowFocus: false,
    },
  },
});

// Mock data
const mockVersions = [
  {
    version: 2,
    status: 'DRAFT',
    date_range_start: '2023-05-01',
    date_range_end: '2023-05-07',
    created_at: '2023-04-25T10:00:00Z'
  },
  {
    version: 1,
    status: 'PUBLISHED',
    date_range_start: '2023-04-01',
    date_range_end: '2023-04-07',
    created_at: '2023-03-25T10:00:00Z'
  }
];

const mockScheduleEntries = [
  {
    id: 1,
    employee_id: 1,
    employee_name: 'John Doe',
    shift_id: 1,
    shift_start: '08:00',
    shift_end: '16:00',
    date: '2023-05-01',
    version: 2,
    status: 'DRAFT'
  },
  {
    id: 2,
    employee_id: 2,
    employee_name: 'Jane Smith',
    shift_id: 2,
    shift_start: '14:00',
    shift_end: '22:00',
    date: '2023-05-01',
    version: 2,
    status: 'DRAFT'
  }
];

// Wrapper component with QueryClientProvider
const renderWithQueryClient = (ui: React.ReactElement) => {
  const testQueryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={testQueryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe('ScheduleView Component', () => {
  beforeEach(() => {
    // Setup mocks for each test
    vi.mocked(apiService.getScheduleVersions).mockResolvedValue(mockVersions);
    vi.mocked(apiService.getScheduleByVersion).mockResolvedValue(mockScheduleEntries);
    vi.mocked(apiService.generateSchedule).mockResolvedValue({ newVersion: 3, status: 'DRAFT', entryCount: 14 });
    vi.mocked(apiService.updateScheduleVersionStatus).mockResolvedValue({ version: 2, status: 'PUBLISHED' });
    vi.mocked(apiService.createScheduleVersion).mockResolvedValue({ new_version: 3, status: 'DRAFT_CREATED' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('renders schedule view with versions dropdown', async () => {
    renderWithQueryClient(<ScheduleView />);
    
    // Wait for versions to load
    await waitFor(() => {
      expect(apiService.getScheduleVersions).toHaveBeenCalled();
    });
    
    // Check if the component shows version dropdown
    expect(screen.getByText(/schedule versions/i)).toBeInTheDocument();
    
    // Verify version dropdown contains version options
    await waitFor(() => {
      expect(screen.getByText(/version 2/i)).toBeInTheDocument();
    });
  });

  test('loads schedule data when version is selected', async () => {
    renderWithQueryClient(<ScheduleView />);
    
    // Wait for versions to load
    await waitFor(() => {
      expect(apiService.getScheduleVersions).toHaveBeenCalled();
    });
    
    // Select a version
    const versionSelect = screen.getByLabelText(/select version/i);
    fireEvent.change(versionSelect, { target: { value: '2' } });
    
    // Verify the schedule data is loaded
    await waitFor(() => {
      expect(apiService.getScheduleByVersion).toHaveBeenCalledWith(2);
    });
    
    // Check if employee names are displayed in the schedule
    await waitFor(() => {
      expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      expect(screen.getByText(/jane smith/i)).toBeInTheDocument();
    });
  });

  test('publishes a schedule version', async () => {
    renderWithQueryClient(<ScheduleView />);
    
    // Wait for versions to load
    await waitFor(() => {
      expect(apiService.getScheduleVersions).toHaveBeenCalled();
    });
    
    // Select a draft version
    const versionSelect = screen.getByLabelText(/select version/i);
    fireEvent.change(versionSelect, { target: { value: '2' } });
    
    // Find and click publish button
    const publishButton = screen.getByText(/publish/i);
    fireEvent.click(publishButton);
    
    // Confirm in the dialog
    const confirmButton = screen.getByText(/confirm/i);
    fireEvent.click(confirmButton);
    
    // Verify the API was called to update status
    await waitFor(() => {
      expect(apiService.updateScheduleVersionStatus).toHaveBeenCalledWith(2, 'PUBLISHED');
    });
    
    // Verify schedule versions were refetched
    await waitFor(() => {
      expect(apiService.getScheduleVersions).toHaveBeenCalledTimes(2);
    });
  });

  test('creates a new schedule version', async () => {
    renderWithQueryClient(<ScheduleView />);
    
    // Open the new version dialog
    const newVersionButton = screen.getByText(/new version/i);
    fireEvent.click(newVersionButton);
    
    // Fill the form
    const startDateInput = screen.getByLabelText(/start date/i);
    const endDateInput = screen.getByLabelText(/end date/i);
    
    fireEvent.change(startDateInput, { target: { value: '2023-06-01' } });
    fireEvent.change(endDateInput, { target: { value: '2023-06-07' } });
    
    // Submit the form
    const createButton = screen.getByText(/create/i);
    fireEvent.click(createButton);
    
    // Verify the API was called
    await waitFor(() => {
      expect(apiService.createScheduleVersion).toHaveBeenCalledWith({
        start_date: '2023-06-01',
        end_date: '2023-06-07',
        notes: ''
      });
    });
    
    // Verify schedule versions were refetched
    await waitFor(() => {
      expect(apiService.getScheduleVersions).toHaveBeenCalledTimes(2);
    });
  });

  test('generates a new schedule', async () => {
    renderWithQueryClient(<ScheduleView />);
    
    // Open the generate schedule dialog
    const generateButton = screen.getByText(/generate/i);
    fireEvent.click(generateButton);
    
    // Fill the form
    const startDateInput = screen.getByLabelText(/start date/i);
    const endDateInput = screen.getByLabelText(/end date/i);
    
    fireEvent.change(startDateInput, { target: { value: '2023-06-01' } });
    fireEvent.change(endDateInput, { target: { value: '2023-06-07' } });
    
    // Submit the form
    const generateConfirmButton = screen.getByText(/generate schedule/i);
    fireEvent.click(generateConfirmButton);
    
    // Verify the API was called
    await waitFor(() => {
      expect(apiService.generateSchedule).toHaveBeenCalledWith('2023-06-01', '2023-06-07');
    });
    
    // Verify schedule versions were refetched
    await waitFor(() => {
      expect(apiService.getScheduleVersions).toHaveBeenCalledTimes(2);
    });
    
    // Verify new version was loaded
    await waitFor(() => {
      expect(apiService.getScheduleByVersion).toHaveBeenCalledWith(3);
    });
  });
}); 