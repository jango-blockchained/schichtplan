import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar, Users, Settings, FileText } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import React from 'react';

interface LayoutProps {
    children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const location = useLocation();

    const navigation = [
        { name: 'Schedule', href: '/', icon: Calendar },
        { name: 'Employees', href: '/employees', icon: Users },
        { name: 'Settings', href: '/settings', icon: Settings },
        { name: 'Logs', href: '/logs', icon: FileText },
    ];

    return (
        <div className="min-h-screen bg-background">
            <div className="flex">
                {/* Sidebar */}
                <div className="fixed inset-y-0 z-50 flex w-72 flex-col">
                    <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r bg-background px-6 pb-4">
                        <div className="flex h-16 shrink-0 items-center">
                            <img
                                className="h-8 w-auto"
                                src="/logo.svg"
                                alt="Schichtplan"
                            />
                        </div>
                        <nav className="flex flex-1 flex-col">
                            <ul role="list" className="flex flex-1 flex-col gap-y-7">
                                <li>
                                    <ul role="list" className="-mx-2 space-y-1">
                                        {navigation.map((item) => {
                                            const isActive = location.pathname === item.href;
                                            return (
                                                <li key={item.name}>
                                                    <Link
                                                        to={item.href}
                                                        className={cn(
                                                            'group flex gap-x-3 rounded-md p-2 text-sm leading-6',
                                                            isActive
                                                                ? 'bg-primary text-primary-foreground'
                                                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                                        )}
                                                    >
                                                        <item.icon className="h-6 w-6 shrink-0" />
                                                        {item.name}
                                                    </Link>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </li>
                                <li className="mt-auto">
                                    <ThemeToggle />
                                </li>
                            </ul>
                        </nav>
                    </div>
                </div>

                {/* Main content */}
                <main className="pl-72 w-full">
                    {children}
                </main>
            </div>
        </div>
    );
} 