#!/usr/bin/env node
import fs from 'fs';

const BASE_URL = 'http://localhost:8081';

async function testDocumentPipeline() {
  console.log('📄 Testing Document Pipeline...\n');

  try {
    // 1. Upload document
    console.log('1️⃣ Uploading test document...');
    const content = fs.readFileSync('./test-document.txt', 'utf-8');
    
    const uploadResponse = await fetch(`${BASE_URL}/api/documents/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'test-document.txt',
        content: content,
        userId: 'test-user-123'
      })
    });

    const uploadResult = await uploadResponse.json();
    console.log('✅ Upload successful:', {
      id: uploadResult.documentId,
      chunks: uploadResult.chunksCreated,
      memories: uploadResult.memoriesExtracted
    });
    console.log('');

    // 2. List documents
    console.log('2️⃣ Listing all documents...');
    const listResponse = await fetch(`${BASE_URL}/api/documents`);
    const listData = await listResponse.json();
    const documents = listData.documents || [];
    console.log(`✅ Found ${documents.length} document(s)`);
    documents.forEach(doc => {
      console.log(`   - ${doc.name} (${doc.chunkCount} chunks)`);
    });
    console.log('');

    // 3. Search documents
    console.log('3️⃣ Searching for "Lieblingsfarbe"...');
    const searchResponse = await fetch(
      `${BASE_URL}/api/documents/search?query=Lieblingsfarbe&topK=3`
    );
    const searchData = await searchResponse.json();
    const searchResults = searchData.results || [];
    console.log(`✅ Found ${searchResults.length} results:`);
    searchResults.forEach((result, idx) => {
      console.log(`   ${idx + 1}. Score: ${result.score.toFixed(3)} - ${result.text.substring(0, 80)}...`);
    });
    console.log('');

    // 4. Check if memories were extracted
    console.log('4️⃣ Checking extracted memories...');
    try {
      const memoriesData = JSON.parse(fs.readFileSync('./data/memory.json', 'utf-8'));
      const memories = Array.isArray(memoriesData) ? memoriesData : [];
      const userMemories = memories.filter(m => m.userId === 'test-user-123');
      console.log(`✅ Found ${userMemories.length} memory items for test-user-123:`);
      userMemories.forEach(mem => {
        console.log(`   - ${mem.type}.${mem.key} = ${mem.value} (confidence: ${mem.metadata?.confidence || 'N/A'})`);
      });
    } catch (err) {
      console.log('⚠️  No memories file yet or empty');
    }
    console.log('');

    console.log('🎉 Document pipeline test complete!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.cause) {
      console.error('   Cause:', error.cause);
    }
  }
}

testDocumentPipeline();
