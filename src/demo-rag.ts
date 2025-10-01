/**
 * Comprehensive RAG demonstration with real-world scenarios
 */

import dotenv from 'dotenv';
import { ragLocalAnswer, ragLocalAnswerStream } from './ai/rag.local.js';

dotenv.config();

interface TestScenario {
  name: string;
  question: string;
  expectedTopics: string[];
  minConfidence: number;
}

const testScenarios: TestScenario[] = [
  {
    name: 'Internet Speed Issues',
    question: 'Mein Internet ist sehr langsam, was kann ich tun?',
    expectedTopics: ['speedtest', 'router', 'ethernet'],
    minConfidence: 0.7
  },
  {
    name: 'Router Problems',
    question: 'Wie setze ich meinen WLAN-Router zurück?',
    expectedTopics: ['router', 'reset', 'neustart'],
    minConfidence: 0.8
  },
  {
    name: 'Billing Questions',
    question: 'Wann muss ich meine Rechnung bezahlen?',
    expectedTopics: ['rechnung', '30 tage', 'zahlungsfrist'],
    minConfidence: 0.7
  },
  {
    name: 'Contract Cancellation',
    question: 'Wie kann ich meinen Vertrag kündigen?',
    expectedTopics: ['kündigung', '3 monate', 'schriftlich'],
    minConfidence: 0.8
  },
  {
    name: 'Mobile Data Issues',
    question: 'Mein Datenvolumen ist aufgebraucht, was nun?',
    expectedTopics: ['datenvolumen', 'nachbuchen', 'sms'],
    minConfidence: 0.7
  },
  {
    name: 'Moving/Relocation',
    question: 'Ich ziehe um, wie melde ich das an?',
    expectedTopics: ['umzug', '4 wochen', 'kundenportal'],
    minConfidence: 0.8
  }
];

async function runRagDemo() {
  console.log('🚀 RAG Local Demo - Comprehensive Test Suite\n');
  console.log('=' .repeat(80));
  
  let totalTests = 0;
  let passedTests = 0;

  for (const scenario of testScenarios) {
    console.log(`\n📋 Test: ${scenario.name}`);
    console.log(`❓ Question: "${scenario.question}"`);
    console.log('-'.repeat(60));

    try {
      // Test standard RAG
      const startTime = Date.now();
      const response = await ragLocalAnswer(scenario.question, 3);
      const responseTime = Date.now() - startTime;

      console.log(`📄 Answer: ${response.answer}`);
      console.log(`🎯 Confidence: ${response.confidence.toFixed(3)} (required: ${scenario.minConfidence})`);
      console.log(`📚 Sources: ${response.sourceIds.join(', ')}`);
      console.log(`⏱️  Response Time: ${responseTime}ms`);

      // Check if answer contains expected topics
      const answerLower = response.answer.toLowerCase();
      const foundTopics = scenario.expectedTopics.filter(topic => 
        answerLower.includes(topic.toLowerCase())
      );

      console.log(`🔍 Expected Topics: ${scenario.expectedTopics.join(', ')}`);
      console.log(`✅ Found Topics: ${foundTopics.join(', ')}`);

      // Evaluate test success
      const confidencePass = response.confidence >= scenario.minConfidence;
      const topicPass = foundTopics.length >= Math.ceil(scenario.expectedTopics.length * 0.5);
      const sourcesPass = response.sourceIds.length > 0;

      totalTests++;
      if (confidencePass && topicPass && sourcesPass) {
        passedTests++;
        console.log(`✅ TEST PASSED`);
      } else {
        console.log(`❌ TEST FAILED:`);
        if (!confidencePass) console.log(`   - Confidence too low: ${response.confidence} < ${scenario.minConfidence}`);
        if (!topicPass) console.log(`   - Insufficient topic coverage: ${foundTopics.length}/${scenario.expectedTopics.length}`);
        if (!sourcesPass) console.log(`   - No sources found`);
      }

    } catch (error) {
      totalTests++;
      console.log(`💥 Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log('='.repeat(80));
  }

  // Summary
  console.log(`\n📊 Test Summary:`);
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   Passed: ${passedTests}`);
  console.log(`   Failed: ${totalTests - passedTests}`);
  console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  // Streaming demo
  console.log(`\n🌊 Streaming Demo:`);
  console.log('-'.repeat(40));
  const streamQuestion = 'Wie erhalte ich eine Online-Rechnung?';
  console.log(`❓ Question: "${streamQuestion}"`);
  console.log('📝 Streaming Response:\n');

  const streamStart = Date.now();
  let tokenCount = 0;
  let streamedContent = '';
  
  const streamResponse = ragLocalAnswerStream(streamQuestion, undefined, 3);
  
  streamResponse.onToken((chunk) => {
    process.stdout.write(chunk);
    streamedContent += chunk;
    tokenCount++;
  });

  const finalResult = await streamResponse.done();
  const streamTime = Date.now() - streamStart;
  
  console.log('\n\n📊 Stream Metrics:');
  console.log(`   Total Tokens: ${tokenCount}`);
  console.log(`   Stream Time: ${streamTime}ms`);
  console.log(`   Avg per Token: ${(streamTime / tokenCount).toFixed(1)}ms`);
  console.log(`   Confidence: ${finalResult.confidence.toFixed(3)}`);
  console.log(`   Sources: ${finalResult.sourceIds.join(', ')}`);
}

// Performance benchmark
async function benchmarkRag() {
  console.log('\n⚡ Performance Benchmark');
  console.log('-'.repeat(40));

  const benchmarkQuestions = [
    'Internet langsam',
    'Rechnung bezahlen', 
    'Router neustart',
    'Vertrag kündigen',
    'SIM-Karte defekt'
  ];

  const times: number[] = [];

  for (const question of benchmarkQuestions) {
    const start = Date.now();
    await ragLocalAnswer(question, 2);
    const time = Date.now() - start;
    times.push(time);
    console.log(`${question.padEnd(20)}: ${time}ms`);
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  console.log('-'.repeat(40));
  console.log(`Average: ${avgTime.toFixed(1)}ms`);
  console.log(`Min: ${minTime}ms`);
  console.log(`Max: ${maxTime}ms`);
}

async function main() {
  try {
    await runRagDemo();
    await benchmarkRag();
    console.log('\n🎉 Demo completed successfully!');
  } catch (error) {
    console.error('Demo failed:', error);
  }
}

main().catch(console.error);
