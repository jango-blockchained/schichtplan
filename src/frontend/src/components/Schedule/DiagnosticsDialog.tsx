import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { getScheduleDiagnostics } from "@/services/api";
import { Loader2, AlertCircle, Info, AlertTriangle, CheckCircle, FileTextIcon, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface DiagnosticsDialogProps {
  sessionId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

interface DiagnosticLog {
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: string;
}

export function DiagnosticsDialog({ sessionId, isOpen, onClose }: DiagnosticsDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [diagnosticLogs, setDiagnosticLogs] = useState<DiagnosticLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && sessionId) {
      fetchDiagnostics();
    }
  }, [isOpen, sessionId]);

  const fetchDiagnostics = async () => {
    if (!sessionId) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await getScheduleDiagnostics(sessionId);
      if (response.status === 'success') {
        setDiagnosticLogs(response.diagnostic_logs);
      } else {
        setError('Failed to load diagnostics');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      toast({
        title: "Error Loading Diagnostics",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadLogs = () => {
    const logText = diagnosticLogs
      .map(log => `[${log.type.toUpperCase()}] ${log.message}`)
      .join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostics_${sessionId}.log`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const getLogIcon = (type: DiagnosticLog['type']) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      case 'success':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getLogClassName = (type: DiagnosticLog['type']) => {
    switch (type) {
      case 'error':
        return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400";
      case 'warning':
        return "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400";
      case 'success':
        return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400";
      default:
        return "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileTextIcon className="h-5 w-5" />
            Schedule Generation Diagnostics
          </DialogTitle>
          <DialogDescription>
            Detailed diagnostic logs from the schedule generation process
            {sessionId && (
              <span className="ml-2 text-xs font-mono bg-muted px-2 py-0.5 rounded">
                Session: {sessionId}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          ) : diagnosticLogs.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <FileTextIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">No diagnostic logs available</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-[60vh] pr-2">
              {diagnosticLogs.map((log, index) => (
                <div
                  key={index}
                  className={cn(
                    "p-3 rounded-md border flex items-start gap-2 text-sm",
                    getLogClassName(log.type)
                  )}
                >
                  <div className="mt-0.5">{getLogIcon(log.type)}</div>
                  <div className="flex-1">
                    <p className="whitespace-pre-wrap break-words">{log.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center mt-4 pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {diagnosticLogs.length > 0 && (
              <span>
                {diagnosticLogs.length} log entries • 
                {diagnosticLogs.filter(l => l.type === 'error').length} errors • 
                {diagnosticLogs.filter(l => l.type === 'warning').length} warnings
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {diagnosticLogs.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={downloadLogs}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download Logs
              </Button>
            )}
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 