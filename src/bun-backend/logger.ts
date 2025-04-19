import pino from 'pino';
import fs from 'node:fs';
import path from 'path';

// Ensure logs directories exist with absolute paths
const logsDir = path.resolve(__dirname, '../../logs');
const diagnosticDir = path.resolve(logsDir, 'diagnostic');
console.log(`[logger.ts] Resolved logsDir: ${logsDir}`);
console.log(`[logger.ts] Resolved diagnosticDir: ${diagnosticDir}`);

// Create directories if they don't exist
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log(`[logger.ts] Created logs directory: ${logsDir}`);
}
if (!fs.existsSync(diagnosticDir)) {
  fs.mkdirSync(diagnosticDir, { recursive: true });
  console.log(`[logger.ts] Created diagnostic directory: ${diagnosticDir}`);
}

// Create file paths
const appLogPath = path.join(logsDir, 'app.log');
const scheduleLogPath = path.join(diagnosticDir, 'schedule-generation.log');

// Configure log level
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info');

// Define sync log write function using fs
const logToFile = (filePath: string, message: string) => {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} ${message}\n`;

  try {
    fs.appendFileSync(filePath, logEntry);
  } catch (err) {
    // Only use console.error for critical logging failures
    console.error(`[Logger] Failed to write log to ${filePath}:`, err);
  }
};

// Create a basic pino logger instance
const logger = pino({
  level: logLevel,
});

// Extend logger with custom file logging
const enhancedLogger = {
  ...logger,
  child: (bindings: pino.Bindings) => logger.child(bindings),
  info: (obj: any, msg?: string, ...args: any[]) => {
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(appLogPath, `INFO: ${logMessage} ${args.length > 0 ? JSON.stringify(args) : ''}`);
  },
  debug: (obj: any, msg?: string, ...args: any[]) => {
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(appLogPath, `DEBUG: ${logMessage} ${args.length > 0 ? JSON.stringify(args) : ''}`);
  },
  error: (obj: any, msg?: string, ...args: any[]) => {
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(appLogPath, `ERROR: ${logMessage} ${args.length > 0 ? JSON.stringify(args) : ''}`);
  },
  warn: (obj: any, msg?: string, ...args: any[]) => {
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(appLogPath, `WARN: ${logMessage} ${args.length > 0 ? JSON.stringify(args) : ''}`);
  }
};

// Special diagnostic logger for schedule generation
export const scheduleLogger = {
  ...logger,
  info: (obj: any, msg?: string, ...args: any[]) => {
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(scheduleLogPath, `INFO: ${logMessage} ${args.length > 0 ? JSON.stringify(args) : ''}`);
  },
  debug: (obj: any, msg?: string, ...args: any[]) => {
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(scheduleLogPath, `DEBUG: ${logMessage} ${args.length > 0 ? JSON.stringify(args) : ''}`);
  },
  error: (obj: any, msg?: string, ...args: any[]) => {
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(scheduleLogPath, `ERROR: ${logMessage} ${args.length > 0 ? JSON.stringify(args) : ''}`);
  },
  warn: (obj: any, msg?: string, ...args: any[]) => {
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(scheduleLogPath, `WARN: ${logMessage} ${args.length > 0 ? JSON.stringify(args) : ''}`);
  },
  log: (obj: any, msg?: string, ...args: any[]) => {
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(scheduleLogPath, `LOG: ${logMessage} ${args.length > 0 ? JSON.stringify(args) : ''}`);
  }
};

export default enhancedLogger;
