/**
 * Test script for Answer API endpoints
 * Tests both POST /api/answer and GET /api/answer/stream
 */

import dotenv from 'dotenv';

dotenv.config();

const API_BASE = 'http://localhost:3001/api';

async function testPostAnswer() {
  console.log('🔧 Testing POST /api/answer...');
  
  try {
    const response = await fetch(`${API_BASE}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        question: 'Wie bezahle ich meine Rechnung?'
      })
    });

    if (!response.ok) {
      console.error('❌ POST request failed:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return;
    }

    const result = await response.json();
    console.log('✅ POST /api/answer response:');
    console.log(`   Answer: ${result.answer}`);
    console.log(`   Confidence: ${result.confidence}`);
    console.log(`   Source ID: ${result.sourceId || 'none'}`);
    console.log(`   Timestamp: ${result.timestamp}`);
    
  } catch (error) {
    console.error('❌ POST request error:', error);
  }
}

async function testStreamAnswer() {
  console.log('\n🌊 Testing GET /api/answer/stream...');
  
  try {
    const question = encodeURIComponent('Router zurücksetzen');
    const response = await fetch(`${API_BASE}/answer/stream?question=${question}`, {
      headers: {
        'Accept': 'text/event-stream'
      }
    });

    if (!response.ok) {
      console.error('❌ Stream request failed:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return;
    }

    console.log('✅ Stream started, receiving data...');
    
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    
    if (!reader) {
      console.error('❌ No response body reader available');
      return;
    }

    let streamedText = '';
    let eventCount = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          eventCount++;
          
          if (data === '[DONE]') {
            console.log('\n📋 Stream completed with [DONE] marker');
          } else if (data.trim()) {
            try {
              const parsed = JSON.parse(data);
              if (parsed.confidence !== undefined) {
                console.log('📊 Final metadata:', parsed);
              } else {
                streamedText += data;
                process.stdout.write('🔤 ');
              }
            } catch {
              // Regular text token
              streamedText += data;
              process.stdout.write('.');
            }
          }
        }
        
        if (line.startsWith('event: complete')) {
          console.log('\n✅ Stream completed successfully');
        }
        
        if (line.startsWith('event: error')) {
          console.log('\n❌ Stream error event received');
        }
      }
    }
    
    console.log(`\n📝 Streamed text: "${streamedText}"`);
    console.log(`📊 Total events received: ${eventCount}`);
    
  } catch (error) {
    console.error('❌ Stream request error:', error);
  }
}

async function testValidation() {
  console.log('\n🔍 Testing input validation...');
  
  // Test POST with invalid input
  try {
    const response = await fetch(`${API_BASE}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        question: 'ab'  // Too short
      })
    });

    if (response.status === 400) {
      const error = await response.json();
      console.log('✅ POST validation working:', error.message);
    } else {
      console.log('❌ POST validation failed, expected 400 but got:', response.status);
    }
  } catch (error) {
    console.error('❌ POST validation test error:', error);
  }

  // Test GET stream with invalid input
  try {
    const question = encodeURIComponent('a');  // Too short
    const response = await fetch(`${API_BASE}/answer/stream?question=${question}`);

    if (response.status === 400) {
      const error = await response.json();
      console.log('✅ GET stream validation working:', error.message);
    } else {
      console.log('❌ GET stream validation failed, expected 400 but got:', response.status);
    }
  } catch (error) {
    console.error('❌ GET stream validation test error:', error);
  }
}

async function main() {
  console.log('🚀 Testing Answer API Routes\n');
  
  await testPostAnswer();
  await testStreamAnswer();
  await testValidation();
  
  console.log('\n🎉 All tests completed!');
}

main().catch(console.error);
