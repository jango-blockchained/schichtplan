import { describe, expect, it, mock, spyOn } from 'bun:test';
import { render, fireEvent } from '../../test-utils/test-utils';
import { ThemeToggle } from '../ThemeToggle';
import * as ThemeProvider from '../../providers/ThemeProvider';

describe('ThemeToggle', () => {
    const mockSetTheme = mock(() => { });

    // Mock the useTheme hook
    spyOn(ThemeProvider, 'useTheme').mockImplementation(() => ({
        theme: 'light',
        setTheme: mockSetTheme,
    }));

    it('renders without crashing', () => {
        const { container } = render(<ThemeToggle />);
        const button = container.querySelector('button');
        expect(button).toBeDefined();
    });

    it('has correct accessibility label', () => {
        const { container } = render(<ThemeToggle />);
        const srOnly = container.querySelector('.sr-only');
        expect(srOnly?.textContent).toBe('Toggle theme');
    });

    it('toggles theme when clicked', () => {
        const { container } = render(<ThemeToggle />);
        const button = container.querySelector('button');
        expect(button).toBeDefined();

        if (button) {
            fireEvent.click(button);
            expect(mockSetTheme).toHaveBeenCalledWith('dark');
        }
    });

    it('displays both sun and moon icons', () => {
        const { container } = render(<ThemeToggle />);
        const icons = container.querySelectorAll('svg');
        expect(icons.length).toBe(2);
    });
}); 