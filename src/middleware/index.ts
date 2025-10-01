// Export authentication middleware
export * from './authGuard.js';

// Re-export for convenience
export { requireAuth, optionalAuth, getCurrentUserId, getCurrentSessionId } from './authGuard.js';
