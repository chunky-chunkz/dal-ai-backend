/**
 * Test script for the SSE endpoint implementation
 * Uses fetch with streaming for testing the /api/answer/stream endpoint
 */

/**
 * Test the SSE streaming endpoint using fetch
 */
async function testSSEEndpoint() {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
  const question = encodeURIComponent('Wie kann ich meine Rechnung bezahlen?');
  const url = `${baseUrl}/api/answer/stream?question=${question}`;
  
  console.log(`🧪 Testing SSE endpoint: ${url}\n`);
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    console.log('✅ Response headers:');
    console.log(`   Content-Type: ${response.headers.get('content-type')}`);
    console.log(`   Cache-Control: ${response.headers.get('cache-control')}`);
    console.log(`   Connection: ${response.headers.get('connection')}`);
    console.log(`   Access-Control-Allow-Origin: ${response.headers.get('access-control-allow-origin')}`);
    console.log('');
    
    if (!response.body) {
      throw new Error('No response body');
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let answer = '';
    
    console.log('� Streaming response:');
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('\n\n✅ Stream ended');
        break;
      }
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          if (data === '[DONE]') {
            console.log('\n\n✅ Stream completed with [DONE] marker');
            console.log(`📝 Full answer: "${answer}"`);
            return;
          } else if (data === '[ERROR]') {
            console.log('\n\n❌ Stream ended with [ERROR] marker');
            throw new Error('Stream error');
          } else if (data.trim()) {
            process.stdout.write(data);
            answer += data;
          }
        }
      }
    }
    
  } catch (error) {
    console.error('\n\n🚨 Test failed:', error);
    throw error;
  }
}

/**
 * Test with invalid question (should return 400)
 */
async function testInvalidQuestion() {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
  const question = encodeURIComponent('hi'); // Too short (< 3 chars)
  const url = `${baseUrl}/api/answer/stream?question=${question}`;
  
  console.log(`🧪 Testing invalid question: ${url}\n`);
  
  try {
    const response = await fetch(url);
    if (response.status === 400) {
      const error = await response.json();
      console.log('✅ Correctly rejected invalid question:', error);
    } else {
      console.log('❌ Expected 400 status but got:', response.status);
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

/**
 * Test missing question parameter
 */
async function testMissingQuestion() {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
  const url = `${baseUrl}/api/answer/stream`;
  
  console.log(`🧪 Testing missing question: ${url}\n`);
  
  try {
    const response = await fetch(url);
    if (response.status === 400) {
      const error = await response.json();
      console.log('✅ Correctly rejected missing question:', error);
    } else {
      console.log('❌ Expected 400 status but got:', response.status);
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    console.log('🚀 Starting SSE endpoint tests...\n');
    
    console.log('='.repeat(50));
    console.log('Test 1: Valid streaming request');
    console.log('='.repeat(50));
    await testSSEEndpoint();
    
    console.log('\n' + '='.repeat(50));
    console.log('Test 2: Invalid question validation');
    console.log('='.repeat(50));
    await testInvalidQuestion();
    
    console.log('\n' + '='.repeat(50));
    console.log('Test 3: Missing question parameter');
    console.log('='.repeat(50));
    await testMissingQuestion();
    
    console.log('\n\n🎉 All tests completed!');
    
  } catch (error) {
    console.error('\n\n💥 Test failed:', error);
    process.exit(1);
  }
}

export { testSSEEndpoint, testInvalidQuestion, testMissingQuestion, runTests };
