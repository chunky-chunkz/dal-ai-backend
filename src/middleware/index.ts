// Export authentication middleware
export * from './authGuard';

// Re-export for convenience
export { requireAuth, optionalAuth, getCurrentUserId, getCurrentSessionId } from './authGuard';
