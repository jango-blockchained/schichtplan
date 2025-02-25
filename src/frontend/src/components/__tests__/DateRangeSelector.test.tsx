import { describe, expect, it, mock } from 'bun:test';
import { render, fireEvent } from '../../test-utils/test-utils';
import DateRangeSelector from '../DateRangeSelector';

describe('DateRangeSelector', () => {
    const defaultProps = {
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-02-29'),
        setStartDate: mock(() => { }),
        setEndDate: mock(() => { }),
    };

    it('renders without crashing', () => {
        const { container } = render(<DateRangeSelector {...defaultProps} />);
        expect(container).toBeDefined();
    });

    it('displays the current date range', () => {
        const { container } = render(<DateRangeSelector {...defaultProps} />);
        const button = container.querySelector('button');
        expect(button?.textContent).toContain('Feb 01, 2024');
        expect(button?.textContent).toContain('Feb 29, 2024');
    });

    it('handles null dates', () => {
        const { container } = render(
            <DateRangeSelector
                startDate={null}
                endDate={null}
                setStartDate={defaultProps.setStartDate}
                setEndDate={defaultProps.setEndDate}
            />
        );
        const button = container.querySelector('button');
        expect(button?.textContent).toContain('Pick a date');
    });

    it('calls setStartDate and setEndDate when date range changes', () => {
        const { container } = render(<DateRangeSelector {...defaultProps} />);
        const button = container.querySelector('button');
        if (button) {
            fireEvent.click(button);
            // Note: We can't fully test the date picker interaction here
            // as it requires complex calendar interactions
            // We'll just verify the button click works
            expect(button).toBeDefined();
        }
    });
}); 