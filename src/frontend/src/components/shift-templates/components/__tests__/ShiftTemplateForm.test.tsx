/// <reference types="bun-types" />

import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom'; // Import jest-dom matchers
import { ShiftTemplateForm } from '../ShiftTemplateForm';
import type { Shift, Settings, ShiftTypeSetting } from '@/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, mock } from 'bun:test'; // Use Bun's native functions

// Define mock settings object conforming to Settings type
const mockSettings: Settings = {
    id: 1, // Add required id
    store_name: 'Mock Store', // Add required store_name
    timezone: 'Europe/Berlin', // Add required timezone
    language: 'de', // Add required language
    date_format: 'DD.MM.YYYY', // Add required date_format
    time_format: 'HH:mm', // Add required time_format
    store_opening: '08:00', // Add required store_opening
    store_closing: '20:00', // Add required store_closing
    keyholder_before_minutes: 30, // Add required keyholder_before_minutes
    keyholder_after_minutes: 15, // Add required keyholder_after_minutes
    opening_days: { '0': true, '1': true, '2': true, '3': true, '4': true, '5': false, '6': false }, // Add required opening_days
    start_of_week: 1, // Monday
    shift_types: [
        { id: 'EARLY', name: 'Early Shift', color: '#abcdef', type: 'shift' as const },
        { id: 'LATE', name: 'Late Shift', color: '#123456', type: 'shift' as const }
    ] as ShiftTypeSetting[],
    availability_types: [],
    // Add defaults for other required or potentially used optional fields if necessary
    employee_types: [],
    absence_types: [],
};

// Mock using Bun's native mock.module
mock.module('@/hooks/useSettings', () => ({
  useSettings: () => ({
    settings: mockSettings, // Use the fully typed mock object
    isLoading: false,
    error: null,
  }),
}));

mock.module('@/components/common/AvailabilityTypeSelect', () => ({
    AvailabilityTypeSelect: ({ value, onChange }: { value: string, onChange: (v: string) => void }) => (
        <select data-testid="mock-availability-select" value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="EARLY">Early Shift</option>
            <option value="LATE">Late Shift</option>
        </select>
    )
}));

mock.module('@/components/ui/time-picker', () => ({
    TimePicker: ({ date, setDate }: { date: Date | undefined, setDate: (d: Date | undefined) => void }) => {
        const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
            const [hours, minutes] = event.target.value.split(':').map(Number);
            const newDate = new Date();
            newDate.setHours(hours || 0, minutes || 0, 0, 0);
            setDate(newDate);
        };
        const value = date ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : '';
        return (
            <input
                type="time"
                data-testid={`mock-time-picker-${date?.getHours()}`}
                value={value}
                onChange={handleChange}
            />
        );
    }
}));

const createTestQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
});
const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe('ShiftTemplateForm', () => {
  let onSaveMock: ReturnType<typeof mock>;
  const defaultShift: Shift = {
    id: 1,
    start_time: '09:00',
    end_time: '17:00',
    duration_hours: 8,
    requires_break: false,
    active_days: { '0': true, '1': true, '2': true, '3': true, '4': true, '5': false, '6': false },
    shift_type_id: 'EARLY',
  };

  beforeEach(() => {
    onSaveMock = mock();
  });

  it('should render the form with initial shift values', () => {
    renderWithClient(
        <ShiftTemplateForm
            shift={defaultShift}
            onSave={onSaveMock}
            settings={mockSettings}
        />
    );
    // ... assertions ...
    expect(screen.getByDisplayValue('09:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('17:00')).toBeInTheDocument();
    expect(screen.getByTestId('mock-availability-select')).toHaveValue('EARLY');
    expect(screen.getByLabelText('Montag')).toBeChecked();
    expect(screen.getByLabelText('Sonntag')).not.toBeChecked();
  });

  it('should update start and end times on user input', async () => {
    const user = userEvent.setup();
    renderWithClient(
        <ShiftTemplateForm
            shift={defaultShift}
            onSave={onSaveMock}
            settings={mockSettings}
        />
    );
    // ... setup and user actions ...
    const startTimeInput = screen.getByDisplayValue('09:00');
    const endTimeInput = screen.getByDisplayValue('17:00');
    await user.clear(startTimeInput);
    await user.type(startTimeInput, '10:30');
    fireEvent.change(startTimeInput, { target: { value: '10:30' } });
    await user.clear(endTimeInput);
    await user.type(endTimeInput, '18:45');
    fireEvent.change(endTimeInput, { target: { value: '18:45' } });
    // ... assertions ...
    expect(startTimeInput).toHaveValue('10:30');
    expect(endTimeInput).toHaveValue('18:45');
  });


  it('should update shift type on user selection', async () => {
    const user = userEvent.setup();
    renderWithClient(
        <ShiftTemplateForm
            shift={defaultShift}
            onSave={onSaveMock}
            settings={mockSettings}
        />
    );
    // ... setup and user actions ...
    const shiftTypeSelect = screen.getByTestId('mock-availability-select');
    await user.selectOptions(shiftTypeSelect, 'LATE');
    // ... assertions ...
    expect(shiftTypeSelect).toHaveValue('LATE');
  });

  it('should toggle active days on checkbox click', async () => {
    const user = userEvent.setup();
     renderWithClient(
        <ShiftTemplateForm
            shift={defaultShift}
            onSave={onSaveMock}
            settings={mockSettings}
        />
    );
    // ... setup and user actions ...
    const mondayCheckbox = screen.getByLabelText('Montag');
    const sundayCheckbox = screen.getByLabelText('Sonntag');
    await user.click(mondayCheckbox);
    await user.click(sundayCheckbox);
    // ... assertions ...
    expect(mondayCheckbox).not.toBeChecked();
    expect(sundayCheckbox).toBeChecked();
  });

  it('should call onSave with updated data when save is triggered', async () => {
     const user = userEvent.setup();
     renderWithClient(
        <ShiftTemplateForm
            shift={defaultShift}
            onSave={onSaveMock}
            settings={mockSettings}
        />
     );
    // ... setup and user actions ...
    const startTimeInput = screen.getByDisplayValue('09:00');
    const endTimeInput = screen.getByDisplayValue('17:00');
    const shiftTypeSelect = screen.getByTestId('mock-availability-select');
    const sundayCheckbox = screen.getByLabelText('Sonntag');
    fireEvent.change(startTimeInput, { target: { value: '08:00' } });
    fireEvent.change(endTimeInput, { target: { value: '16:30' } });
    await user.selectOptions(shiftTypeSelect, 'LATE');
    await user.click(sundayCheckbox);
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);
    // ... assertions ...
    expect(onSaveMock).toHaveBeenCalledTimes(1);
    const expectedSaveData = {
      id: 1,
      start_time: '08:00',
      end_time: '16:30',
      shift_type_id: 'LATE',
      type: 'late',
      active_days: { '0': true, '1': true, '2': true, '3': true, '4': true, '5': false, '6': true },
      name: expect.any(String),
      duration_hours: 8.5,
      break_duration: 30,
      requires_break: true,
    };
    expect(onSaveMock).toHaveBeenCalledWith(expect.objectContaining(expectedSaveData));
  });

  // ... Add more tests ...

}); 