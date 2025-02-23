import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
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

export default function LogsPage() {
    const [logType, setLogType] = useState<string>('all');
    const [days, setDays] = useState<number>(7);
    const [level, setLevel] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [currentTab, setCurrentTab] = useState<string>('logs');

    const { data: logs, isLoading: logsLoading } = useQuery<{ logs: LogEntry[] }>({
        queryKey: ['logs', logType, days, level],
        queryFn: () => api.get('/api/logs', {
            params: { type: logType, days, level: level === 'all' ? null : level }
        }).then(res => res.data)
    });

    const { data: stats, isLoading: statsLoading } = useQuery<{ stats: LogStats }>({
        queryKey: ['logStats', days],
        queryFn: () => api.get('/api/logs/stats', {
            params: { days }
        }).then(res => res.data)
    });

    const filteredLogs = logs?.logs.filter(log => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
            log.message?.toLowerCase().includes(searchLower) ||
            log.module?.toLowerCase().includes(searchLower) ||
            log.action?.toLowerCase().includes(searchLower) ||
            log.user?.toLowerCase().includes(searchLower)
        );
    });

    const renderLogLevel = (level: string) => {
        const colors: Record<string, string> = {
            error: 'text-red-500',
            warning: 'text-yellow-500',
            info: 'text-blue-500',
            debug: 'text-gray-500'
        };
        return <span className={colors[level] || 'text-gray-500'}>{level.toUpperCase()}</span>;
    };

    const renderLogEntry = (log: LogEntry) => (
        <div key={log.timestamp} className="border-b p-4 hover:bg-gray-50">
            <div className="flex justify-between items-start">
                <div>
                    <div className="text-sm text-gray-500">
                        {new Date(log.timestamp).toLocaleString()}
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
        </div>
    );

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
                                            {new Date(error.timestamp).toLocaleString()}
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

    if (logsLoading || statsLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Logs</h1>
                    <p className="text-muted-foreground">
                        View and analyze system logs
                    </p>
                </div>
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
                                {filteredLogs?.length || 0} entries found
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="divide-y">
                                {filteredLogs?.map(renderLogEntry)}
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