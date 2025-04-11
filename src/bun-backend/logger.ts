import pino from 'pino';

// Configure Pino Logger
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info');

const logger = pino({
  level: logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      levelFirst: true,
      translateTime: 'SYS:HH:MM:ss.l',
      ignore: 'pid,hostname,reqId,req,res', // Ignore these fields in pretty print
      messageFormat: '(reqId:{reqId}) {msg}', // Add reqId to the message
    },
  },
});

export default logger; 