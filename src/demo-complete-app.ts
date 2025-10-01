/**
 * Complete App Demo
 * 
 * This script demonstrates the fully integrated authentication system
 * with both local email/password and Microsoft OAuth working side-by-side.
 */

import { buildApp } from './app.js';

async function demoCompleteApp() {
  console.log('🚀 Starting Complete DAL-AI Authentication Demo\n');

  try {
    // Build the app with all routes
    console.log('📝 Building Fastify app with integrated authentication...');
    const app = await buildApp();
    await app.ready();

    console.log('✅ App built successfully!\n');

    // Show all registered routes
    console.log('🛣️  All Available Routes:');
    console.log('');
    
    console.log('🏥 Health & System:');
    console.log('   GET  /health                 - System health check');
    console.log('');
    
    console.log('📧 Local Authentication (Email/Password):');
    console.log('   POST /api/auth/register      - Create new user account');
    console.log('   POST /api/auth/login         - Login with credentials');
    console.log('   POST /api/auth/logout        - Logout current session');
    console.log('   GET  /api/auth/session       - Session debug info (protected)');
    console.log('');
    
    console.log('🔐 Microsoft OAuth (Optional):');
    console.log('   GET  /auth/ms/enabled        - Check Microsoft auth availability');
    console.log('   GET  /auth/ms/login          - Start Microsoft OAuth flow');
    console.log('   GET  /auth/callback          - Microsoft OAuth callback');
    console.log('   GET  /auth/ms/callback       - Microsoft OAuth callback (alt)');
    console.log('   POST /auth/ms/logout         - Microsoft-specific logout');
    console.log('   GET  /auth/me                - User info (compatibility)');
    console.log('   GET  /auth/status            - Auth status (compatibility)');
    console.log('');
    
    console.log('👤 Unified User Management:');
    console.log('   GET  /api/me                 - Current user profile (both auth types)');
    console.log('   GET  /api/auth/providers     - Available auth providers');
    console.log('   GET  /api/profile            - Microsoft Graph profile');
    console.log('');

    // Test core functionality
    console.log('🧪 Testing Core Endpoints:');
    console.log('');

    // Test health endpoint
    const healthResponse = await app.inject({
      method: 'GET',
      url: '/health'
    });
    
    const healthData = JSON.parse(healthResponse.body);
    console.log(`✅ Health Check: ${healthData.status} (${healthResponse.statusCode})`);

    // Test Microsoft auth status
    const msResponse = await app.inject({
      method: 'GET',
      url: '/auth/ms/enabled'
    });
    
    const msData = JSON.parse(msResponse.body);
    console.log(`🔐 Microsoft Auth: ${msData.enabled ? 'Available' : 'Not configured'} (${msResponse.statusCode})`);

    // Test auth providers
    const providersResponse = await app.inject({
      method: 'GET',
      url: '/api/auth/providers'
    });
    
    const providersData = JSON.parse(providersResponse.body);
    console.log(`📋 Auth Providers: Local=${providersData.local}, Microsoft=${providersData.microsoft} (${providersResponse.statusCode})`);

    // Test protected endpoint (should return 401)
    const protectedResponse = await app.inject({
      method: 'GET',
      url: '/api/me'
    });
    
    console.log(`🔒 Protected Endpoint: ${protectedResponse.statusCode === 401 ? 'Properly secured' : 'Security issue!'}`);

    console.log('');
    console.log('🎯 Configuration Summary:');
    console.log(`   CORS Origin: ${process.env.FRONTEND_ORIGIN || process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
    console.log(`   Session Secret: ${process.env.SESSION_SECRET ? 'Configured' : 'Using default (change in production!)'}`);
    console.log(`   Microsoft OAuth: ${msData.enabled ? 'Enabled' : 'Disabled'}`);
    console.log('');

    console.log('🎉 Integration Complete!');
    console.log('');
    console.log('💡 Next Steps:');
    console.log('   1. Set FRONTEND_ORIGIN environment variable');
    console.log('   2. Set SESSION_SECRET to a secure random string'); 
    console.log('   3. Configure Microsoft OAuth (optional):');
    console.log('      - AZURE_CLIENT_ID');
    console.log('      - AZURE_CLIENT_SECRET');
    console.log('      - AZURE_TENANT_ID');
    console.log('   4. Start your frontend application');
    console.log('   5. Users can choose between local auth and Microsoft OAuth!');

    // Clean up
    await app.close();

  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Run demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demoCompleteApp().catch(console.error);
}

export { demoCompleteApp };
