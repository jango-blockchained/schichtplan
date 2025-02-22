import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw, Download, Search, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface LogEntry {
    timestamp: string;
    level: 'INFO' | 'WARNING' | 'ERROR' | 'DEBUG';
    message: string;
    source: 'FRONTEND' | 'BACKEND';
    details?: any;
}

const LogsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [levelFilter, setLevelFilter] = useState<string>('all');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const { toast } = useToast();

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            // Get browser console logs
            const consoleLogs = await window.mcp_getConsoleLogs('');
            const consoleErrors = await window.mcp_getConsoleErrors('');
            const networkLogs = await window.mcp_getNetworkLogs('');
            const networkErrors = await window.mcp_getNetworkErrors('');

            // Format frontend logs
            const frontendLogs: LogEntry[] = [
                ...consoleLogs.map((log: any) => ({
                    timestamp: format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss'),
                    level: 'INFO',
                    message: log.message,
                    source: 'FRONTEND',
                    details: log
                })),
                ...consoleErrors.map((error: any) => ({
                    timestamp: format(new Date(error.timestamp), 'yyyy-MM-dd HH:mm:ss'),
                    level: 'ERROR',
                    message: error.message,
                    source: 'FRONTEND',
                    details: error
                })),
                ...networkLogs.map((log: any) => ({
                    timestamp: format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss'),
                    level: 'INFO',
                    message: `${log.method} ${log.url} - ${log.status}`,
                    source: 'FRONTEND',
                    details: log
                })),
                ...networkErrors.map((error: any) => ({
                    timestamp: format(new Date(error.timestamp), 'yyyy-MM-dd HH:mm:ss'),
                    level: 'ERROR',
                    message: `${error.method} ${error.url} - ${error.status}`,
                    source: 'FRONTEND',
                    details: error
                }))
            ];

            // Sort logs by timestamp
            const sortedLogs = frontendLogs.sort((a, b) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );

            setLogs(sortedLogs);
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to fetch logs",
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        // Set up auto-refresh every 30 seconds
        const interval = setInterval(fetchLogs, 30000);
        return () => clearInterval(interval);
    }, []);

    const filteredLogs = logs.filter(log => {
        const matchesSearch = searchTerm === '' ||
            log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.timestamp.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
        const matchesTab = activeTab === 'all' || log.source.toLowerCase() === activeTab.toLowerCase();

        return matchesSearch && matchesLevel && matchesTab;
    });

    const handleRefresh = () => {
        fetchLogs();
        toast({
            description: "Logs refreshed",
        });
    };

    const handleDownload = () => {
        const logText = filteredLogs
            .map(log => `[${log.timestamp}] [${log.level}] [${log.source}] ${log.message}`)
            .join('\n');

        const blob = new Blob([logText], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logs_${format(new Date(), 'yyyyMMdd_HHmmss')}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    const clearLogs = async () => {
        try {
            await window.mcp_wipeLogs('');
            setLogs([]);
            toast({
                description: "Logs cleared successfully",
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to clear logs",
            });
        }
    };

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">System Logs</h1>
                <div className="flex gap-2">
                    <Button onClick={handleRefresh} disabled={isLoading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button onClick={handleDownload} variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                    </Button>
                    <Button onClick={clearLogs} variant="destructive">
                        Clear Logs
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <div className="flex gap-4 mb-4">
                        <div className="flex-1">
                            <Input
                                placeholder="Search logs..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full"
                            />
                        </div>
                        <Select value={levelFilter} onValueChange={setLevelFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter by level" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Levels</SelectItem>
                                <SelectItem value="INFO">Info</SelectItem>
                                <SelectItem value="WARNING">Warning</SelectItem>
                                <SelectItem value="ERROR">Error</SelectItem>
                                <SelectItem value="DEBUG">Debug</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList>
                            <TabsTrigger value="all">All Logs</TabsTrigger>
                            <TabsTrigger value="frontend">Frontend</TabsTrigger>
                            <TabsTrigger value="backend">Backend</TabsTrigger>
                        </TabsList>

                        <TabsContent value={activeTab} className="mt-4">
                            <div className="space-y-2">
                                {filteredLogs.length === 0 ? (
                                    <Alert>
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>
                                            No logs found matching the current filters.
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    filteredLogs.map((log, index) => (
                                        <div
                                            key={index}
                                            className={`p-3 rounded-lg text-sm font-mono ${log.level === 'ERROR' ? 'bg-red-50 dark:bg-red-900/10' :
                                                    log.level === 'WARNING' ? 'bg-yellow-50 dark:bg-yellow-900/10' :
                                                        'bg-gray-50 dark:bg-gray-900/10'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-500">{log.timestamp}</span>
                                                <span className={`px-2 py-0.5 rounded text-xs ${log.level === 'ERROR' ? 'bg-red-200 text-red-800' :
                                                        log.level === 'WARNING' ? 'bg-yellow-200 text-yellow-800' :
                                                            'bg-blue-200 text-blue-800'
                                                    }`}>
                                                    {log.level}
                                                </span>
                                                <span className="px-2 py-0.5 rounded text-xs bg-gray-200 text-gray-800">
                                                    {log.source}
                                                </span>
                                            </div>
                                            <div className="mt-1">{log.message}</div>
                                            {log.details && (
                                                <pre className="mt-2 text-xs overflow-x-auto">
                                                    {JSON.stringify(log.details, null, 2)}
                                                </pre>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
};

export default LogsPage; 