#!/usr/bin/env node

const BASE_URL = 'http://localhost:8081';

async function testRagWithDocuments() {
  console.log('🧪 Testing RAG with Document Integration...\n');

  try {
    // Test question about content in uploaded documents
    const question = "Was ist die Lieblingsfarbe von Roman?";
    
    console.log(`❓ Asking: "${question}"`);
    console.log('⏳ Waiting for answer...\n');
    
    const response = await fetch(`${BASE_URL}/api/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        question,
        useMemory: false // Test without user memory, just document search
      })
    });

    const result = await response.json();
    
    console.log('✅ Response received:');
    console.log(`📝 Answer: ${result.answer}`);
    console.log(`🎯 Confidence: ${result.confidence?.toFixed(3) || 'N/A'}`);
    console.log(`📚 Sources: ${result.sourceIds?.length || 0} documents used`);
    
    if (result.sourceIds && result.sourceIds.length > 0) {
      console.log(`   Source IDs: ${result.sourceIds.slice(0, 3).join(', ')}`);
    }
    
    console.log('');
    
    // Test another question
    const question2 = "Wo arbeitet Maria?";
    console.log(`❓ Asking: "${question2}"`);
    
    const response2 = await fetch(`${BASE_URL}/api/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question2 })
    });

    const result2 = await response2.json();
    console.log(`📝 Answer: ${result2.answer}\n`);
    
    console.log('🎉 RAG + Documents integration test complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testRagWithDocuments();
