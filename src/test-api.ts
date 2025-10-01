import { buildApp } from './app.js';

async function testAPI() {
  console.log('🧪 Testing Chatbot API...\n');
  
  try {
    // Create app instance
    const app = await buildApp();
    
    console.log('✅ App created successfully');
    
    // Test health endpoint
    const healthResponse = await app.inject({
      method: 'GET',
      url: '/health'
    });
    
    console.log('📋 Health Check:');
    console.log(`   Status: ${healthResponse.statusCode}`);
    console.log(`   Response: ${healthResponse.body}\n`);
    
    // Test answer endpoint with valid question
    const answerResponse = await app.inject({
      method: 'POST',
      url: '/api/answer',
      payload: { question: 'What is your refund policy?' }
    });
    
    console.log('💬 Answer API (Valid Question):');
    console.log(`   Status: ${answerResponse.statusCode}`);
    console.log(`   Response: ${answerResponse.body}\n`);
    
    // Test answer endpoint with invalid request
    const invalidResponse = await app.inject({
      method: 'POST',
      url: '/api/answer',
      payload: { question: '' }
    });
    
    console.log('❌ Answer API (Invalid Question):');
    console.log(`   Status: ${invalidResponse.statusCode}`);
    console.log(`   Response: ${invalidResponse.body}\n`);
    
    // Test answer endpoint with unmatched question
    const unmatchedResponse = await app.inject({
      method: 'POST',
      url: '/api/answer',
      payload: { question: 'xyz123nonexistent question about nothing' }
    });
    
    console.log('🤷 Answer API (No Match):');
    console.log(`   Status: ${unmatchedResponse.statusCode}`);
    console.log(`   Response: ${unmatchedResponse.body}\n`);
    
    console.log('🎉 All tests completed!');
    
    await app.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
testAPI();
