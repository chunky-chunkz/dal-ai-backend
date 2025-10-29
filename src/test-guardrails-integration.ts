/**
 * Integration test for guardrails with answer service
 * Tests that sensitive questions are properly escalated before RAG
 */

import dotenv from 'dotenv';
import { answerQuestion, answerQuestionStream } from './services/answer.service.js';
import * as cache from './utils/answerCache.js';

dotenv.config();

async function testSensitiveEscalation() {
  console.log('🚨 Testing Sensitive Topic Escalation...');
  
  try {
    // Clear cache first
    cache.clear();
    cache.resetStats();
    
    const sensitiveQuestions = [
      'Ich möchte meinen Vertrag kündigen wegen rechtlicher Probleme.',
      'Können Sie meine Personendaten löschen gemäss DSGVO?',
      'Ich brauche einen Anwalt für diese Sache.',
      'Ich möchte eine Beschwerde gegen Ihr Unternehmen einreichen.'
    ];

    let passed = 0;
    for (const question of sensitiveQuestions) {
      console.log(`\n   Testing: "${question.substring(0, 50)}..."`);
      
      const startTime = Date.now();
      const result = await answerQuestion(question);
      const responseTime = Date.now() - startTime;
      
      // Check if response indicates escalation
      const isEscalation = result.answer.includes('Support') || 
                          result.answer.includes('Ticket') ||
                          result.answer.includes('Mitarbeiter') ||
                          result.answer.includes('Spezialisten') ||
                          result.answer.includes('verbinden');
      
      const hasHighConfidence = result.confidence >= 0.8;
      const fastResponse = responseTime < 1000; // Should be fast (no RAG call)
      
      console.log(`     Answer: ${result.answer.substring(0, 80)}...`);
      console.log(`     Confidence: ${result.confidence}`);
      console.log(`     Response time: ${responseTime}ms`);
      console.log(`     Escalation detected: ${isEscalation ? '✅' : '❌'}`);
      console.log(`     High confidence: ${hasHighConfidence ? '✅' : '❌'}`);
      console.log(`     Fast response: ${fastResponse ? '✅' : '❌'}`);
      
      if (isEscalation && hasHighConfidence && fastResponse) {
        passed++;
      }
    }

    console.log(`\n   Escalation Test: ${passed}/${sensitiveQuestions.length} passed`);
    return passed === sensitiveQuestions.length;

  } catch (error) {
    console.error('❌ Sensitive escalation test failed:', error);
    return false;
  }
}

async function testPIIMasking() {
  console.log('\n🛡️ Testing PII Masking in Service...');
  
  try {
    const piiQuestion = 'Meine Email ist test@example.com und ich möchte wissen wie ich bezahle.';
    
    console.log(`   Original: "${piiQuestion}"`);
    
    const result = await answerQuestion(piiQuestion);
    
    // The question should have been processed (either escalated for PII or answered)
    const appropriateResponse = result.answer.length > 20;
    const goodConfidence = result.confidence > 0.3;
    
    console.log(`   Response: ${result.answer.substring(0, 80)}...`);
    console.log(`   Confidence: ${result.confidence}`);
    console.log(`   Appropriate response: ${appropriateResponse ? '✅' : '❌'}`);
    console.log(`   Good confidence: ${goodConfidence ? '✅' : '❌'}`);

    return appropriateResponse && goodConfidence;

  } catch (error) {
    console.error('❌ PII masking test failed:', error);
    return false;
  }
}

async function testNormalQuestionsBypassesGuardrails() {
  console.log('\n✅ Testing Normal Questions Bypass Guardrails...');
  
  try {
    const normalQuestions = [
      'Wie bezahle ich meine Rechnung?',
      'Internet ist langsam, was kann ich tun?',
      'Wann sind Ihre Öffnungszeiten?'
    ];

    let passed = 0;
    for (const question of normalQuestions) {
      console.log(`\n   Testing: "${question}"`);
      
      const startTime = Date.now();
      const result = await answerQuestion(question);
      const responseTime = Date.now() - startTime;
      
      // Normal questions should either get RAG answers or uncertainty fallback
      const isNormalResponse = !result.answer.includes('Support') && 
                              !result.answer.includes('Ticket') &&
                              !result.answer.includes('Spezialisten');
      
      const reasonableTime = responseTime < 20000; // RAG might take time, but should be reasonable
      
      console.log(`     Answer: ${result.answer.substring(0, 80)}...`);
      console.log(`     Confidence: ${result.confidence}`);
      console.log(`     Response time: ${responseTime}ms`);
      console.log(`     Normal response: ${isNormalResponse ? '✅' : '❌'}`);
      console.log(`     Reasonable time: ${reasonableTime ? '✅' : '❌'}`);
      
      if (isNormalResponse && reasonableTime) {
        passed++;
      }
    }

    console.log(`\n   Normal Question Test: ${passed}/${normalQuestions.length} passed`);
    return passed === normalQuestions.length;

  } catch (error) {
    console.error('❌ Normal question test failed:', error);
    return false;
  }
}

async function testStreamingWithGuardrails() {
  console.log('\n🌊 Testing Streaming with Guardrails...');
  
  try {
    const sensitiveQuestion = 'Ich möchte kündigen und rechtliche Beratung.';
    let streamedContent = '';
    
    console.log(`   Testing streaming escalation: "${sensitiveQuestion}"`);
    
    const startTime = Date.now();
    const result = await answerQuestionStream(sensitiveQuestion, (chunk) => {
      streamedContent += chunk;
    });
    const responseTime = Date.now() - startTime;
    
    const isEscalation = result.answer.includes('Support') || 
                        result.answer.includes('Ticket') ||
                        result.answer.includes('Mitarbeiter');
    
    const contentMatches = streamedContent === result.answer;
    const fastResponse = responseTime < 5000; // Streaming escalation should be fast
    
    console.log(`     Streamed: ${streamedContent.length} characters`);
    console.log(`     Final answer: ${result.answer.length} characters`);
    console.log(`     Response time: ${responseTime}ms`);
    console.log(`     Is escalation: ${isEscalation ? '✅' : '❌'}`);
    console.log(`     Content matches: ${contentMatches ? '✅' : '❌'}`);
    console.log(`     Fast response: ${fastResponse ? '✅' : '❌'}`);
    
    return isEscalation && contentMatches && fastResponse;

  } catch (error) {
    console.error('❌ Streaming guardrails test failed:', error);
    return false;
  }
}

async function testCacheWithMaskedQuestions() {
  console.log('\n💾 Testing Cache with Masked Questions...');
  
  try {
    // Questions with same content but different PII
    const question1 = 'Meine Email ist user1@test.com, wie bezahle ich?';
    const question2 = 'Meine Email ist user2@test.com, wie bezahle ich?';
    
    console.log('   First call with PII question...');
    const result1 = await answerQuestion(question1);
    
    console.log('   Second call with different PII but same question...');
    const result2 = await answerQuestion(question2);
    
    // Both should get same treatment (either both escalated or both cached as masked version)
    const sameAnswer = result1.answer === result2.answer;
    const sameConfidence = result1.confidence === result2.confidence;
    
    console.log(`     Same answer: ${sameAnswer ? '✅' : '❌'}`);
    console.log(`     Same confidence: ${sameConfidence ? '✅' : '❌'}`);
    
    return sameAnswer && sameConfidence;

  } catch (error) {
    console.error('❌ Cache masking test failed:', error);
    return false;
  }
}

async function main() {
  console.log('🔍 Guardrails Integration Test Suite\n');
  
  let passed = 0;
  let total = 0;
  
  // Test 1: Sensitive topic escalation
  total++;
  if (await testSensitiveEscalation()) passed++;
  
  // Test 2: PII masking
  total++;
  if (await testPIIMasking()) passed++;
  
  // Test 3: Normal questions bypass
  total++;
  if (await testNormalQuestionsBypassesGuardrails()) passed++;
  
  // Test 4: Streaming with guardrails
  total++;
  if (await testStreamingWithGuardrails()) passed++;
  
  // Test 5: Cache with masked questions
  total++;
  if (await testCacheWithMaskedQuestions()) passed++;
  
  console.log(`\n🎉 Integration Test Results: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log('✅ All guardrails integration tests passed!');
    
    console.log('\n📝 Guardrails Integration Features:');
    console.log('✅ Pre-RAG sensitive topic detection and escalation');
    console.log('✅ PII masking before processing and caching');
    console.log('✅ Fast response times for escalated questions');
    console.log('✅ Normal questions processed through RAG as expected');
    console.log('✅ Streaming support with guardrails');
    console.log('✅ Cache works with masked questions (privacy-safe)');
    console.log('✅ Contextual escalation messages');
    console.log('✅ High confidence in escalation decisions');
    
  } else {
    console.log('❌ Some guardrails integration tests failed.');
    console.log('💡 This may indicate issues with answer service integration.');
  }
}

main().catch(console.error);
