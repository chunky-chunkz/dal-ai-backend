/**
 * Test script for CORS and SSE settings verification
 */

/**
 * Test CORS configuration
 */
async function testCORS() {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
  
  console.log('🧪 Testing CORS configuration...\n');
  
  try {
    // Test preflight request
    const preflightResponse = await fetch(`${baseUrl}/api/answer`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    
    console.log('✅ Preflight Response Headers:');
    console.log(`   Access-Control-Allow-Origin: ${preflightResponse.headers.get('access-control-allow-origin')}`);
    console.log(`   Access-Control-Allow-Methods: ${preflightResponse.headers.get('access-control-allow-methods')}`);
    console.log(`   Access-Control-Allow-Headers: ${preflightResponse.headers.get('access-control-allow-headers')}`);
    console.log(`   Access-Control-Allow-Credentials: ${preflightResponse.headers.get('access-control-allow-credentials')}`);
    
  } catch (error) {
    console.error('❌ CORS test failed:', error);
  }
}

/**
 * Test health endpoint
 */
async function testHealthEndpoint() {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
  const url = `${baseUrl}/health`;
  
  console.log(`🧪 Testing health endpoint: ${url}\n`);
  
  try {
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json() as any;
      console.log('✅ Health endpoint response:');
      console.log(`   Status: ${data.status}`);
      console.log(`   Timestamp: ${data.timestamp}`);
      console.log(`   Version: ${data.version || 'N/A'}`);
    } else {
      console.log(`❌ Health endpoint returned: ${response.status} ${response.statusText}`);
    }
    
  } catch (error) {
    console.error('❌ Health endpoint test failed:', error);
  }
}

/**
 * Test SSE-specific headers
 */
async function testSSEHeaders() {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
  const question = encodeURIComponent('Test question for headers');
  const url = `${baseUrl}/api/answer/stream?question=${question}`;
  
  console.log(`🧪 Testing SSE headers: ${url}\n`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'text/event-stream'
      }
    });
    
    console.log('✅ SSE Response Headers:');
    console.log(`   Content-Type: ${response.headers.get('content-type')}`);
    console.log(`   Cache-Control: ${response.headers.get('cache-control')}`);
    console.log(`   Connection: ${response.headers.get('connection')}`);
    console.log(`   Access-Control-Allow-Origin: ${response.headers.get('access-control-allow-origin')}`);
    console.log(`   Transfer-Encoding: ${response.headers.get('transfer-encoding') || 'None'}`);
    console.log(`   Content-Encoding: ${response.headers.get('content-encoding') || 'None (good for SSE)'}`);
    
    // Close the stream quickly for testing
    response.body?.cancel();
    
  } catch (error) {
    console.error('❌ SSE headers test failed:', error);
  }
}

/**
 * Test CORS with different origins
 */
async function testCORSOrigins() {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
  const testOrigins = [
    'http://localhost:5173',  // Default development origin
    'http://localhost:3000',  // Alternative development origin
    'https://example.com'     // External origin (should be rejected if CORS_ORIGIN is set)
  ];
  
  console.log('🧪 Testing CORS with different origins...\n');
  
  for (const origin of testOrigins) {
    try {
      const response = await fetch(`${baseUrl}/health`, {
        headers: {
          'Origin': origin
        }
      });
      
      const allowedOrigin = response.headers.get('access-control-allow-origin');
      const status = allowedOrigin === origin || allowedOrigin === '*' ? '✅' : '❌';
      
      console.log(`${status} Origin: ${origin}`);
      console.log(`     Allowed: ${allowedOrigin || 'None'}`);
      
    } catch (error) {
      console.log(`❌ Origin: ${origin} - Error: ${error}`);
    }
  }
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    console.log('🚀 Starting CORS & SSE Configuration Tests...\n');
    
    console.log('='.repeat(60));
    console.log('Test 1: CORS Configuration');
    console.log('='.repeat(60));
    await testCORS();
    
    console.log('\n' + '='.repeat(60));
    console.log('Test 2: Health Endpoint');
    console.log('='.repeat(60));
    await testHealthEndpoint();
    
    console.log('\n' + '='.repeat(60));
    console.log('Test 3: SSE Headers');
    console.log('='.repeat(60));
    await testSSEHeaders();
    
    console.log('\n' + '='.repeat(60));
    console.log('Test 4: CORS Origins');
    console.log('='.repeat(60));
    await testCORSOrigins();
    
    console.log('\n\n🎉 All configuration tests completed!');
    console.log('\n📋 Expected Configuration:');
    console.log('   - CORS Origin: http://localhost:5173 (or from CORS_ORIGIN env)');
    console.log('   - SSE Headers: text/event-stream, no-cache, no-transform');
    console.log('   - Health Endpoint: GET /health');
    console.log('   - No compression on /stream routes');
    
  } catch (error) {
    console.error('\n\n💥 Test failed:', error);
    process.exit(1);
  }
}

export { testCORS, testHealthEndpoint, testSSEHeaders, testCORSOrigins, runTests };
