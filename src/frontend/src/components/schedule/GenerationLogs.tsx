import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FileText, ChevronUp, ChevronDown, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { GenerationLog } from './GenerationOverlay'; // Reuse the type from GenerationOverlay

interface GenerationLogsProps {
    logs: GenerationLog[];
    clearLogs: () => void;
}

const GenerationLogs: React.FC<GenerationLogsProps> = ({ logs, clearLogs }) => {
    const [isOpen, setIsOpen] = useState(false);

    if (logs.length === 0) return null;

    return (
        <Card className="mt-4">
            <CardHeader className="pb-2 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                <CardTitle className="text-sm flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileText size={16} />
                        Generierungs-Logs ({logs.length})
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </Button>
                </CardTitle>
            </CardHeader>

            {isOpen && (
                <CardContent>
                    <div className="space-y-2 max-h-60 overflow-y-auto text-sm">
                        {logs.map((log, index) => (
                            <div
                                key={index}
                                className={cn(
                                    "p-2 rounded border",
                                    log.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400' :
                                        log.type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400' :
                                            'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400'
                                )}
                            >
                                <div className="font-medium flex items-center gap-2">
                                    {log.type === 'error' ? <AlertCircle size={14} /> :
                                        log.type === 'warning' ? <AlertTriangle size={14} /> :
                                            <Info size={14} />}
                                    {log.message}
                                </div>
                                {log.details && (
                                    <div className="mt-1 text-xs opacity-80">{log.details}</div>
                                )}
                                <div className="text-xs mt-1 opacity-60">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-3 flex justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                clearLogs();
                            }}
                        >
                            Logs löschen
                        </Button>
                    </div>
                </CardContent>
            )}
        </Card>
    );
};

export default GenerationLogs; 