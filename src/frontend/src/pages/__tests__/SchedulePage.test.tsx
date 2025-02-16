import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { SchedulePage } from '../SchedulePage';
import { generateSchedule, exportSchedule } from '../../services/api';

// Mock the API functions
jest.mock('../../services/api', () => ({
  generateSchedule: jest.fn(),
  exportSchedule: jest.fn(),
}));

describe('SchedulePage', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    // Setup default mock implementations
    (generateSchedule as jest.Mock).mockResolvedValue({ message: 'Schedule generated', total_shifts: 15 });
    (exportSchedule as jest.Mock).mockResolvedValue(new Blob(['PDF content'], { type: 'application/pdf' }));
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <SchedulePage />
        </LocalizationProvider>
      </QueryClientProvider>
    );
  };

  it('renders the schedule page with title', () => {
    renderComponent();
    expect(screen.getByText('Schichtplan')).toBeInTheDocument();
  });

  it('displays the shift table with sample data', () => {
    renderComponent();
    expect(screen.getByText('Mander, Maike')).toBeInTheDocument();
    expect(screen.getByText('Klepzig, Chantal')).toBeInTheDocument();
  });

  it('shows week selection and action buttons', () => {
    renderComponent();
    expect(screen.getByLabelText('Woche auswählen')).toBeInTheDocument();
    expect(screen.getByText('Schichtplan generieren')).toBeInTheDocument();
    expect(screen.getByText('Als PDF exportieren')).toBeInTheDocument();
  });

  it('generates schedule when button is clicked', async () => {
    renderComponent();
    fireEvent.click(screen.getByText('Schichtplan generieren'));

    await waitFor(() => {
      expect(generateSchedule).toHaveBeenCalledWith(expect.any(String), expect.any(String));
    });
  });

  it('exports schedule as PDF when button is clicked', async () => {
    renderComponent();
    fireEvent.click(screen.getByText('Als PDF exportieren'));

    await waitFor(() => {
      expect(exportSchedule).toHaveBeenCalledWith(expect.any(String), expect.any(String));
    });
  });

  it('displays shift details in the table', () => {
    renderComponent();
    
    // Check table headers
    expect(screen.getByText('Name, Vorname')).toBeInTheDocument();
    expect(screen.getByText('Position')).toBeInTheDocument();
    expect(screen.getByText('Plan / Woche')).toBeInTheDocument();
    expect(screen.getByText('Montag')).toBeInTheDocument();
    expect(screen.getByText('Dienstag')).toBeInTheDocument();
    
    // Check employee data
    expect(screen.getAllByText('TZ')[0]).toBeInTheDocument();
    expect(screen.getAllByText('40:00')[0]).toBeInTheDocument();
    expect(screen.getByText('30:00')).toBeInTheDocument();
  });

  it('shows shift times and breaks', () => {
    renderComponent();
    
    // Check shift times
    expect(screen.getAllByText((content, element) => {
      return element?.textContent === 'Beginn: 8:55';
    })[0]).toBeInTheDocument();
    expect(screen.getAllByText((content, element) => {
      return element?.textContent === 'Ende: 18:00';
    })[0]).toBeInTheDocument();
    
    // Check break times
    expect(screen.getAllByText((content, element) => {
      return element?.textContent === 'Pause: 12:00';
    })[0]).toBeInTheDocument();
    expect(screen.getAllByText((content, element) => {
      return element?.textContent === 'Ende: 13:00';
    })[0]).toBeInTheDocument();
  });

  it('disables buttons when no date is selected', async () => {
    renderComponent();

    // Find the DatePicker and trigger its onChange handler
    const datePicker = screen.getByLabelText('Woche auswählen');
    const datePickerInput = datePicker.closest('.MuiFormControl-root')?.querySelector('input');
    if (!datePickerInput) throw new Error('DatePicker input not found');

    // Simulate clearing the date
    fireEvent.change(datePickerInput, { target: { value: '' } });
    fireEvent.blur(datePickerInput);

    // Wait for the state update and verify buttons are disabled
    await waitFor(() => {
      const generateButton = screen.getByText('Schichtplan generieren');
      const exportButton = screen.getByText('Als PDF exportieren');
      expect(generateButton.closest('button')).toHaveAttribute('disabled');
      expect(exportButton.closest('button')).toHaveAttribute('disabled');
    });
  });
}); 