/**
 * Quick test script to verify source citation functionality
 */

const http = require('http');

const testQuestion = "Wie hoch sind die Roaming-Gebühren?";

const postData = JSON.stringify({
  question: testQuestion
});

const options = {
  hostname: '127.0.0.1',
  port: 3002,
  path: '/api/answer',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'x-session-id': 'test-session-source-citation'
  }
};

console.log('🧪 Testing source citation functionality...');
console.log(`❓ Question: ${testQuestion}`);
console.log('');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('✅ Response received:');
      console.log(`   Answer: ${response.answer}`);
      console.log(`   Confidence: ${response.confidence}`);
      console.log(`   Source ID: ${response.sourceId || 'none'}`);
      console.log(`   Timestamp: ${response.timestamp}`);
      
      if (response.sourceId) {
        console.log('');
        console.log('🎯 SOURCE CITATION WORKING! ✅');
        console.log(`   FAQ source: ${response.sourceId}`);
      } else {
        console.log('');
        console.log('⚠️  No source ID returned');
      }
    } catch (error) {
      console.error('❌ Error parsing response:', error.message);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
});

req.write(postData);
req.end();
