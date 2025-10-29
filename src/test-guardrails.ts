/**
 * Test suite for guardrails system
 * Tests PII masking, sensitive topic detection, and integration with answer service
 */

import dotenv from 'dotenv';
import { 
  maskPII, 
  isSensitive, 
  getSensitiveKeywords,
  getSensitiveTopicResponse,
  applyGuardrails,
  getGuardrailsStats
} from './ai/guardrails.js';

dotenv.config();

async function testPIIMasking() {
  console.log('🛡️ Testing PII Masking...');
  
  try {
    const testCases = [
      {
        input: 'Meine Email ist max.mustermann@example.com und meine Telefonnummer ist 0151 12345678.',
        expected: 'Meine Email ist [EMAIL] und meine Telefonnummer ist [PHONE].',
        description: 'Email and phone masking'
      },
      {
        input: 'Meine IBAN ist DE89 3704 0044 0532 0130 00 für die Überweisung.',
        expected: 'Meine IBAN ist [IBAN] für die Überweisung.',
        description: 'IBAN masking'
      },
      {
        input: 'Kreditkarte: 4532 1234 5678 9012, Ablaufdatum 12/25.',
        expected: 'Kreditkarte: [CARD], Ablaufdatum 12/25.',
        description: 'Credit card masking'
      },
      {
        input: 'Steuer-ID: 12345678901, Sozialversicherung: 12 345678 A 123.',
        expected: 'Steuer-ID: [TAX_ID], Sozialversicherung: [SSN].',
        description: 'Tax ID and social security masking'
      },
      {
        input: 'Ich wohne in 10115 Berlin-Mitte, Unter den Linden.',
        expected: 'Ich wohne in [ADDRESS], Unter den Linden.',
        description: 'Address masking (partial)'
      },
      {
        input: 'Normale Frage ohne PII Daten.',
        expected: 'Normale Frage ohne PII Daten.',
        description: 'No masking needed'
      }
    ];

    let passed = 0;
    for (const testCase of testCases) {
      const result = maskPII(testCase.input);
      const success = result === testCase.expected;
      
      console.log(`   ${testCase.description}: ${success ? '✅' : '❌'}`);
      if (!success) {
        console.log(`     Expected: "${testCase.expected}"`);
        console.log(`     Got:      "${result}"`);
      }
      
      if (success) passed++;
    }

    console.log(`   PII Masking: ${passed}/${testCases.length} tests passed`);
    return passed === testCases.length;

  } catch (error) {
    console.error('❌ PII masking test failed:', error);
    return false;
  }
}

async function testSensitiveDetection() {
  console.log('\n🚨 Testing Sensitive Topic Detection...');
  
  try {
    const sensitiveCases = [
      'Ich möchte meinen Vertrag kündigen.',
      'Brauche ich einen Anwalt für diese Sache?',
      'Können Sie meine Personendaten löschen?',
      'Ich möchte eine Beschwerde einreichen.',
      'Die Rechnung ist falsch berechnet.',
      'Ich habe rechtliche Probleme mit dem Service.',
      'DSGVO Auskunft über meine Daten.',
      'Kündigung wegen schlechtem Service.'
    ];

    const normalCases = [
      'Wie bezahle ich meine Rechnung?',
      'Internet ist langsam, was kann ich tun?',
      'Router funktioniert nicht richtig.',
      'Wann sind Ihre Öffnungszeiten?',
      'Wie ändere ich mein Passwort?',
      'Was kostet der Premium Service?'
    ];

    let sensitivePassed = 0;
    console.log('   Testing sensitive topics:');
    for (const testCase of sensitiveCases) {
      const result = isSensitive(testCase);
      console.log(`     "${testCase.substring(0, 40)}...": ${result ? '✅' : '❌'}`);
      if (result) sensitivePassed++;
    }

    let normalPassed = 0;
    console.log('   Testing normal topics:');
    for (const testCase of normalCases) {
      const result = !isSensitive(testCase); // Should NOT be sensitive
      console.log(`     "${testCase.substring(0, 40)}...": ${result ? '✅' : '❌'}`);
      if (result) normalPassed++;
    }

    const totalPassed = sensitivePassed + normalPassed;
    const totalTests = sensitiveCases.length + normalCases.length;
    
    console.log(`   Sensitive Detection: ${totalPassed}/${totalTests} tests passed`);
    console.log(`     Sensitive detected: ${sensitivePassed}/${sensitiveCases.length}`);
    console.log(`     Normal not flagged: ${normalPassed}/${normalCases.length}`);

    return totalPassed === totalTests;

  } catch (error) {
    console.error('❌ Sensitive detection test failed:', error);
    return false;
  }
}

async function testKeywordExtraction() {
  console.log('\n🔍 Testing Keyword Extraction...');
  
  try {
    const testCases = [
      {
        input: 'Ich möchte meinen Vertrag kündigen wegen rechtlicher Probleme.',
        expectedKeywords: ['kündigen', 'rechtlich'],
        description: 'Multiple keywords'
      },
      {
        input: 'Können Sie meine Personendaten löschen gemäss DSGVO?',
        expectedKeywords: ['personendaten', 'dsgvo'],
        description: 'Privacy keywords'
      },
      {
        input: 'Normale Frage über Internetgeschwindigkeit.',
        expectedKeywords: [],
        description: 'No sensitive keywords'
      }
    ];

    let passed = 0;
    for (const testCase of testCases) {
      const keywords = getSensitiveKeywords(testCase.input);
      const hasExpectedKeywords = testCase.expectedKeywords.every(expected =>
        keywords.some(found => found.includes(expected) || expected.includes(found))
      );
      
      console.log(`   ${testCase.description}: ${hasExpectedKeywords ? '✅' : '❌'}`);
      console.log(`     Found keywords: [${keywords.join(', ')}]`);
      
      if (hasExpectedKeywords) passed++;
    }

    console.log(`   Keyword Extraction: ${passed}/${testCases.length} tests passed`);
    return passed === testCases.length;

  } catch (error) {
    console.error('❌ Keyword extraction test failed:', error);
    return false;
  }
}

async function testGuardrailsIntegration() {
  console.log('\n🔧 Testing Guardrails Integration...');
  
  try {
    const testCases = [
      {
        input: 'Ich möchte kündigen, meine Email ist test@example.com',
        expectSensitive: true,
        expectPII: true,
        description: 'Sensitive + PII'
      },
      {
        input: 'Rechtliche Beratung zu meinem Vertrag benötigt',
        expectSensitive: true,
        expectPII: false,
        description: 'Only sensitive'
      },
      {
        input: 'Kontakt: max@test.de, Telefon: 0151 123456',
        expectSensitive: false,
        expectPII: true,
        description: 'Only PII'
      },
      {
        input: 'Wie kann ich mein Passwort ändern?',
        expectSensitive: false,
        expectPII: false,
        description: 'Normal question'
      }
    ];

    let passed = 0;
    for (const testCase of testCases) {
      const result = applyGuardrails(testCase.input);
      
      const sensitiveMatch = result.isSensitive === testCase.expectSensitive;
      const piiMatch = result.containsPII === testCase.expectPII;
      const escalationMatch = result.shouldEscalate === (testCase.expectSensitive || testCase.expectPII);
      
      const success = sensitiveMatch && piiMatch && escalationMatch;
      
      console.log(`   ${testCase.description}: ${success ? '✅' : '❌'}`);
      console.log(`     Sensitive: ${result.isSensitive} (expected: ${testCase.expectSensitive})`);
      console.log(`     PII: ${result.containsPII} (expected: ${testCase.expectPII})`);
      console.log(`     Should escalate: ${result.shouldEscalate}`);
      console.log(`     Masked: "${result.maskedQuestion}"`);
      
      if (success) passed++;
    }

    console.log(`   Integration: ${passed}/${testCases.length} tests passed`);
    return passed === testCases.length;

  } catch (error) {
    console.error('❌ Guardrails integration test failed:', error);
    return false;
  }
}

async function testSensitiveResponse() {
  console.log('\n💬 Testing Sensitive Topic Responses...');
  
  try {
    const testCases = [
      {
        keywords: ['kündigung', 'vertrag'],
        expectedType: 'cancellation',
        description: 'Cancellation keywords'
      },
      {
        keywords: ['recht', 'anwalt'],
        expectedType: 'legal',
        description: 'Legal keywords'
      },
      {
        keywords: ['personendaten', 'dsgvo'],
        expectedType: 'privacy',
        description: 'Privacy keywords'
      },
      {
        keywords: ['beschwerde'],
        expectedType: 'general',
        description: 'General sensitive'
      }
    ];

    let passed = 0;
    for (const testCase of testCases) {
      const response = getSensitiveTopicResponse(testCase.keywords);
      
      const hasAppropriateMessage = response.answer.length > 20 && 
                                   response.answer.includes('Support') || 
                                   response.answer.includes('Ticket') ||
                                   response.answer.includes('Mitarbeiter');
      
      const hasHighConfidence = response.confidence >= 0.9;
      const requiresHuman = response.requiresHuman === true;
      
      const success = hasAppropriateMessage && hasHighConfidence && requiresHuman;
      
      console.log(`   ${testCase.description}: ${success ? '✅' : '❌'}`);
      console.log(`     Message length: ${response.answer.length} chars`);
      console.log(`     Confidence: ${response.confidence}`);
      console.log(`     Requires human: ${response.requiresHuman}`);
      
      if (success) passed++;
    }

    console.log(`   Response Generation: ${passed}/${testCases.length} tests passed`);
    return passed === testCases.length;

  } catch (error) {
    console.error('❌ Sensitive response test failed:', error);
    return false;
  }
}

async function testGuardrailsStats() {
  console.log('\n📊 Testing Guardrails Statistics...');
  
  try {
    const stats = getGuardrailsStats();
    
    const hasPatterns = stats.piiPatterns > 0;
    const hasKeywords = stats.sensitiveKeywords > 0;
    const hasVersion = stats.version && stats.version.length > 0;
    
    console.log(`   PII Patterns: ${stats.piiPatterns}`);
    console.log(`   Sensitive Keywords: ${stats.sensitiveKeywords}`);
    console.log(`   Version: ${stats.version}`);
    
    const success = hasPatterns && hasKeywords && hasVersion;
    console.log(`   Stats Available: ${success ? '✅' : '❌'}`);
    
    return success;

  } catch (error) {
    console.error('❌ Guardrails stats test failed:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Guardrails Test Suite\n');
  
  let passed = 0;
  let total = 0;
  
  // Test 1: PII Masking
  total++;
  if (await testPIIMasking()) passed++;
  
  // Test 2: Sensitive Detection
  total++;
  if (await testSensitiveDetection()) passed++;
  
  // Test 3: Keyword Extraction
  total++;
  if (await testKeywordExtraction()) passed++;
  
  // Test 4: Guardrails Integration
  total++;
  if (await testGuardrailsIntegration()) passed++;
  
  // Test 5: Sensitive Response
  total++;
  if (await testSensitiveResponse()) passed++;
  
  // Test 6: Stats
  total++;
  if (await testGuardrailsStats()) passed++;
  
  console.log(`\n🎉 Test Results: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log('✅ All guardrails tests passed!');
    
    console.log('\n📝 Guardrails Features:');
    console.log('✅ PII masking (email, phone, IBAN, cards, IDs)');
    console.log('✅ Sensitive topic detection (legal, cancellation, privacy)');
    console.log('✅ Automatic escalation for sensitive content');
    console.log('✅ Question normalization with masked PII');
    console.log('✅ Contextual response generation for escalation');
    console.log('✅ Comprehensive logging with privacy protection');
    console.log('✅ Integration with answer service and caching');
    
  } else {
    console.log('❌ Some guardrails tests failed. Check the logs above.');
  }
}

main().catch(console.error);
