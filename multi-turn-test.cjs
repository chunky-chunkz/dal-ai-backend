/**
 * Simple multi-turn evaluation test
 */
const http = require('http');

async function askQuestion(question, sessionId) {
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

async function runMultiTurnTest() {
  console.log('🔄 Multi-Turn Memory Test');
  console.log('=========================');
  
  const sessions = [
    {
      sessionId: "test-session-1",
      description: "Router troubleshooting sequence",
      turns: [
        { question: "Mein Internet funktioniert nicht", expectedId: "router-reset" },
        { question: "Ich habe es neugestartet, geht aber nicht", expectedId: "störung-melden" }
      ]
    },
    {
      sessionId: "test-session-2", 
      description: "Billing question sequence",
      turns: [
        { question: "Frage zu meiner Rechnung", expectedId: "rechnung-online" },
        { question: "Wie lange zum Bezahlen?", expectedId: "rechnung-frist" }
      ]
    }
  ];
  
  let totalTurns = 0;
  let correctTurns = 0;
  
  for (const session of sessions) {
    console.log(`\n📋 Session: ${session.description}`);
    
    for (const [index, turn] of session.turns.entries()) {
      console.log(`\n   Turn ${index + 1}: "${turn.question}"`);
      
      try {
        const { response, responseTime } = await askQuestion(turn.question, session.sessionId);
        
        const isCorrect = response.sourceId === turn.expectedId;
        totalTurns++;
        if (isCorrect) correctTurns++;
        
        console.log(`      Expected: ${turn.expectedId}`);
        console.log(`      Actual: ${response.sourceId || 'none'}`);
        console.log(`      Confidence: ${response.confidence.toFixed(3)}`);
        console.log(`      ${isCorrect ? '✅' : '❌'} (${responseTime}ms)`);
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`      ❌ Error: ${error.message}`);
        totalTurns++;
      }
    }
  }
  
  const accuracy = totalTurns > 0 ? (correctTurns / totalTurns) * 100 : 0;
  
  console.log('\n📊 MULTI-TURN RESULTS');
  console.log('=====================');
  console.log(`Total Turns: ${totalTurns}`);
  console.log(`Correct: ${correctTurns}`);
  console.log(`Memory Accuracy: ${accuracy.toFixed(1)}%`);
  
  if (accuracy >= 75) {
    console.log('✅ Memory system working well!');
  } else {
    console.log('⚠️  Memory system needs improvement');
  }
}

runMultiTurnTest().catch(console.error);
