import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Safely parse PORT with fallback to default
 */
function parsePort(portStr: string | undefined): number {
  if (!portStr) return 3000;
  const parsed = parseInt(portStr, 10);
  return isNaN(parsed) ? 3000 : parsed;
}

/**
 * Application configuration loaded from environment variables
 */
export const CONFIG = {
  PORT: parsePort(process.env.PORT),
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*'
} as const;

export default CONFIG;
