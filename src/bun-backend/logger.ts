import pino from 'pino';
import fs from 'fs';
import path from 'path';

// Ensure logs directories exist with absolute paths
const logsDir = path.resolve(__dirname, '../../logs');
const diagnosticDir = path.resolve(logsDir, 'diagnostic');

console.log(`Creating log directories at: ${logsDir} and ${diagnosticDir}`);

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
    console.error(`Error writing to log file ${filePath}:`, err);
  }
};

// Create a basic pino logger for console
const logger = pino({
  level: logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

// Extend logger with custom file logging
const enhancedLogger = {
  ...logger,
  child: (bindings: pino.Bindings) => logger.child(bindings),
  // Override methods to also write to file
  info: (obj: any, msg?: string, ...args: any[]) => {
    logger.info(obj, msg, ...args);
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(appLogPath, `INFO: ${logMessage}`);
  },
  debug: (obj: any, msg?: string, ...args: any[]) => {
    logger.debug(obj, msg, ...args);
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(appLogPath, `DEBUG: ${logMessage}`);
  },
  error: (obj: any, msg?: string, ...args: any[]) => {
    logger.error(obj, msg, ...args);
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(appLogPath, `ERROR: ${logMessage}`);
  },
  warn: (obj: any, msg?: string, ...args: any[]) => {
    logger.warn(obj, msg, ...args);
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(appLogPath, `WARN: ${logMessage}`);
  }
};

// Special diagnostic logger for schedule generation
export const scheduleLogger = {
  ...logger,
  // Override methods to write to schedule diagnostics file
  info: (obj: any, msg?: string, ...args: any[]) => {
    logger.info(obj, msg, ...args);
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(scheduleLogPath, `INFO: ${logMessage}`);
  },
  debug: (obj: any, msg?: string, ...args: any[]) => {
    logger.debug(obj, msg, ...args);
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(scheduleLogPath, `DEBUG: ${logMessage}`);
  },
  error: (obj: any, msg?: string, ...args: any[]) => {
    logger.error(obj, msg, ...args);
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(scheduleLogPath, `ERROR: ${logMessage}`);
  },
  warn: (obj: any, msg?: string, ...args: any[]) => {
    logger.warn(obj, msg, ...args);
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(scheduleLogPath, `WARN: ${logMessage}`);
  },
  log: (obj: any, msg?: string, ...args: any[]) => {
    logger.info(obj, msg, ...args); // Log to info level
    const logMessage = typeof obj === 'object' ? (msg || JSON.stringify(obj)) : obj;
    logToFile(scheduleLogPath, `LOG: ${logMessage}`);
  }
};

export default enhancedLogger; 