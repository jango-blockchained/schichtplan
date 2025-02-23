import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EmployeesPage } from '../EmployeesPage';
import { getEmployees, createEmployee, updateEmployee, deleteEmployee } from '../../services/api';
import { EmployeeGroup } from '../../types';

// Mock the API functions
jest.mock('../../services/api', () => ({
  getEmployees: jest.fn(),
  createEmployee: jest.fn(),
  updateEmployee: jest.fn(),
  deleteEmployee: jest.fn(),
}));

describe('EmployeesPage', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const mockEmployees = [
    {
      id: 1,
      employee_id: 'MM01',
      first_name: 'Maike',
      last_name: 'Mander',
      employee_group: EmployeeGroup.VZ,
      contracted_hours: 40,
      is_keyholder: true,
      availability: [],
    },
    {
      id: 2,
      employee_id: 'CK02',
      first_name: 'Chantal',
      last_name: 'Klepzig',
      employee_group: EmployeeGroup.TZ,
      contracted_hours: 30,
      is_keyholder: false,
      availability: [],
    },
  ];

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    // Setup default mock implementations
    (getEmployees as jest.Mock).mockResolvedValue(mockEmployees);
    (createEmployee as jest.Mock).mockResolvedValue({ id: 3, employee_id: 'NEW03' });
    (updateEmployee as jest.Mock).mockResolvedValue({ success: true });
    (deleteEmployee as jest.Mock).mockResolvedValue({ success: true });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <EmployeesPage />
      </QueryClientProvider>
    );
  };

  it('renders the employees page with title', async () => {
    renderComponent();
    expect(screen.getByText('Mitarbeiter')).toBeInTheDocument();
    await waitFor(() => {
      expect(getEmployees).toHaveBeenCalled();
    });
  });

  it('displays employees in the table', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Maike Mander')).toBeInTheDocument();
      expect(screen.getByText('MM01')).toBeInTheDocument();
      expect(screen.getByText('VZ')).toBeInTheDocument();
      expect(screen.getByText('40')).toBeInTheDocument();
    });
  });

  it('opens create employee dialog when add button is clicked', async () => {
    renderComponent();
    fireEvent.click(screen.getByText('Mitarbeiter hinzufügen'));
    expect(screen.getByText('Neuer Mitarbeiter')).toBeInTheDocument();
  });

  it('creates a new employee successfully', async () => {
    renderComponent();
    fireEvent.click(screen.getByText('Mitarbeiter hinzufügen'));

    // Fill in the form
    fireEvent.change(screen.getByLabelText('Vorname'), {
      target: { value: 'Max' },
    });
    fireEvent.change(screen.getByLabelText('Nachname'), {
      target: { value: 'Mustermann' },
    });

    // Open the employee group select
    const groupSelect = screen.getByLabelText('Mitarbeitergruppe');
    fireEvent.mouseDown(groupSelect);

    // Wait for the portal to be mounted and select Vollzeit
    await waitFor(() => {
      const menuItem = screen.getByText('Vollzeit (40h)');
      fireEvent.click(menuItem);
    });

    // Submit the form
    fireEvent.click(screen.getByText('Erstellen'));

    await waitFor(() => {
      expect(createEmployee).toHaveBeenCalledWith({
        first_name: 'Max',
        last_name: 'Mustermann',
        employee_group: EmployeeGroup.VZ,
        contracted_hours: 40,
        is_keyholder: false,
        availability: [],
      });
    });
  });

  it('edits an existing employee', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Maike Mander')).toBeInTheDocument();
    });

    // Click edit button on first employee
    const editButtons = await screen.findAllByText('Bearbeiten');
    fireEvent.click(editButtons[0]);

    // Change some values
    fireEvent.change(screen.getByLabelText('Vorname'), {
      target: { value: 'Maria' },
    });

    // Submit the form
    fireEvent.click(screen.getByText('Speichern'));

    await waitFor(() => {
      expect(updateEmployee).toHaveBeenCalledWith(1, expect.objectContaining({
        first_name: 'Maria',
      }));
    });
  });

  it('deletes an employee', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Maike Mander')).toBeInTheDocument();
    });

    // Click delete button on first employee
    const deleteButtons = await screen.findAllByText('Löschen');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(deleteEmployee).toHaveBeenCalledWith(1);
    });
  });

  it('shows error message when loading employees fails', async () => {
    (getEmployees as jest.Mock).mockRejectedValue(new Error('Failed to load employees'));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Fehler beim Laden der Mitarbeiter')).toBeInTheDocument();
    });
  });

  it('handles employee group change and updates contracted hours', async () => {
    renderComponent();

    // Click the add employee button to open the dialog
    fireEvent.click(screen.getByText('Mitarbeiter hinzufügen'));

    // Open the employee group select
    const groupSelect = screen.getByLabelText('Mitarbeitergruppe');
    fireEvent.mouseDown(groupSelect);

    // Wait for the portal to be mounted and select Teilzeit
    await waitFor(() => {
      const teilzeitOption = screen.getByText('Teilzeit (10/20/30h)');
      fireEvent.click(teilzeitOption);
    });

    // Verify contracted hours options changed
    const hoursSelect = screen.getByLabelText('Vertragsstunden');
    fireEvent.mouseDown(hoursSelect);

    // Check the available options
    await waitFor(() => {
      const menuItems = screen.getAllByText(/stunden/i);
      expect(menuItems).toHaveLength(3);
      expect(menuItems[0]).toHaveTextContent('10 Stunden / Woche');
      expect(menuItems[1]).toHaveTextContent('20 Stunden / Woche');
      expect(menuItems[2]).toHaveTextContent('30 Stunden / Woche');
    });
  });
}); 