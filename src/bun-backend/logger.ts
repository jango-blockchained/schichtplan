import pino from 'pino';
import fs from 'fs';
import path from 'path';

// Ensure logs directories exist with absolute paths
const logsDir = path.resolve(__dirname, '../../logs');
const diagnosticDir = path.resolve(logsDir, 'diagnostic');

// Create directories if they don't exist
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
if (!fs.existsSync(diagnosticDir)) {
  fs.mkdirSync(diagnosticDir, { recursive: true });
}

// Create file paths
const appLogPath = path.join(logsDir, 'app.log');
const scheduleLogPath = path.join(diagnosticDir, 'schedule-generation.log');

// Configure log level
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info');

// Simple file append function for direct logging
const logToFile = (filePath: string, message: string) => {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} ${message}\n`;
  try {
    fs.appendFileSync(filePath, logEntry);
  } catch (err) {
    // Decide how to handle file write errors - perhaps log to a different file?
    // For now, failing silently to avoid console output.
  }
};

// Create a basic pino logger instance, but without console transport
const logger = pino({
  level: logLevel,
  // Remove the transport configuration to disable console output
  // transport: {
  //   target: 'pino-pretty',
  //   options: {
  //     colorize: true
  //   }
  // }
});

// Log directory creation *after* logger is potentially usable (though still without transport here)
// Or simply rely on file system operations succeeding silently. Let's remove it for now.
// logger.info(`Log directories ensured at: ${logsDir} and ${diagnosticDir}`);

// Extend logger with custom file logging
const enhancedLogger = {
  // Keep pino's structure/methods but don't call the base logger's output methods
  ...logger, 
  child: (bindings: pino.Bindings) => logger.child(bindings), // Child loggers might still be useful
  // Override methods to ONLY write to file
  info: (obj: any, msg?: string, ...args: any[]) => {
    // logger.info(obj, msg, ...args); // Remove call to base console logger
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(appLogPath, `INFO: ${logMessage} ${args.length > 0 ? JSON.stringify(args) : ''}`);
  },
  debug: (obj: any, msg?: string, ...args: any[]) => {
    // logger.debug(obj, msg, ...args); // Remove call to base console logger
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(appLogPath, `DEBUG: ${logMessage} ${args.length > 0 ? JSON.stringify(args) : ''}`);
  },
  error: (obj: any, msg?: string, ...args: any[]) => {
    // logger.error(obj, msg, ...args); // Remove call to base console logger
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(appLogPath, `ERROR: ${logMessage} ${args.length > 0 ? JSON.stringify(args) : ''}`);
  },
  warn: (obj: any, msg?: string, ...args: any[]) => {
    // logger.warn(obj, msg, ...args); // Remove call to base console logger
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(appLogPath, `WARN: ${logMessage} ${args.length > 0 ? JSON.stringify(args) : ''}`);
  }
};

// Special diagnostic logger for schedule generation
export const scheduleLogger = {
  // Keep pino's structure/methods
  ...logger, 
  // Override methods to ONLY write to schedule diagnostics file
  info: (obj: any, msg?: string, ...args: any[]) => {
    // logger.info(obj, msg, ...args); // Remove call to base console logger
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(scheduleLogPath, `INFO: ${logMessage} ${args.length > 0 ? JSON.stringify(args) : ''}`);
  },
  debug: (obj: any, msg?: string, ...args: any[]) => {
    // logger.debug(obj, msg, ...args); // Remove call to base console logger
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(scheduleLogPath, `DEBUG: ${logMessage} ${args.length > 0 ? JSON.stringify(args) : ''}`);
  },
  error: (obj: any, msg?: string, ...args: any[]) => {
    // logger.error(obj, msg, ...args); // Remove call to base console logger
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(scheduleLogPath, `ERROR: ${logMessage} ${args.length > 0 ? JSON.stringify(args) : ''}`);
  },
  warn: (obj: any, msg?: string, ...args: any[]) => {
    // logger.warn(obj, msg, ...args); // Remove call to base console logger
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(scheduleLogPath, `WARN: ${logMessage} ${args.length > 0 ? JSON.stringify(args) : ''}`);
  },
  log: (obj: any, msg?: string, ...args: any[]) => { // Keep custom .log method if needed
    // logger.info(obj, msg, ...args); // Remove call to base console logger
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(scheduleLogPath, `LOG: ${logMessage} ${args.length > 0 ? JSON.stringify(args) : ''}`);
  }
};

export default enhancedLogger; 