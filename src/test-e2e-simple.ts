/**
 * Test runner for E2E tests
 * Provides a simple way to test the answer endpoints
 */

import { buildApp } from '../src/app.js';
import request from 'supertest';

// Simple E2E test to verify endpoints work
async function runQuickE2ETest() {
  console.log('🧪 Running Quick E2E Tests for Answer Endpoints\n');
  
  let passed = 0;
  let total = 0;
  
  try {
    const app = await buildApp();
    await app.ready();
    const server = app.server;
    
    // Test 1: Health endpoint
    total++;
    console.log('📝 Testing GET /health...');
    const healthResponse = await request(server).get('/health');
    if (healthResponse.status === 200 && healthResponse.body.status === 'ok') {
      console.log('   ✅ Health endpoint working');
      passed++;
    } else {
      console.log('   ❌ Health endpoint failed');
    }
    
    // Test 2: JSON answer endpoint
    total++;
    console.log('\n📝 Testing POST /api/answer (JSON)...');
    const jsonResponse = await request(server)
      .post('/api/answer')
      .send({ question: 'Wie bezahle ich meine Rechnung?' });
    
    if (jsonResponse.status === 200 && 
        jsonResponse.body.answer && 
        typeof jsonResponse.body.confidence === 'number') {
      console.log('   ✅ JSON endpoint working');
      console.log(`   📊 Confidence: ${jsonResponse.body.confidence}`);
      console.log(`   📝 Answer: ${jsonResponse.body.answer.substring(0, 60)}...`);
      passed++;
    } else {
      console.log('   ❌ JSON endpoint failed');
      console.log('   Response:', jsonResponse.body);
    }
    
    // Test 3: Streaming answer endpoint
    total++;
    console.log('\n📡 Testing GET /api/answer/stream (SSE)...');
    const question = encodeURIComponent('Wie bezahle ich meine Rechnung?');
    const streamResponse = await request(server)
      .get(`/api/answer/stream?question=${question}`);
    
    if (streamResponse.status === 200 &&
        streamResponse.headers['content-type']?.includes('text/event-stream') &&
        streamResponse.text.includes('data: [DONE]')) {
      console.log('   ✅ Streaming endpoint working');
      console.log('   📡 Content-Type: text/event-stream');
      console.log('   🔚 Contains [DONE] marker');
      
      const dataEvents = streamResponse.text.split('\n')
        .filter(line => line.startsWith('data: ')).length;
      console.log(`   📊 Data events: ${dataEvents}`);
      passed++;
    } else {
      console.log('   ❌ Streaming endpoint failed');
      console.log('   Headers:', streamResponse.headers);
    }
    
    // Test 4: Invalid input handling
    total++;
    console.log('\n⚠️ Testing invalid input handling...');
    const invalidResponse = await request(server)
      .post('/api/answer')
      .send({ question: 'Hi' }); // Too short
    
    if (invalidResponse.status === 400 &&
        invalidResponse.body.error === 'Bad Request') {
      console.log('   ✅ Input validation working');
      console.log('   📝 Error message:', invalidResponse.body.details[0].message);
      passed++;
    } else {
      console.log('   ❌ Input validation failed');
    }
    
    // Test 5: Guardrails integration
    total++;
    console.log('\n🛡️ Testing guardrails integration...');
    const sensitiveResponse = await request(server)
      .post('/api/answer')
      .send({ question: 'Ich möchte kündigen wegen rechtlicher Probleme' });
    
    if (sensitiveResponse.status === 200 &&
        sensitiveResponse.body.confidence >= 0.9 &&
        sensitiveResponse.body.answer.toLowerCase().includes('support')) {
      console.log('   ✅ Guardrails working');
      console.log(`   🎯 High confidence escalation: ${sensitiveResponse.body.confidence}`);
      passed++;
    } else {
      console.log('   ❌ Guardrails failed');
    }
    
    await app.close();
    
    console.log(`\n🎉 E2E Test Results: ${passed}/${total} passed`);
    
    if (passed === total) {
      console.log('\n✅ All E2E tests passed!');
      console.log('🚀 Answer endpoints are ready for production!');
    } else {
      console.log('\n❌ Some E2E tests failed');
      console.log('💡 Check the server configuration and dependencies');
    }
    
  } catch (error) {
    console.error('❌ E2E test setup failed:', error);
  }
}

runQuickE2ETest().catch(console.error);
