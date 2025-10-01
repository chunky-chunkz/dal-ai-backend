// Export both user storage implementations
// Choose one based on your needs:

// Option 1: JSON File Storage (Development/Quick Setup)
export * as userStore from './user.store';

// Option 2: Prisma Database Repository (Production)
export * as userRepo from './user.repo';

// Re-export types for convenience
export type { User, CreateUserData, UpdateUserData } from './user.store';

// Helper to choose implementation based on environment
const USE_DATABASE = process.env.NODE_ENV === 'production' || process.env.USE_DATABASE === 'true';

// Dynamic export based on environment
export const userService = USE_DATABASE 
  ? require('./user.repo')
  : require('./user.store');
