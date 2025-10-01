/**
 * Simple evaluation test
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

async function askQuestion(question, sessionId = 'eval-session') {
  const startTime = Date.now();
  
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

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        try {
          const response = JSON.parse(data);
          resolve({ response, responseTime });
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function runQuickEval() {
  console.log('🧪 Quick Evaluation Test');
  console.log('========================');
  
  const testCases = [
    { question: "EU-Roaming kostenlos?", expectedId: "roaming-ausland" },
    { question: "Router neu starten", expectedId: "router-reset" },
    { question: "Rechnung bezahlen", expectedId: "rechnung-frist" },
    { question: "Internet zu langsam", expectedId: "dsl-geschwindigkeit" },
    { question: "Vertrag kündigen", expectedId: "kundigung-frist" }
  ];
  
  let correct = 0;
  let fallbacks = 0;
  const times = [];
  
  for (const [index, testCase] of testCases.entries()) {
    console.log(`\n${index + 1}/${testCases.length}: "${testCase.question}"`);
    
    try {
      const { response, responseTime } = await askQuestion(testCase.question);
      
      const isCorrect = response.sourceId === testCase.expectedId;
      const isFallback = response.confidence < 0.5;
      
      if (isCorrect) correct++;
      if (isFallback) fallbacks++;
      times.push(responseTime);
      
      console.log(`   Expected: ${testCase.expectedId}`);
      console.log(`   Actual: ${response.sourceId || 'none'}`);
      console.log(`   Confidence: ${response.confidence.toFixed(3)}`);
      console.log(`   ${isCorrect ? '✅' : '❌'} ${isFallback ? '(fallback)' : ''} (${responseTime}ms)`);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      fallbacks++;
    }
  }
  
  const accuracy = (correct / testCases.length) * 100;
  const fallbackRate = (fallbacks / testCases.length) * 100;
  const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
  const p50Time = times.sort((a, b) => a - b)[Math.floor(times.length / 2)];
  
  console.log('\n📊 RESULTS');
  console.log('==========');
  console.log(`Accuracy@1: ${accuracy.toFixed(1)}%`);
  console.log(`Fallback Rate: ${fallbackRate.toFixed(1)}%`);
  console.log(`Avg Response Time: ${Math.round(avgTime)}ms`);
  console.log(`P50 Response Time: ${Math.round(p50Time)}ms`);
  
  // Save results
  const results = {
    timestamp: new Date().toISOString(),
    accuracy: accuracy.toFixed(1),
    fallbackRate: fallbackRate.toFixed(1),
    avgResponseTime: Math.round(avgTime),
    p50ResponseTime: Math.round(p50Time),
    testCases: testCases.length,
    correct,
    fallbacks
  };
  
  const resultPath = path.join(__dirname, 'eval', `quick_eval_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
  console.log(`💾 Results saved to: ${resultPath}`);
}

runQuickEval().catch(console.error);
