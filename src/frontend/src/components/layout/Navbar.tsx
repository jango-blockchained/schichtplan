import React from 'react';
import { WebSocketStatusIndicator } from '../WebSocketStatusIndicator';

export function Navbar() {
    return (
        <nav className="border-b bg-background">
            <div className="flex h-16 items-center px-4">
                <div className="flex items-center space-x-4">
                    {/* Your existing navigation items */}
                </div>
                <div className="ml-auto flex items-center space-x-4">
                    <WebSocketStatusIndicator />
                    {/* Your existing right-side items */}
                </div>
            </div>
        </nav>
    );
} 