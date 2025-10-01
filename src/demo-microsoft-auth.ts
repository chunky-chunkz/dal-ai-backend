/**
 * Demo script showing Microsoft Auth status checking
 * This demonstrates how to check if Microsoft OAuth is available
 */

import 'dotenv/config';

// Simulate the logic from /auth/ms/enabled endpoint
function checkMicrosoftAuthStatus() {
  console.log('🔍 Checking Microsoft OAuth configuration...');
  
  // Check if Microsoft OAuth is properly configured
  const clientId = process.env.AZURE_CLIENT_ID || process.env.CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET || process.env.CLIENT_SECRET;
  const tenantId = process.env.AZURE_TENANT_ID || process.env.TENANT_ID;
  
  const isEnabled = !!(clientId && clientSecret && tenantId);
  
  const response = {
    enabled: isEnabled,
    provider: 'microsoft',
    name: 'Microsoft',
    type: 'oauth'
  };
  
  console.log('📊 Microsoft Auth Status:', JSON.stringify(response, null, 2));
  
  if (isEnabled) {
    console.log('✅ Microsoft OAuth is properly configured and available');
    console.log('   - Frontend can show Microsoft login option');
    console.log('   - Users can choose between local auth and Microsoft OAuth');
  } else {
    console.log('ℹ️  Microsoft OAuth is not configured');
    console.log('   - Only local email/password authentication is available');
    console.log('   - This is perfectly fine for development or local-only setups');
  }
  
  return response;
}

// Demo the available authentication routes
function showAvailableRoutes() {
  console.log('\n🛣️  Available Authentication Routes:');
  console.log('');
  
  console.log('📝 Local Authentication (Always Available):');
  console.log('   POST /api/auth/register - Create new user account');
  console.log('   POST /api/auth/login    - Login with email/password');
  console.log('   POST /api/auth/logout   - Logout current session');
  console.log('');
  
  console.log('🔐 Microsoft OAuth (Optional):');
  console.log('   GET  /auth/ms/enabled   - Check if Microsoft auth is available');
  console.log('   GET  /auth/ms/login     - Start Microsoft OAuth flow');
  console.log('   GET  /auth/callback     - Handle Microsoft OAuth callback');
  console.log('   POST /auth/ms/logout    - Microsoft-specific logout');
  console.log('');
  
  console.log('👤 Unified User Endpoints (Both Auth Types):');
  console.log('   GET  /api/me           - Get current user profile');
  console.log('   GET  /api/auth/providers - Get available auth providers');
  console.log('   GET  /auth/me          - Get user info (compatibility)');
  console.log('   GET  /auth/status      - Check auth status (compatibility)');
}

// Run the demo
console.log('🚀 Microsoft OAuth Integration Demo\n');

checkMicrosoftAuthStatus();
showAvailableRoutes();

console.log('\n💡 Frontend Integration Example:');
console.log(`
// Check if Microsoft auth is available
fetch('/auth/ms/enabled')
  .then(res => res.json())
  .then(data => {
    if (data.enabled) {
      showMicrosoftLoginButton();
    }
    // Always show local auth option
    showLocalAuthForm();
  });
`);

export { checkMicrosoftAuthStatus };
