import { describe, expect, it, mock, beforeEach } from 'bun:test';
import { render, fireEvent } from '../../test-utils/test-utils';
import userEvent from '@testing-library/user-event';
import EmployeeForm from '../EmployeeForm';

describe('EmployeeForm', () => {
    const mockOnSubmit = mock(() => { });

    beforeEach(() => {
        mockOnSubmit.mockClear();
    });

    it('renders all form fields', () => {
        const { container } = render(<EmployeeForm onSubmit={mockOnSubmit} />);

        const nameInput = container.querySelector('input[id="name"]');
        const positionSelect = container.querySelector('#position');
        const hoursInput = container.querySelector('input[id="hours"]');
        const submitButton = container.querySelector('button[type="submit"]');

        expect(nameInput).toBeDefined();
        expect(positionSelect).toBeDefined();
        expect(hoursInput).toBeDefined();
        expect(submitButton?.textContent).toBe('Add Employee');
    });

    it('updates input values when typing', async () => {
        const { container } = render(<EmployeeForm onSubmit={mockOnSubmit} />);

        const nameInput = container.querySelector('input[id="name"]') as HTMLInputElement;
        const hoursInput = container.querySelector('input[id="hours"]') as HTMLInputElement;

        expect(nameInput).toBeDefined();
        expect(hoursInput).toBeDefined();

        if (nameInput && hoursInput) {
            await userEvent.type(nameInput, 'John Doe');
            await userEvent.type(hoursInput, '40:00');

            expect(nameInput.value).toBe('John Doe');
            expect(hoursInput.value).toBe('40:00');
        }
    });

    it('allows selecting a position', async () => {
        const { container } = render(<EmployeeForm onSubmit={mockOnSubmit} />);

        const positionSelect = container.querySelector('#position');
        expect(positionSelect).toBeDefined();

        if (positionSelect) {
            fireEvent.click(positionSelect);

            // Wait for the select content to be rendered
            await new Promise(resolve => setTimeout(resolve, 0));

            const tzOption = document.querySelector('[data-value="TZ"]');
            expect(tzOption).toBeDefined();

            if (tzOption) {
                fireEvent.click(tzOption);
                expect(container.textContent).toContain('TZ');
            }
        }
    });

    it('submits form with correct data', async () => {
        const { container } = render(<EmployeeForm onSubmit={mockOnSubmit} />);

        const nameInput = container.querySelector('input[id="name"]') as HTMLInputElement;
        const hoursInput = container.querySelector('input[id="hours"]') as HTMLInputElement;
        const positionSelect = container.querySelector('#position');

        expect(nameInput).toBeDefined();
        expect(hoursInput).toBeDefined();
        expect(positionSelect).toBeDefined();

        if (nameInput && hoursInput && positionSelect) {
            await userEvent.type(nameInput, 'John Doe');

            fireEvent.click(positionSelect);
            await new Promise(resolve => setTimeout(resolve, 0));
            const tzOption = document.querySelector('[data-value="TZ"]');
            if (tzOption) {
                fireEvent.click(tzOption);
            }

            await userEvent.type(hoursInput, '40:00');

            const form = container.querySelector('form');
            expect(form).toBeDefined();

            if (form) {
                fireEvent.submit(form);

                expect(mockOnSubmit).toHaveBeenCalledWith({
                    name: 'John Doe',
                    position: 'TZ',
                    contractedHours: '40:00',
                });
            }
        }
    });

    it('validates required fields', async () => {
        const { container } = render(<EmployeeForm onSubmit={mockOnSubmit} />);

        const form = container.querySelector('form');
        expect(form).toBeDefined();

        if (form) {
            fireEvent.submit(form);
            expect(mockOnSubmit).not.toHaveBeenCalled();

            const nameInput = container.querySelector('input[id="name"]') as HTMLInputElement;
            const hoursInput = container.querySelector('input[id="hours"]') as HTMLInputElement;

            expect(nameInput.validity.valid).toBe(false);
            expect(hoursInput.validity.valid).toBe(false);
        }
    });

    it('validates hours format', async () => {
        const { container } = render(<EmployeeForm onSubmit={mockOnSubmit} />);

        const hoursInput = container.querySelector('input[id="hours"]') as HTMLInputElement;
        expect(hoursInput).toBeDefined();

        if (hoursInput) {
            await userEvent.type(hoursInput, 'invalid');

            const form = container.querySelector('form');
            if (form) {
                fireEvent.submit(form);
                expect(mockOnSubmit).not.toHaveBeenCalled();
                expect(hoursInput.validity.valid).toBe(false);
            }
        }
    });

    it('clears form after successful submission', async () => {
        const { container } = render(<EmployeeForm onSubmit={mockOnSubmit} />);

        const nameInput = container.querySelector('input[id="name"]') as HTMLInputElement;
        const hoursInput = container.querySelector('input[id="hours"]') as HTMLInputElement;
        const positionSelect = container.querySelector('#position');

        expect(nameInput).toBeDefined();
        expect(hoursInput).toBeDefined();
        expect(positionSelect).toBeDefined();

        if (nameInput && hoursInput && positionSelect) {
            await userEvent.type(nameInput, 'John Doe');
            await userEvent.type(hoursInput, '40:00');

            fireEvent.click(positionSelect);
            await new Promise(resolve => setTimeout(resolve, 0));
            const tzOption = document.querySelector('[data-value="TZ"]');
            if (tzOption) {
                fireEvent.click(tzOption);
            }

            const form = container.querySelector('form');
            if (form) {
                fireEvent.submit(form);

                // Wait for state updates
                await new Promise(resolve => setTimeout(resolve, 0));

                expect(nameInput.value).toBe('');
                expect(hoursInput.value).toBe('');
                expect(container.textContent).toContain('Select position');
            }
        }
    });
}); 