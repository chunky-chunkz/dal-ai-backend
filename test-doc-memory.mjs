#!/usr/bin/env node
import fs from 'fs';

const BASE_URL = 'http://localhost:8081';

async function testDocumentWithMemory() {
  console.log('🧪 Testing Document Upload with Memory Extraction...\n');

  try {
    // Read test document
    const content = fs.readFileSync('./test-dzhangr.txt', 'utf-8');
    console.log(`📄 Document content (${content.length} chars):`);
    console.log(content);
    console.log('\n' + '='.repeat(60) + '\n');

    // Upload document with userId
    console.log('📤 Uploading document with userId: test-dzhangr...');
    const uploadResponse = await fetch(`${BASE_URL}/api/documents/upload`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=test-session-123' // Simulate session
      },
      body: JSON.stringify({
        filename: 'test-dzhangr.txt',
        content: content,
        userId: 'test-dzhangr' // Explicitly pass userId
      })
    });

    const result = await uploadResponse.json();
    
    console.log('\n✅ Upload Result:');
    console.log(`   Document ID: ${result.documentId}`);
    console.log(`   Chunks created: ${result.chunksCreated}`);
    console.log(`   Memories extracted: ${result.memoriesExtracted}`);
    console.log(`   Success: ${result.success}`);
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }

    // Check memory store
    console.log('\n📝 Checking memory store...');
    const memoriesData = JSON.parse(fs.readFileSync('./data/memory.json', 'utf-8'));
    const memories = Array.isArray(memoriesData) ? memoriesData : [];
    const userMemories = memories.filter(m => m.userId === 'test-dzhangr');
    
    console.log(`\n💾 Found ${userMemories.length} memories for test-dzhangr:`);
    userMemories.forEach(mem => {
      console.log(`   - ${mem.type}.${mem.key} = ${mem.value} (confidence: ${mem.confidence})`);
    });

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

testDocumentWithMemory();
