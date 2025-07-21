import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import type { AppProps } from 'next/app';

const queryClient = new QueryClient();

export default function App({ Component, pageProps }: AppProps) {
    return (
        <QueryClientProvider client={queryClient}>
            <WebSocketProvider url="http://localhost:5000">
                <Component {...pageProps} />
                <Toaster />
            </WebSocketProvider>
        </QueryClientProvider>
    );
} 