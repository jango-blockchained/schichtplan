import React from 'react';
import { render as rtlRender, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/providers/ThemeProvider';

interface WrapperProps {
  children: React.ReactNode;
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function createWrapper() {
  const queryClient = createTestQueryClient();
  
  return ({ children }: WrapperProps) => (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

function render(
  ui: React.ReactElement,
  options: Omit<RenderOptions, 'wrapper'> = {}
) {
  return rtlRender(ui, {
    wrapper: createWrapper(),
    ...options,
  });
}

// Re-export everything
export * from '@testing-library/react';
export { render };
