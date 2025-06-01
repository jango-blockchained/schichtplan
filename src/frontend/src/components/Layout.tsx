import { ReactNode } from 'react';
import { WebSocketStatus } from '@/components/WebSocketStatus';

interface LayoutProps {
    children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
    return (
        <div className="min-h-screen bg-background">
            <main className="container mx-auto py-6">
                {children}
            </main>
            <WebSocketStatus className="fixed bottom-4 right-4 z-50" />
        </div>
    );
} 