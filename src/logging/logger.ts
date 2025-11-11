import winston from 'winston';

/**
 * Log level from environment variable (default: "info")
 * Valid levels: error, warn, info, debug
 */
const logLevel = process.env.LOG_LEVEL || 'info';

/**
 * Winston logger instance configured for Kubernetes
 * 
 * - Outputs JSON format for easy parsing by log aggregation systems
 * - Includes timestamps in ISO format
 * - Console transport only (stdout) - Kubernetes best practice
 * - Log level controlled by LOG_LEVEL environment variable
 */
export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.json(),
    }),
  ],
  // Don't exit on handled exceptions
  exitOnError: false,
});

