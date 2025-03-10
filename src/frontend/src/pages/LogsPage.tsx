import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { clearLogs } from '@/services/api';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { PageHeader } from '@/components/PageHeader';
import { Badge } from "@/components/ui/badge";

interface LogEntry {
    timestamp: string;
    level: string;
    module: string;
    action: string;
    message: string;
    user?: string;
    page?: string;
    details?: any;
}

interface GroupedLogEntry extends LogEntry {
    count: number;
    timestamps: string[];
}

interface LogStats {
    total_logs: number;
    errors: number;
    warnings: number;
    user_actions: number;
    schedule_operations: number;
    by_date: Record<string, number>;
    by_module: Record<string, number>;
    by_action: Record<string, number>;
    recent_errors: LogEntry[];
}

interface LogResponse {
    status: string;
    logs: LogEntry[];
    debug: any;
}

interface StatsResponse {
    status: string;
    stats: LogStats;
}

// Function to group similar log entries
const groupSimilarLogs = (logs: LogEntry[]): GroupedLogEntry[] => {
    const groups: { [key: string]: GroupedLogEntry } = {};

    logs.forEach(log => {
        // Create a key based on the message and level (you can modify this to include other fields)
        const key = `${log.level}:${log.message}:${log.module}:${log.action}`;

        if (!groups[key]) {
            groups[key] = {
                ...log,
                count: 1,
                timestamps: [log.timestamp]
            };
        } else {
            groups[key].count++;
            groups[key].timestamps.push(log.timestamp);
            // Keep the most recent timestamp as the main timestamp
            groups[key].timestamp = groups[key].timestamps[0];
        }
    });

    return Object.values(groups).sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
};

export default function LogsPage() {
    const [logType, setLogType] = useState<string>('all');
    const [days, setDays] = useState<number>(7);
    const [level, setLevel] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [currentTab, setCurrentTab] = useState<string>('logs');
    const [isExpanded, setIsExpanded] = useState<{ [key: string]: boolean }>({});
    const [isClearing, setIsClearing] = useState<boolean>(false);
    const queryClient = useQueryClient();

    // Format date with validation - enhanced for more robust handling of various date formats
    const formatDate = (dateString: string | null | undefined) => {
        // If the input is null or undefined, return Unknown date
        if (dateString === null || dateString === undefined) {
            console.warn('Received null or undefined date');
            return 'Unknown date';
        }

        try {
            // Log the raw date string for debugging
            console.log('Formatting date string:', dateString, 'Type:', typeof dateString);

            // If it's already displaying as Invalid Date, return Unknown date
            if (String(dateString).includes('Invalid')) {
                console.warn('Received already invalid date string:', dateString);
                return 'Unknown date';
            }

            // Special case for timestamps that are just numbers (Unix timestamps in seconds or milliseconds)
            if (/^\d+$/.test(String(dateString))) {
                // If it's a Unix timestamp in seconds (10 digits), convert to milliseconds
                const timestamp = String(dateString).length === 10
                    ? parseInt(String(dateString)) * 1000
                    : parseInt(String(dateString));

                const date = new Date(timestamp);
                if (!isNaN(date.getTime())) {
                    return formatValidDate(date);
                }
            }

            // Try to parse as ISO string or other recognized format
            const date = new Date(dateString);

            // Check if date is valid
            if (isNaN(date.getTime())) {
                console.warn('Failed to create valid date from:', dateString);

                // Try alternative parsing approaches for common formats

                // Try parsing as yyyy-mm-dd format
                if (typeof dateString === 'string') {
                    const parts = dateString.split(/[-T :.]/);
                    if (parts.length >= 3) {
                        const year = parseInt(parts[0]);
                        const month = parseInt(parts[1]) - 1; // months are 0-indexed in JS
                        const day = parseInt(parts[2]);

                        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                            const manualDate = new Date(year, month, day);
                            if (!isNaN(manualDate.getTime())) {
                                console.log('Parsed date manually:', manualDate);
                                return formatValidDate(manualDate);
                            }
                        }
                    }
                }

                return 'Unknown date';
            }

            return formatValidDate(date);
        } catch (e) {
            console.error('Error formatting date:', e, 'Input was:', dateString);
            return 'Unknown date';
        }
    };

    // Helper to format a valid Date object consistently
    const formatValidDate = (date: Date) => {
        const pad = (num: number) => String(num).padStart(2, '0');

        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1); // getMonth() is 0-indexed
        const day = pad(date.getDate());
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        const seconds = pad(date.getSeconds());

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    const { data: logs, isLoading: logsLoading } = useQuery<LogResponse, Error, LogResponse>({
        queryKey: ['logs', logType, days, level] as const,
        queryFn: async () => {
            const response = await api.get<LogResponse>('/logs', {
                params: { type: logType, days, level: level === 'all' ? null : level }
            });
            return response.data;
        },
        retry: false,
        refetchOnWindowFocus: false,
        staleTime: 5000,
        enabled: true,
        refetchInterval: false
    });

    const { data: stats, isLoading: statsLoading } = useQuery<StatsResponse, Error, StatsResponse>({
        queryKey: ['logStats', days] as const,
        queryFn: async () => {
            const response = await api.get<StatsResponse>('/logs/stats', {
                params: { days }
            });
            return response.data;
        },
        retry: false,
        refetchOnWindowFocus: false,
        staleTime: 5000,
        enabled: true,
        refetchInterval: false
    });

    const filteredLogs = logs?.status === 'success' && Array.isArray(logs.logs) ? logs.logs.filter((log: LogEntry) => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
            log.message?.toLowerCase().includes(searchLower) ||
            log.module?.toLowerCase().includes(searchLower) ||
            log.action?.toLowerCase().includes(searchLower) ||
            log.user?.toLowerCase().includes(searchLower)
        );
    }) : [];

    const groupedLogs = filteredLogs ? groupSimilarLogs(filteredLogs) : [];

    const renderLogLevel = (level: string) => {
        const colors: Record<string, string> = {
            error: 'text-red-500',
            warning: 'text-yellow-500',
            info: 'text-blue-500',
            debug: 'text-gray-500'
        };
        return <span className={colors[level] || 'text-gray-500'}>{level.toUpperCase()}</span>;
    };

    const toggleExpand = (key: string) => {
        setIsExpanded(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const renderLogEntry = (log: GroupedLogEntry) => {
        const key = `${log.level}:${log.message}:${log.module}:${log.action}`;
        const isExpandable = log.count > 1;

        return (
            <div key={key} className="border-b p-4 hover:bg-white/30 transition-colors duration-200">
                <div className="flex justify-between items-start">
                    <div className="flex-1">
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                            {formatDate(log.timestamp)}
                            {log.count > 1 && (
                                <Badge
                                    variant="secondary"
                                    className="cursor-pointer hover:bg-gray-200"
                                    onClick={() => toggleExpand(key)}
                                >
                                    {log.count} occurrences
                                </Badge>
                            )}
                        </div>
                        <div className="font-medium">{log.message}</div>
                    </div>
                    <div className="text-right">
                        {renderLogLevel(log.level)}
                    </div>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                    <span className="mr-4">Module: {log.module}</span>
                    <span className="mr-4">Action: {log.action}</span>
                    {log.user && <span className="mr-4">User: {log.user}</span>}
                    {log.page && <span>Page: {log.page}</span>}
                </div>
                {log.details && (
                    <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                        {JSON.stringify(log.details, null, 2)}
                    </pre>
                )}
                {isExpandable && isExpanded[key] && (
                    <div className="mt-4 pl-4 border-l-2 border-gray-200">
                        <div className="text-sm font-medium mb-2">All Occurrences:</div>
                        {log.timestamps.map((timestamp, idx) => (
                            <div key={idx} className="text-sm text-gray-500">
                                {formatDate(timestamp)}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderStats = () => {
        if (!stats) return null;

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span>Total Logs:</span>
                                <span>{stats.stats.total_logs}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Errors:</span>
                                <span className="text-red-500">{stats.stats.errors}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Warnings:</span>
                                <span className="text-yellow-500">{stats.stats.warnings}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>User Actions:</span>
                                <span>{stats.stats.user_actions}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Schedule Operations:</span>
                                <span>{stats.stats.schedule_operations}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Recent Errors</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {stats.stats.recent_errors.map((error, index) => (
                                <Alert key={index} variant="destructive">
                                    <AlertDescription>
                                        {error.message}
                                        <div className="text-xs mt-1">
                                            {formatDate(error.timestamp)}
                                        </div>
                                    </AlertDescription>
                                </Alert>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    };

    // Function to handle clearing logs
    const handleClearLogs = async () => {
        if (window.confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
            try {
                setIsClearing(true);
                await clearLogs();
                // Invalidate and refetch logs and stats queries
                await queryClient.invalidateQueries({ queryKey: ['logs'] });
                await queryClient.invalidateQueries({ queryKey: ['logStats'] });
            } catch (error) {
                console.error('Failed to clear logs:', error);
                alert('Failed to clear logs. Please try again.');
            } finally {
                setIsClearing(false);
            }
        }
    };

    if (logsLoading || statsLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex justify-between items-center">
                <PageHeader
                    title="Logs"
                    description="View and analyze system logs"
                />
                <Button
                    variant="destructive"
                    onClick={handleClearLogs}
                    disabled={isClearing}
                    className="mr-4"
                >
                    {isClearing ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Clearing...
                        </>
                    ) : (
                        'Clear Logs'
                    )}
                </Button>
            </div>

            <Tabs value={currentTab} onValueChange={setCurrentTab}>
                <TabsList>
                    <TabsTrigger value="logs">Logs</TabsTrigger>
                    <TabsTrigger value="stats">Statistics</TabsTrigger>
                </TabsList>

                <TabsContent value="logs" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Filters</CardTitle>
                            <CardDescription>
                                Filter and search through logs
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <Label>Log Type</Label>
                                    <Select value={logType} onValueChange={setLogType}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All</SelectItem>
                                            <SelectItem value="user">User Actions</SelectItem>
                                            <SelectItem value="error">Errors</SelectItem>
                                            <SelectItem value="schedule">Schedule</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label>Level</Label>
                                    <Select value={level} onValueChange={setLevel}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select level" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All</SelectItem>
                                            <SelectItem value="info">Info</SelectItem>
                                            <SelectItem value="warning">Warning</SelectItem>
                                            <SelectItem value="error">Error</SelectItem>
                                            <SelectItem value="debug">Debug</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label>Days</Label>
                                    <Input
                                        type="number"
                                        value={days}
                                        onChange={(e) => setDays(parseInt(e.target.value))}
                                        min={1}
                                        max={30}
                                    />
                                </div>

                                <div>
                                    <Label>Search</Label>
                                    <Input
                                        type="text"
                                        placeholder="Search logs..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Log Entries</CardTitle>
                            <CardDescription>
                                {groupedLogs.length || 0} entries found
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="divide-y">
                                {groupedLogs.map(renderLogEntry)}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="stats">
                    {renderStats()}
                </TabsContent>
            </Tabs>
        </div>
    );
} 