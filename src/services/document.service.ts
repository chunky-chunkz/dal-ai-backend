/**
 * Document Management Service
 * 
 * Handles document upload, processing, chunking, embedding, and indexing
 */

import fs from 'fs/promises';
import path from 'path';
import { embedTexts } from '../ai/embeddings.js';
import { extractCandidates } from '../memory/extractor.js';
import { upsert } from '../memory/store.js';

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
    uploadedBy?: string;
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
    return JSON.parse(data);
  } catch (error) {
    // Return empty index if file doesn't exist
    return { documents: [] };
  }
}

/**
 * Save document index
 */
async function saveDocumentIndex(index: DocumentIndex): Promise<void> {
  await fs.writeFile(DOCS_INDEX_PATH, JSON.stringify(index, null, 2), 'utf-8');
  console.log('📄 Document index saved');
}

/**
 * Chunk text into smaller pieces (500-1000 characters)
 * Tries to split on paragraph/sentence boundaries
 */
export function chunkText(text: string, maxChunkSize: number = 1000, minChunkSize: number = 500): string[] {
  const chunks: string[] = [];
  
  // Trim the text
  const trimmedText = text.trim();
  
  // If text is empty, return empty array
  if (!trimmedText) {
    return [];
  }
  
  // If text is shorter than minChunkSize, return it as a single chunk
  if (trimmedText.length <= maxChunkSize) {
    return [trimmedText];
  }
  
  // First try to split by paragraphs (double newline)
  const paragraphs = trimmedText.split(/\n\n+/);
  
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) continue;
    
    // If adding this paragraph would exceed max size, save current chunk
    if (currentChunk.length + trimmedParagraph.length > maxChunkSize && currentChunk.length >= minChunkSize) {
      chunks.push(currentChunk.trim());
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
  }
  
  // If no chunks were created, return the whole text as one chunk
  if (chunks.length === 0 && trimmedText) {
    chunks.push(trimmedText);
  }
  
  return chunks;
}

/**
 * Process and index a text document
 * 
 * @param content - The text content to process
 * @param filename - The filename of the document
 * @param userId - Optional user ID for memory extraction
 * @returns Upload result with statistics
 */
export async function processDocument(
  content: string,
  filename: string,
  userId?: string
): Promise<UploadResult> {
  try {
    await ensureDocsDirectory();
    
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`📄 Processing document: ${filename}`);
    console.log(`   Document ID: ${documentId}`);
    console.log(`   Content length: ${content.length} characters`);
    
    // Step 1: Chunk the text
    const textChunks = chunkText(content);
    console.log(`   ✂️ Created ${textChunks.length} chunks`);
    
    // Step 2: Create embeddings for all chunks
    console.log(`   🧮 Generating embeddings...`);
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
      uploadedBy: userId,
      chunks
    });
    await saveDocumentIndex(index);
    
    // Step 5: Extract memories from document (optional)
    let memoriesExtracted = 0;
    if (userId) {
      console.log(`   🧠 Extracting memories for user ${userId}...`);
      
      for (let i = 0; i < textChunks.length; i++) {
        const chunk = textChunks[i];
        try {
          console.log(`   📝 Processing chunk ${i + 1}/${textChunks.length} (${chunk.length} chars)`);
          const candidates = await extractCandidates(chunk, userId);
          console.log(`   🔍 Found ${candidates.length} candidate memories`);
          
          for (const candidate of candidates) {
            console.log(`      - ${candidate.type}.${candidate.key} = ${candidate.value} (confidence: ${candidate.confidence})`);
            
            // Lower threshold for document extraction (0.5 for better capture)
            if (candidate.confidence >= 0.5) {
              await upsert(userId, {
                userId,
                type: candidate.type,
                key: candidate.key,
                value: candidate.value,
                confidence: candidate.confidence,
                person: candidate.person
              });
              memoriesExtracted++;
              console.log(`      ✅ Saved memory: ${candidate.key}`);
            } else {
              console.log(`      ⚠️  Confidence too low (${candidate.confidence} < 0.5)`);
            }
          }
        } catch (error) {
          console.warn(`   ❌ Failed to extract memories from chunk ${i + 1}:`, error);
        }
      }
      
      console.log(`   ✅ Extracted ${memoriesExtracted} memories total`);
    } else {
      console.log(`   ⚠️  No userId provided - skipping memory extraction`);
    }
    
    // Step 6: Save the original document
    const docPath = path.join(DOCS_DIR, `${documentId}.txt`);
    await fs.writeFile(docPath, content, 'utf-8');
    
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
    
    for (const doc of index.documents) {
      for (const chunk of doc.chunks) {
        if (chunk.embedding) {
          const score = cosineSimilarity(queryEmbedding, chunk.embedding);
          scoredChunks.push({ chunk, score });
        }
      }
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
 */
export async function deleteDocument(documentId: string): Promise<boolean> {
  try {
    const index = await loadDocumentIndex();
    const docIndex = index.documents.findIndex(doc => doc.id === documentId);
    
    if (docIndex === -1) {
      return false;
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
    
    console.log(`🗑️ Document deleted: ${documentId}`);
    return true;
    
  } catch (error) {
    console.error('Error deleting document:', error);
    return false;
  }
}
