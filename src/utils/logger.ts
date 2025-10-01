import pino from 'pino';
import { CONFIG } from './config';

/**
 * Create pino logger with pretty transport in development
 */
const logger = pino({
  level: CONFIG.NODE_ENV === 'production' ? 'info' : 'debug',
  ...(CONFIG.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    }
  })
});

export default logger;
