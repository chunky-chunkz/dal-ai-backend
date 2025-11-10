/**
 * Document Management Service
 * 
 * Handles document upload, processing, chunking, embedding, and indexing
 */

import fs from 'fs/promises';
import path from 'path';
import { embedTexts } from '../ai/embeddings.js';
import { extractCandidates, type Candidate } from '../memory/extractor.js';
import { upsert } from '../memory/store.js';
import { localLLM } from '../ai/localLLM.js';
import { createRequire } from 'module';

// Lokales require umbenennen, damit es nicht mit dem globalen Namen kollidiert
const moduleRequire = createRequire(import.meta.url);

// Abhängigkeiten mit moduleRequire laden
const pdfParse = (await import('pdf-parse')).default;
const mammoth = (await import('mammoth')).default;
const { PDFExtract } = await import('pdf.js-extract');



// Document storage paths
const DOCS_DIR = path.join(process.cwd(), 'data', 'documents');
const DOCS_INDEX_PATH = path.join(process.cwd(), 'data', 'docs_index.json');

// Document interfaces
export interface DocumentChunk {
  id: string;
  documentId: string;
  documentName: string;
  content: string;
  chunkIndex: number;
  embedding?: number[];
  metadata?: Record<string, any>;
}

export interface DocumentSearchResult {
  id: string;
  documentId: string;
  filename: string;
  text: string;
  chunkIndex: number;
  score: number;
  metadata?: Record<string, any>;
}

export interface DocumentIndex {
  documents: {
    id: string;
    name: string;
    uploadedAt: string;
    uploadedBy?: string;      // Display name for UI
    uploadedByUserId?: string; // Actual userId for authorization
    chunks: DocumentChunk[];
  }[];
}

export interface UploadResult {
  documentId: string;
  documentName: string;
  chunksCreated: number;
  memoriesExtracted: number;
  success: boolean;
  error?: string;
}

/**
 * Initialize document storage
 */
async function ensureDocsDirectory(): Promise<void> {
  try {
    await fs.mkdir(DOCS_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create docs directory:', error);
  }
}

/**
 * Load document index
 */
async function loadDocumentIndex(): Promise<DocumentIndex> {
  try {
    const data = await fs.readFile(DOCS_INDEX_PATH, 'utf-8');
    console.log(`📖 Loading document index: ${data.length} bytes`);
    
    // Check if file is too large or potentially problematic
    if (data.length > 10_000_000) { // 10 MB limit
      console.warn('⚠️  Document index file is very large, may cause issues');
    }
    
    const parsed = JSON.parse(data);
    console.log(`✅ Loaded ${parsed.documents?.length || 0} documents from index`);
    return parsed;
  } catch (error) {
    console.error('❌ Failed to load document index:', error);
    // Return empty index if file doesn't exist or is corrupted
    console.log('   🔄 Returning empty index');
    return { documents: [] };
  }
}

/**
 * Save document index
 */
async function saveDocumentIndex(index: DocumentIndex): Promise<void> {
  try {
    console.log(`📝 saveDocumentIndex: docs=${index.documents.length}`);
    // quick size estimate before stringify
    const approx = index.documents.reduce((sum, d) => sum + d.chunks.length, 0);
    console.log(`   ⏺ chunks total=${approx}`);
    
    // ALWAYS save without embeddings to prevent stack overflow
    // Embeddings are too large and cause JSON.stringify to fail
    console.log('   💾 Saving without embeddings (prevents stack overflow)');
    const indexWithoutEmbeddings: DocumentIndex = {
      documents: index.documents.map(doc => ({
        id: doc.id,
        name: doc.name,
        uploadedAt: doc.uploadedAt,
        uploadedBy: doc.uploadedBy,
        uploadedByUserId: doc.uploadedByUserId,
        chunks: doc.chunks.map(chunk => ({
          id: chunk.id,
          documentId: chunk.documentId,
          documentName: chunk.documentName,
          content: chunk.content,
          chunkIndex: chunk.chunkIndex,
          // Never save embeddings - regenerate when needed
          metadata: chunk.metadata
        }))
      }))
    };
    
    const jsonString = JSON.stringify(indexWithoutEmbeddings);
    console.log(`   📦 json length=${jsonString.length.toLocaleString()} bytes`);
    await fs.writeFile(DOCS_INDEX_PATH, jsonString, 'utf-8');
    console.log('✅ Document index saved');
  } catch (error) {
    console.error('❌ Failed to save document index:', error);
    throw error;
  }
}

/**
 * Extract text from PDF file
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (error) {
    console.error('❌ Error parsing PDF:', error);
    throw new Error('Failed to parse PDF file');
  }
}

/**
 * Extract text from PDF using pdf.js-extract (better for image-based PDFs)
 */
async function extractPdfTextAdvanced(filePath: string): Promise<string> {
  try {
    console.log('🔍 Using advanced PDF extraction (pdf.js-extract)...');
    
    const pdfExtract = new PDFExtract();
    const data = await pdfExtract.extract(filePath, {});
    
    // Extract all text from all pages
    let fullText = '';
    for (const page of data.pages) {
      for (const item of page.content) {
        if (item.str) {
          fullText += item.str + ' ';
        }
      }
      fullText += '\n\n'; // Separate pages
    }
    
    console.log(`✅ Advanced extraction complete: ${fullText.length} chars from ${data.pages.length} pages`);
    return fullText;
    
  } catch (error) {
    console.error('❌ Error during advanced PDF extraction:', error);
    throw new Error('Failed to extract text with pdf.js-extract');
  }
}

/**
 * Extract text from DOCX file
 */
async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (error) {
    console.error('❌ Error parsing DOCX:', error);
    throw new Error('Failed to parse DOCX file');
  }
}

/**
 * Chunk text into smaller pieces (500-1000 characters)
 * Tries to split on paragraph/sentence boundaries
 */
/**
 * Extract facts from document chunks (optimized for documents, not user utterances)
 * Unlike extractCandidates(), this doesn't filter out question-like sentences
 * UPDATED: More aggressive extraction for documents + FALLBACK without LLM
 */
async function extractDocumentFacts(text: string, userId: string): Promise<Candidate[]> {
  try {
  console.log(`🔎 extractDocumentFacts: textLen=${text?.length ?? 0} userId=${userId}`);
    
    // Try LLM extraction first
    try {
      return await extractWithLLM(text, userId);
    } catch (llmError) {
      console.warn('⚠️ LLM extraction failed, using regex fallback:', llmError instanceof Error ? llmError.message : 'Unknown');
      // Fall back to regex-based extraction
      return extractWithRegexPatterns(text);
    }
  } catch (error) {
    console.warn('   ⚠️ Document fact extraction failed:', error instanceof Error ? error.message : 'Unknown');
    if (error instanceof Error && error.stack) {
      console.warn(error.stack);
    }
    return [];
  }
}

/**
 * Extract facts using LLM (primary method)
 */
async function extractWithLLM(text: string, userId: string): Promise<Candidate[]> {
    // For documents, we want to extract factual information
    // Use a specialized prompt for document extraction
    const systemPrompt = `Extrahiere ALLE wichtigen Fakten, Definitionen, technischen Details, Prozesse, Server-Infos, Konfigurationen und Informationen aus diesem Text.
Antworte als JSON-Array von Objekten mit: type, key, value, confidence (0-1).

Types: "fact" (allgemeine Fakten), "preference" (Vorlieben/Einstellungen), "contact" (Kontaktinformationen).

KRITISCH: Extrahiere SEHR VIELE Fakten - jeder technische Detail, jede Server-Info, jede Konfiguration ist wichtig!
- Server-Namen, IP-Adressen, Domains → IMMER extrahieren
- Ports, Protokolle, Services → IMMER extrahieren  
- Pfade, Config-Files, Log-Locations → IMMER extrahieren
- Software-Versionen, Tools, Komponenten → IMMER extrahieren
- Technische Begriffe, Definitionen → IMMER extrahieren

Beispiele:
"Syslog ist ein Protokoll zur Übertragung von Log-Nachrichten über Port 514." ->
[{"type":"fact","key":"syslog_definition","value":"protokoll zur übertragung von log-nachrichten","confidence":0.9},
 {"type":"fact","key":"syslog_port","value":"514","confidence":0.95}]

"Graylog-Server läuft auf 192.168.2.55, Domäne: lab.local" ->
[{"type":"fact","key":"graylog_ip","value":"192.168.2.55","confidence":0.95},
 {"type":"fact","key":"graylog_domain","value":"lab.local","confidence":0.95}]

"Der Standard-Port ist 514 UDP, Config liegt unter /etc/syslog-ng/syslog-ng.conf" ->
[{"type":"fact","key":"standard_port","value":"514 udp","confidence":0.9},
 {"type":"fact","key":"config_path","value":"/etc/syslog-ng/syslog-ng.conf","confidence":0.95}]

"OS: Ubuntu 24.04.1 LTS, SSH: ssh [username@IP-Adresse / syslog.lab.local]" ->
[{"type":"fact","key":"os_version","value":"ubuntu 24.04.1 lts","confidence":0.95},
 {"type":"fact","key":"ssh_host","value":"syslog.lab.local","confidence":0.9}]

Wenn keine relevanten Fakten: []`;

  const promptSlice = text.substring(0, 3000); // ERHÖHT von 2000 auf 3000
  console.log(`   ✉️ prompt slice len=${promptSlice.length}`);
  const userPrompt = `Text: "${promptSlice}"`;
    
  const response = await localLLM.generate({
      model: process.env.LLM_MODEL || 'phi3:mini',
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.05, // GESENKT von 0.1 auf 0.05 für konsistentere Extraktion
      maxTokens: 2000  // ERHÖHT von 1500 auf 2000 für mehr Fakten
    });
  console.log(`   📥 LLM response length=${response?.length ?? 0}`);
    
    if (!response?.trim()) {
      console.log('   ⚠️ LLM returned empty response');
      throw new Error('Empty LLM response');
    }
    
    // Extract JSON from response - safer approach
    // Find first [ and last ] to avoid regex stack overflow
  const firstBracket = response.indexOf('[');
  const lastBracket = response.lastIndexOf(']');
  console.log(`   🔢 brackets first=${firstBracket} last=${lastBracket}`);
    
    if (firstBracket === -1 || lastBracket === -1 || firstBracket >= lastBracket) {
      console.log('   ⚠️ No JSON array found in LLM response');
      throw new Error('No JSON in LLM response');
    }
    
  const jsonStr = response.substring(firstBracket, lastBracket + 1);
  console.log(`   📏 json candidate length=${jsonStr.length}`);
    
    // Limit JSON string length to prevent stack overflow during parsing
    if (jsonStr.length > 50000) {
      console.log('   ⚠️ JSON response too large, truncating...');
      throw new Error('JSON too large');
    }
    
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseError) {
      console.warn('   ⚠️ Failed to parse JSON:', parseError instanceof Error ? parseError.message : 'Unknown');
      console.warn('   🧩 json preview:', jsonStr.slice(0, 200));
      throw parseError;
    }
    
    if (Array.isArray(parsed)) {
      // ERHÖHT von 50 auf 100 facts pro chunk
  const limitedParsed = parsed.slice(0, 100);
  console.log(`   ✅ parsed facts: total=${parsed.length} limited=${limitedParsed.length}`);
      
      return limitedParsed.map(item => ({
        person: item.person || 'system',
        type: item.type || 'fact',
        key: item.key,
        value: item.value,
        confidence: item.confidence || 0.75 // ERHÖHT von 0.7 auf 0.75 als Default
      }));
    }
    
    throw new Error('Parsed result is not an array');
}

/**
 * Extract facts using regex patterns (fallback when LLM fails)
 */
function extractWithRegexPatterns(text: string): Candidate[] {
  console.log('   🔄 Using regex fallback for fact extraction');
  const candidates: Candidate[] = [];
  
  // Technical patterns for server/network info
  const patterns = [
    // IP addresses
    { pattern: /(?:IP|ip|Server|server)[-:\s]+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/gi, type: 'fact', keyPrefix: 'ip', confidence: 0.9 },
    // Domains and hostnames (like idm.lab.local, cert.pem)
    { pattern: /([a-z0-9]+\.(?:lab\.)?local)/gi, type: 'fact', keyPrefix: 'hostname', confidence: 0.85 },
    { pattern: /(?:Domain|domain|Domäne)[-:\s]+([a-z0-9.-]+\.[a-z]{2,})/gi, type: 'fact', keyPrefix: 'domain', confidence: 0.85 },
    // File names (cert.pem, cert.crt, config files)
    { pattern: /([a-z0-9_-]+\.(?:pem|crt|cer|key|p12|pfx|csr))/gi, type: 'fact', keyPrefix: 'certificate_file', confidence: 0.8 },
    // Ports
    { pattern: /(?:Port|port)[-:\s]+(\d{2,5}(?:\s+(?:UDP|TCP|udp|tcp))?)/gi, type: 'fact', keyPrefix: 'port', confidence: 0.9 },
    // Config paths
    { pattern: /(\/[a-z0-9/_.-]+\.(?:conf|config|cfg|ini|json|yaml|yml))/gi, type: 'fact', keyPrefix: 'config_file', confidence: 0.85 },
    // Log paths
    { pattern: /(\/var\/log\/[a-z0-9/_.-]+\.log)/gi, type: 'fact', keyPrefix: 'log_file', confidence: 0.85 },
    // OS versions
    { pattern: /(?:OS|os|Ubuntu|Debian|CentOS|RHEL)[-:\s]+([a-z0-9. ]+(?:LTS)?)/gi, type: 'fact', keyPrefix: 'os', confidence: 0.8 },
    // Services
    { pattern: /(?:Service|service|syslog-ng|graylog|ansible|monitoring)[-:\s]+([a-z0-9._-]+)/gi, type: 'fact', keyPrefix: 'service', confidence: 0.75 },
    // Certificate Authority mentions
    { pattern: /(Certificate Authority|Zertifikat(?:s)?|certificate)/gi, type: 'fact', keyPrefix: 'process', confidence: 0.6 },
  ];
  
  let matchCount = 0;
  for (const { pattern, type, keyPrefix, confidence } of patterns) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      if (match[1] || match[0]) {
        matchCount++;
        candidates.push({
          person: 'system',
          type: type as any,
          key: `${keyPrefix}_${matchCount}`,
          value: (match[1] || match[0]).trim(),
          confidence
        });
      }
    }
  }
  
  console.log(`   ✅ Regex extracted ${candidates.length} facts`);
  return candidates;
}

/**
 * Split text into chunks for processing
 */
function chunkText(text: string, maxChunkSize: number = 1000, minChunkSize: number = 200): string[] {
  const chunks: string[] = [];
  
  // Trim the text
  const trimmedText = text.trim();
  console.log(`✂️ chunkText: inputLen=${text.length} max=${maxChunkSize} min=${minChunkSize}`);
  
  // If text is empty, return empty array
  if (!trimmedText) {
    console.log('   ↩️ empty after trim');
    return [];
  }
  
  // If text is shorter than minChunkSize, return it as a single chunk
  if (trimmedText.length <= maxChunkSize) {
    console.log('   ✅ single chunk');
    return [trimmedText];
  }
  
  // First try to split by paragraphs (double newline)
  const paragraphs = trimmedText.split(/\n\n+/);
  console.log(`   ¶ paragraphs=${paragraphs.length}`);
  
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) continue;
    
    // If adding this paragraph would exceed max size, save current chunk
    if (currentChunk.length + trimmedParagraph.length > maxChunkSize && currentChunk.length >= minChunkSize) {
  chunks.push(currentChunk.trim());
  console.log(`   ➕ push chunk len=${currentChunk.length}`);
      currentChunk = '';
    }
    
    // If paragraph itself is too long, split by sentences
    if (trimmedParagraph.length > maxChunkSize) {
      // Split by sentence boundaries
      const sentences = trimmedParagraph.split(/([.!?]+\s+)/);
      
      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        
        if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length >= minChunkSize) {
          chunks.push(currentChunk.trim());
          console.log(`   ➕ push chunk len=${currentChunk.length}`);
          currentChunk = '';
        }
        
        currentChunk += sentence;
      }
    } else {
      // Add paragraph to current chunk
      if (currentChunk) {
        currentChunk += '\n\n' + trimmedParagraph;
      } else {
        currentChunk = trimmedParagraph;
      }
    }
  }
  
  // Add remaining chunk (even if smaller than minChunkSize)
  if (currentChunk.trim()) {
  chunks.push(currentChunk.trim());
  console.log(`   ➕ push final chunk len=${currentChunk.length}`);
  }
  
  // If no chunks were created, return the whole text as one chunk
  if (chunks.length === 0 && trimmedText) {
    chunks.push(trimmedText);
  }
  
  console.log(`   ✅ chunks total=${chunks.length}`);
  return chunks;
}

/**
 * Process and index a text document
 * 
 * @param content - The text content to process
 * @param filename - The filename of the document
 * @param userId - Optional user ID for memory extraction
 * @param uploadedBy - Optional readable username for display
 * @returns Upload result with statistics
 */
export async function processDocument(
  content: string,
  filename: string,
  userId?: string,
  uploadedBy?: string
): Promise<UploadResult> {
  try {
    await ensureDocsDirectory();
    
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`📄 Processing document: ${filename}`);
    console.log(`   Document ID: ${documentId}`);
    console.log(`   Uploaded by: ${uploadedBy || userId || 'unknown'}`);
  console.log(`   Content length (raw): ${content.length}`);
    
    // Save file to disk first (needed for OCR)
    const fileExt = path.extname(filename).toLowerCase() || '.pdf';
    const filePath = path.join(DOCS_DIR, `${documentId}${fileExt}`);
    await fs.writeFile(filePath, Buffer.from(content, 'base64'));
    console.log(`   💾 Saved to: ${filePath}`);
    
    // Extract text based on file type
    let textContent: string;
    if (filename.toLowerCase().endsWith('.pdf')) {
      console.log(`   📑 Extracting PDF text...`);
      const buffer = Buffer.from(content, 'base64');
      textContent = await extractPdfText(buffer);
      console.log(`   ✅ Extracted ${textContent.length} characters from PDF`);
      
      // If text is too short (< 100 chars), try advanced extraction as fallback
      if (textContent.trim().length < 100) {
        console.log(`   ⚠️ PDF text too short (${textContent.trim().length} chars) - trying advanced extraction...`);
        try {
          const advancedText = await extractPdfTextAdvanced(filePath);
          if (advancedText.length > textContent.length) {
            console.log(`   ✅ Advanced extraction found more text: ${advancedText.length} chars (vs ${textContent.length})`);
            textContent = advancedText;
          }
        } catch (advError) {
          console.warn('   ⚠️ Advanced extraction failed:', advError instanceof Error ? advError.message : 'Unknown');
        }
      }
    } else if (filename.toLowerCase().endsWith('.docx')) {
      console.log(`   📝 Extracting DOCX text...`);
      const buffer = Buffer.from(content, 'base64');
      textContent = await extractDocxText(buffer);
      console.log(`   ✅ Extracted ${textContent.length} characters from DOCX`);
    } else {
  textContent = content;
      console.log(`   Content length: ${textContent.length} characters`);
    }
    
      // Special handling: still no text after OCR attempt
      const isBinaryDoc = filename.toLowerCase().endsWith('.pdf') || filename.toLowerCase().endsWith('.docx');
      const hasNoText = !textContent || textContent.trim().length < 20;
      if (isBinaryDoc && hasNoText) {
        console.log('   🖼️ No text extractable even with OCR – registering document without content');
      
        // Create minimal index entry with zero chunks
        const index = await loadDocumentIndex();
        index.documents.push({
          id: documentId,
          name: filename,
          uploadedAt: new Date().toISOString(),
          uploadedBy: uploadedBy || userId,
          uploadedByUserId: userId,
          chunks: []
        });
        await saveDocumentIndex(index);
      
        console.log('✅ Document registered without text content');
        return {
          documentId,
          documentName: filename,
          chunksCreated: 0,
          memoriesExtracted: 0,
          success: true
        };
      }
    
    // Step 1: Chunk the text
    const textChunks = chunkText(textContent);
    console.log(`   ✂️ Created ${textChunks.length} chunks`);
    
    // Step 2: Create embeddings for all chunks
    console.log(`   🧮 Generating embeddings...`);
  console.log(`   🧮 Embedding ${textChunks.length} chunks...`);
  const embeddings = await embedTexts(textChunks);
    console.log(`   ✅ Generated ${embeddings.length} embeddings`);
    
    // Step 3: Create document chunks with embeddings
    const chunks: DocumentChunk[] = textChunks.map((chunk, index) => ({
      id: `${documentId}_chunk_${index}`,
      documentId,
      documentName: filename,
      content: chunk,
      chunkIndex: index,
      embedding: embeddings[index],
      metadata: {
        length: chunk.length,
        createdAt: new Date().toISOString()
      }
    }));
    
    // Step 4: Add to document index
    const index = await loadDocumentIndex();
    index.documents.push({
      id: documentId,
      name: filename,
      uploadedAt: new Date().toISOString(),
      uploadedBy: uploadedBy || userId,  // Use readable name if provided, fallback to userId (for display)
      uploadedByUserId: userId,           // Store actual userId for authorization
      chunks
    });
    await saveDocumentIndex(index);
    
    // Step 5: Extract memories from document 
    // For documents, we extract as global-knowledge (userId = 'global-knowledge')
    // unless a specific userId is provided (then it's user-specific knowledge)
    let memoriesExtracted = 0;
    const targetUserId = userId || 'global-knowledge';
    console.log(`   🧠 Extracting memories as ${targetUserId === 'global-knowledge' ? 'global knowledge' : 'user-specific knowledge'}...`);
    
    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i];
      try {
        console.log(`   📝 Processing chunk ${i + 1}/${textChunks.length} (${chunk.length} chars)`);
        
        // For documents, we use a simplified extraction that doesn't filter questions
        // Documents contain factual information, not conversational questions
        const candidates = await extractDocumentFacts(chunk, targetUserId);
        console.log(`   🔍 Found ${candidates.length} candidate memories`);
        
        for (const candidate of candidates) {
          console.log(`      - ${candidate.type}.${candidate.key} = ${candidate.value} (confidence: ${candidate.confidence})`);
          
          // GESENKT: Threshold für Dokumente von 0.3 auf 0.25 für NOCH mehr Fakten
          if (candidate.confidence >= 0.25) {
            await upsert(targetUserId, {
              userId: targetUserId,
              type: candidate.type,
              key: candidate.key,
              value: candidate.value,
              confidence: candidate.confidence,
              person: candidate.person || 'system'
            });
            memoriesExtracted++;
            console.log(`      ✅ Saved memory: ${candidate.key}`);
          } else {
            console.log(`      ⚠️  Confidence too low (${candidate.confidence} < 0.25)`);
          }
        }
      } catch (error) {
        console.warn(`   ❌ Failed to extract memories from chunk ${i + 1}:`, error);
      }
    }
    
    console.log(`   ✅ Extracted ${memoriesExtracted} memories total`);
    
    // Step 6: Save the original document with correct extension
    const ext = path.extname(filename).toLowerCase() || '.txt';
    const docPath = path.join(DOCS_DIR, `${documentId}${ext}`);
    try {
      if (ext === '.pdf' || ext === '.docx') {
        await fs.writeFile(docPath, Buffer.from(content, 'base64'));
        console.log(`   💾 Stored original file (binary): ${docPath}`);
      } else {
        await fs.writeFile(docPath, content, 'utf-8');
        console.log(`   💾 Stored original file (text): ${docPath}`);
      }
    } catch (storeErr) {
      console.warn('   ⚠️ Failed to store original file:', storeErr);
    }
    
    console.log(`✅ Document processed successfully: ${filename}`);
    
    return {
      documentId,
      documentName: filename,
      chunksCreated: chunks.length,
      memoriesExtracted,
      success: true
    };
    
  } catch (error) {
    console.error('❌ Error processing document:', error);
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown',
      stack: error instanceof Error ? error.stack : 'No stack',
      filename
    });
    return {
      documentId: '',
      documentName: filename,
      chunksCreated: 0,
      memoriesExtracted: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Search documents using semantic similarity
 * 
 * @param query - The search query
 * @param topK - Number of top results to return
 * @returns Most relevant document chunks with scores
 */
export async function searchDocuments(query: string, topK: number = 5): Promise<DocumentSearchResult[]> {
  try {
    // Generate embedding for the query 
    const [queryEmbedding] = await embedTexts([query]);
    
    // Load document index
    const index = await loadDocumentIndex();
    
    // Calculate similarity for all chunks
    const scoredChunks: Array<{ chunk: DocumentChunk; score: number }> = [];
    
    // Collect chunks that need embeddings
    const chunksNeedingEmbeddings: { doc: any; chunk: DocumentChunk; index: number }[] = [];
    
    for (const doc of index.documents) {
      for (let i = 0; i < doc.chunks.length; i++) {
        const chunk = doc.chunks[i];
        
        if (!chunk.embedding && chunk.content) {
          // Mark chunk for embedding generation
          chunksNeedingEmbeddings.push({ doc, chunk, index: i });
        } else if (chunk.embedding) {
          const score = cosineSimilarity(queryEmbedding, chunk.embedding);
          scoredChunks.push({ chunk, score });
        }
      }
    }
    
    // Generate missing embeddings if needed
    if (chunksNeedingEmbeddings.length > 0) {
      console.log(`🔧 Generating ${chunksNeedingEmbeddings.length} missing embeddings...`);
      const texts = chunksNeedingEmbeddings.map(item => item.chunk.content);
      const newEmbeddings = await embedTexts(texts);
      
      // Add embeddings back to chunks and calculate scores
      for (let i = 0; i < chunksNeedingEmbeddings.length; i++) {
        const { chunk } = chunksNeedingEmbeddings[i];
        const embedding = newEmbeddings[i];
        chunk.embedding = embedding; // Store in memory only
        
        const score = cosineSimilarity(queryEmbedding, embedding);
        scoredChunks.push({ chunk, score });
      }
      
      console.log(`✅ Generated ${newEmbeddings.length} embeddings on-the-fly`);
    }
    
    // Sort by score and return top K
    scoredChunks.sort((a, b) => b.score - a.score);
    
    // Convert to search result format
    return scoredChunks.slice(0, topK).map(item => ({
      id: item.chunk.id,
      documentId: item.chunk.documentId,
      filename: item.chunk.documentName,
      text: item.chunk.content,
      chunkIndex: item.chunk.chunkIndex,
      score: item.score,
      metadata: item.chunk.metadata
    }));
    
  } catch (error) {
    console.error('Error searching documents:', error);
    return [];
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (normA * normB);
}

/**
 * List all indexed documents
 */
export async function listDocuments(): Promise<Array<{
  id: string;
  name: string;
  uploadedAt: string;
  uploadedBy?: string;
  chunkCount: number;
}>> {
  const index = await loadDocumentIndex();
  
  return index.documents.map(doc => ({
    id: doc.id,
    name: doc.name,
    uploadedAt: doc.uploadedAt,
    uploadedBy: doc.uploadedBy,
    chunkCount: doc.chunks.length
  }));
}

/**
 * Delete a document and its chunks
 * 
 * @param documentId - The ID of the document to delete
 * @param requestingUserId - The ID of the user requesting deletion (optional for backward compatibility)
 * @param isAdmin - Whether the requesting user is an admin (optional)
 * @returns Object with success status and optional error message
 */
export async function deleteDocument(
  documentId: string, 
  requestingUserId?: string,
  isAdmin: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const index = await loadDocumentIndex();
    const docIndex = index.documents.findIndex(doc => doc.id === documentId);
    
    if (docIndex === -1) {
      return { success: false, error: 'Document not found' };
    }
    
    const document = index.documents[docIndex];
    
    // Authorization check: Only the uploader or an admin can delete
    if (requestingUserId && !isAdmin) {
      // Check if the requesting user is the owner
      // Use uploadedByUserId if available, fallback to uploadedBy for backward compatibility
      const documentOwnerId = document.uploadedByUserId || document.uploadedBy;
      if (documentOwnerId !== requestingUserId) {
        console.log(`🚫 Delete denied: User ${requestingUserId} is not the owner of document ${documentId} (owner: ${documentOwnerId})`);
        return { 
          success: false, 
          error: 'Unauthorized: Only the document owner or an admin can delete this document' 
        };
      }
    }
    
    // Remove from index
    index.documents.splice(docIndex, 1);
    await saveDocumentIndex(index);
    
    // Delete file
    const docPath = path.join(DOCS_DIR, `${documentId}.txt`);
    try {
      await fs.unlink(docPath);
    } catch (error) {
      console.warn('Failed to delete document file:', error);
    }
    
    console.log(`🗑️ Document deleted: ${documentId} by user ${requestingUserId || 'system'}`);
    return { success: true };
    
  } catch (error) {
    console.error('Error deleting document:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
