import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShiftsPage } from '../ShiftsPage';
import { getShifts, createShift, updateShift, deleteShift, createDefaultShifts } from '../../services/api';
import { ShiftType } from '../../types';

// Mock the API functions
jest.mock('../../services/api', () => ({
  getShifts: jest.fn(),
  createShift: jest.fn(),
  updateShift: jest.fn(),
  deleteShift: jest.fn(),
  createDefaultShifts: jest.fn(),
}));

describe('ShiftsPage', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const mockShifts = [
    {
      id: 1,
      shift_type: ShiftType.EARLY,
      start_time: '09:00',
      end_time: '17:00',
      min_employees: 2,
      max_employees: 4,
      duration_hours: 8,
      requires_break: true,
    },
    {
      id: 2,
      shift_type: ShiftType.LATE,
      start_time: '14:00',
      end_time: '22:00',
      min_employees: 2,
      max_employees: 4,
      duration_hours: 8,
      requires_break: true,
    },
  ];

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    // Setup default mock implementations
    (getShifts as jest.Mock).mockResolvedValue(mockShifts);
    (createShift as jest.Mock).mockResolvedValue({ id: 3 });
    (updateShift as jest.Mock).mockResolvedValue({ success: true });
    (deleteShift as jest.Mock).mockResolvedValue({ success: true });
    (createDefaultShifts as jest.Mock).mockResolvedValue({ count: 3 });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ShiftsPage />
      </QueryClientProvider>
    );
  };

  it('renders the shifts page with title', async () => {
    renderComponent();
    expect(screen.getByText('Schichten')).toBeInTheDocument();
    await waitFor(() => {
      expect(getShifts).toHaveBeenCalled();
    });
  });

  it('displays shifts in the table', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Frühschicht')).toBeInTheDocument();
      expect(screen.getByText('09:00')).toBeInTheDocument();
      expect(screen.getByText('17:00')).toBeInTheDocument();
    });
  });

  it('opens create shift dialog when add button is clicked', async () => {
    renderComponent();
    fireEvent.click(screen.getByText('Schicht hinzufügen'));
    expect(screen.getByText('Neue Schicht')).toBeInTheDocument();
  });

  it('creates a new shift successfully', async () => {
    renderComponent();
    fireEvent.click(screen.getByText('Schicht hinzufügen'));

    // Fill in the form
    fireEvent.change(screen.getByLabelText('Beginn'), {
      target: { value: '09:00' },
    });
    fireEvent.change(screen.getByLabelText('Ende'), {
      target: { value: '17:00' },
    });
    fireEvent.change(screen.getByLabelText('Mindestanzahl Mitarbeiter'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('Maximalanzahl Mitarbeiter'), {
      target: { value: '4' },
    });

    // Submit the form
    fireEvent.click(screen.getByText('Erstellen'));

    await waitFor(() => {
      expect(createShift).toHaveBeenCalledWith({
        shift_type: ShiftType.EARLY,
        start_time: '09:00',
        end_time: '17:00',
        min_employees: 2,
        max_employees: 4,
      });
    });
  });

  it('edits an existing shift', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Frühschicht')).toBeInTheDocument();
    });

    // Click edit button on first shift
    const editButtons = await screen.findAllByText('Bearbeiten');
    fireEvent.click(editButtons[0]);

    // Change some values
    fireEvent.change(screen.getByLabelText('Ende'), {
      target: { value: '18:00' },
    });

    // Submit the form
    fireEvent.click(screen.getByText('Speichern'));

    await waitFor(() => {
      expect(updateShift).toHaveBeenCalledWith(1, expect.objectContaining({
        end_time: '18:00',
      }));
    });
  });

  it('deletes a shift after confirmation', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Frühschicht')).toBeInTheDocument();
    });

    // Click delete button on first shift
    const deleteButtons = await screen.findAllByText('Löschen');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(deleteShift).toHaveBeenCalledWith(1);
    });
  });

  it('creates default shifts', async () => {
    renderComponent();
    fireEvent.click(screen.getByText('Standardschichten erstellen'));

    await waitFor(() => {
      expect(createDefaultShifts).toHaveBeenCalled();
    });
  });

  it('shows error message when loading shifts fails', async () => {
    (getShifts as jest.Mock).mockRejectedValue(new Error('Failed to load shifts'));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Fehler beim Laden der Schichten')).toBeInTheDocument();
    });
  });
}); 