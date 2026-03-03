import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts }) => {
  return `[${ts}] ${level.toUpperCase().padEnd(5)} ${message}`;
});

const logger = winston.createLogger({
  level: 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat,
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat,
      ),
    }),
    new winston.transports.File({
      filename: 'tradelab.log',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

export default logger;
