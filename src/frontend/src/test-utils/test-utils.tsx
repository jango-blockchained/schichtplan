import { ReactElement } from 'react';
import { render as rtlRender, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
});

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
    route?: string;
}

function render(
    ui: ReactElement,
    { route = '/', ...renderOptions }: CustomRenderOptions = {}
) {
    if (global.window) {
        global.window.history.pushState({}, 'Test page', route);
    }

    function Wrapper({ children }: { children: React.ReactNode }) {
        return (
            <BrowserRouter>
                <QueryClientProvider client={queryClient}>
                    {children}
                </QueryClientProvider>
            </BrowserRouter>
        );
    }

    const utils = rtlRender(ui, { wrapper: Wrapper, ...renderOptions });

    return {
        ...utils,
        getByTestId: (id: string) => utils.container.querySelector(`[data-testid="${id}"]`),
    };
}

// re-export everything
export * from '@testing-library/react';
export { render, userEvent }; 