import { describe, test, expect, mock } from 'bun:test';
import { render, screen } from '@/test-utils/test-utils';
import { ShiftTable } from '../ShiftTable';

const mockWeekData = [
  {
    employee_id: 1,
    employee_name: 'Test Employee',
    weekly_shifts: [
      {
        day: 0,
        start_time: '09:00',
        end_time: '17:00',
        break: {
          start: '12:00',
          end: '12:30',
          notes: ''
        }
      }
    ]
  }
];

describe('ShiftTable', () => {
  test('renders shift data correctly', () => {
    render(
      <ShiftTable
        weekStart={new Date('2023-01-01')}
        weekEnd={new Date('2023-01-07')}
        data={mockWeekData}
        isLoading={false}
        error={null}
      />
    );
    
    // Check that the employee name is displayed
    expect(screen.getByText('Test Employee')).toBeDefined();
    
    // Check that the shift time is displayed
    expect(screen.getByText('09:00 - 17:00')).toBeDefined();
  });
  
  test('shows loading state', () => {
    render(
      <ShiftTable
        weekStart={new Date('2023-01-01')}
        weekEnd={new Date('2023-01-07')}
        data={[]}
        isLoading={true}
        error={null}
      />
    );
    
    // Check for loading indicator
    const loadingElements = screen.getAllByRole('status');
    expect(loadingElements.length).toBeGreaterThan(0);
  });
  
  test('shows error state', () => {
    render(
      <ShiftTable
        weekStart={new Date('2023-01-01')}
        weekEnd={new Date('2023-01-07')}
        data={[]}
        isLoading={false}
        error="Failed to load schedule data"
      />
    );
    
    // Check for error message
    expect(screen.getByText('Failed to load schedule data')).toBeDefined();
  });
}); 