import { api } from '@/lib/axios';

export interface LogEntry {
    timestamp: string;
    level: 'info' | 'warning' | 'error' | 'debug';
    module: string;
    action: string;
    message: string;
    user?: string;
    page?: string;
    details?: any;
}

class LogService {
    private queue: LogEntry[] = [];
    private isSending: boolean = false;
    private batchSize: number = 10;
    private batchTimeout: number = 5000; // 5 seconds

    private async sendLogs() {
        if (this.isSending || this.queue.length === 0) return;

        this.isSending = true;
        const batch = this.queue.slice(0, this.batchSize);

        try {
            await api.post('/logs', { logs: batch });
            this.queue = this.queue.slice(batch.length);
        } catch (error) {
            console.error('Failed to send logs:', error);
        } finally {
            this.isSending = false;
            if (this.queue.length > 0) {
                setTimeout(() => this.sendLogs(), this.batchTimeout);
            }
        }
    }

    private addToQueue(entry: Omit<LogEntry, 'timestamp'>) {
        const logEntry: LogEntry = {
            ...entry,
            timestamp: new Date().toISOString(),
            user: localStorage.getItem('userId') || 'anonymous',
            page: window.location.pathname
        };

        this.queue.push(logEntry);

        if (this.queue.length >= this.batchSize) {
            this.sendLogs();
        } else if (!this.isSending) {
            setTimeout(() => this.sendLogs(), this.batchTimeout);
        }
    }

    info(module: string, action: string, message: string, details?: any) {
        this.addToQueue({ level: 'info', module, action, message, details });
    }

    warning(module: string, action: string, message: string, details?: any) {
        this.addToQueue({ level: 'warning', module, action, message, details });
    }

    error(module: string, action: string, message: string, details?: any) {
        this.addToQueue({ level: 'error', module, action, message, details });
    }

    debug(module: string, action: string, message: string, details?: any) {
        if (process.env.NODE_ENV === 'development') {
            this.addToQueue({ level: 'debug', module, action, message, details });
        }
    }
}

export const logService = new LogService();

export const sendLogs = async (logs: LogEntry[]) => {
    try {
        const batch = logs.map(log => ({
            ...log,
            timestamp: new Date().toISOString()
        }));
        await api.post('/logs', { logs: batch });
    } catch (error) {
        console.error('Failed to send logs:', error);
    }
}; 