import fastify from 'fastify';
import { registerLocalAuthRoutes } from './auth/local.routes';
import registerUserRoutes from './routes/user.routes';
import { authRoutes } from './auth/auth.routes';

// Demo script showing how to integrate all auth routes
export function setupAuthRoutes(app: ReturnType<typeof fastify>) {
  console.log('🔐 Setting up authentication routes...');

  // Register local auth routes (register, login, logout)
  app.register(registerLocalAuthRoutes, { prefix: '/api/auth' });
  console.log('   ✅ Local auth routes: /api/auth/register, /api/auth/login, /api/auth/logout');

  // Register Microsoft OAuth routes (optional)
  app.register(authRoutes, { prefix: '/auth' });
  console.log('   ✅ Microsoft auth routes: /auth/ms/enabled, /auth/ms/login, /auth/callback, /auth/ms/logout');

  // Register user routes (profile, providers)
  app.register(registerUserRoutes, { prefix: '/api' });
  console.log('   ✅ User routes: /api/me, /api/auth/providers, /api/profile (Microsoft)');
  
  console.log('🚀 Authentication system ready!');
  console.log('');
  console.log('Available endpoints:');
  console.log('   POST /api/auth/register - Create new local user account');
  console.log('   POST /api/auth/login    - Login with email/password');
  console.log('   POST /api/auth/logout   - Logout current session');
  console.log('   GET  /auth/ms/enabled   - Check if Microsoft auth is available');
  console.log('   GET  /auth/ms/login     - Start Microsoft OAuth login (optional)');
  console.log('   GET  /auth/callback     - Microsoft OAuth callback handler');
  console.log('   POST /auth/ms/logout    - Microsoft-specific logout');
  console.log('   GET  /api/me           - Get current user profile (auth required)');
  console.log('   GET  /api/auth/providers - Get available auth providers (public)');
  console.log('   GET  /api/profile      - Microsoft Graph profile (Microsoft auth)');
  console.log('');
  console.log('Environment variables needed:');
  console.log('   SESSION_SECRET - Secret for signing cookies');
  console.log('   BCRYPT_ROUNDS  - BCrypt work factor (optional, default: 12)');
  console.log('   ARGON2_*       - Argon2 tuning parameters (optional)');
}

// Example usage in your main app.ts:
/*
import { setupAuthRoutes } from './demo-auth-setup';

const app = fastify({
  logger: true
});

// Setup CORS, other middleware...

// Register authentication routes
setupAuthRoutes(app);

// Start server...
*/
