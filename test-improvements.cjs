/**
 * Quick test of specific improvements
 */
const http = require('http');

async function askQuestion(question, sessionId = 'test') {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ question });
    
    const options = {
      hostname: '127.0.0.1',
      port: 3002,
      path: '/api/answer',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'x-session-id': sessionId
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function testImprovements() {
  console.log('🔧 Testing FAQ Improvements');
  console.log('============================');
  
  try {
    // Test the specific issue: "Vertrag kündigen"
    console.log('\n1. Testing: "Vertrag kündigen"');
    const result1 = await askQuestion("Vertrag kündigen");
    console.log(`   Result: ${result1.sourceId || 'none'} (confidence: ${result1.confidence})`);
    console.log(`   Expected: kundigung-frist`);
    console.log(`   ${result1.sourceId === 'kundigung-frist' ? '✅ FIXED!' : '❌ Still broken'}`);
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Test general billing question
    console.log('\n2. Testing: "Frage zu meiner Rechnung"');
    const result2 = await askQuestion("Frage zu meiner Rechnung");
    console.log(`   Result: ${result2.sourceId || 'none'} (confidence: ${result2.confidence})`);
    console.log(`   Expected: rechnung-online`);
    console.log(`   ${result2.sourceId === 'rechnung-online' ? '✅ FIXED!' : '❌ Still issues'}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testImprovements();
