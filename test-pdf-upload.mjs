#!/usr/bin/env node
import fs from 'fs';

const BASE_URL = 'http://localhost:8081';

async function testPdfUpload() {
  console.log('📄 Testing PDF Upload...\n');

  try {
    // Create a simple test text
    const testText = `
Dies ist ein Test-Dokument für PDF-Upload.

Kontaktinformationen:
Name: Max Mustermann
Email: max@example.com
Telefon: +49 123 456789

Projektdetails:
Das Projekt wurde am 15. Oktober 2025 gestartet.
Budget: 50.000 Euro
Status: In Bearbeitung

Technische Anforderungen:
- Node.js Backend
- React Frontend
- PDF-Verarbeitung
- Vektordatenbank für Embeddings
`;

    console.log('1️⃣ Testing with plain text (simulating PDF extraction)...');
    console.log('Text length:', testText.length, 'characters');
    
    // Convert to base64 (simulating PDF)
    const base64Content = Buffer.from(testText).toString('base64');
    console.log('Base64 length:', base64Content.length, 'characters\n');

    // Upload as if it were a PDF
    const uploadResponse = await fetch(`${BASE_URL}/api/documents/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'test-dokument.pdf',
        content: base64Content,
        userId: 'test-user-pdf'
      })
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('❌ Upload failed:', errorText);
      return;
    }

    const uploadResult = await uploadResponse.json();
    console.log('✅ Upload successful:', {
      id: uploadResult.documentId,
      name: uploadResult.documentName,
      chunks: uploadResult.chunksCreated,
      memories: uploadResult.memoriesExtracted,
      success: uploadResult.success
    });
    console.log('');

    // List documents to verify
    console.log('2️⃣ Listing documents...');
    const listResponse = await fetch(`${BASE_URL}/api/documents`);
    const listResult = await listResponse.json();
    
    const pdfDocs = listResult.documents.filter(d => d.name.endsWith('.pdf'));
    console.log(`✅ Found ${pdfDocs.length} PDF document(s)`);
    pdfDocs.forEach(doc => {
      console.log(`   - ${doc.name} (${doc.chunkCount} chunks)`);
    });

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testPdfUpload();
