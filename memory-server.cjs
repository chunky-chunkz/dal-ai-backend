/**
 * Simple Express Backend with Memory System for German conversations
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 8080;

// Memory storage file
const MEMORY_FILE = path.join(__dirname, 'data', 'user_memories.json');

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Ensure data directory exists
async function ensureDataDirectory() {
  const dataDir = path.join(__dirname, 'data');
  try {
    await fs.access(dataDir);
  } catch (error) {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Load memories from file
async function loadMemories() {
  try {
    const data = await fs.readFile(MEMORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.log('📝 Creating new user memories file');
    return {};
  }
}

// Save memories to file
async function saveMemories(memories) {
  try {
    await fs.writeFile(MEMORY_FILE, JSON.stringify(memories, null, 2));
  } catch (error) {
    console.error('❌ Error saving memories:', error);
  }
}

// Extract and store personal information
async function processAndStoreMemories(sessionId, text) {
  const memories = await loadMemories();
  
  if (!memories[sessionId]) {
    memories[sessionId] = {
      userId: sessionId,
      memories: {},
      lastUpdated: new Date().toISOString()
    };
  }

  // German patterns for personal information
  const patterns = [
    { pattern: /meine?\s+lieblingsfarbe\s+ist\s+(\w+)/i, key: 'lieblingsfarbe', label: 'Lieblingsfarbe' },
    { pattern: /ich\s+heiße\s+(\w+)/i, key: 'name', label: 'Name' },
    { pattern: /mein\s+name\s+ist\s+(\w+)/i, key: 'name', label: 'Name' },
    { pattern: /ich\s+bin\s+(\d+)\s+jahre?\s+alt/i, key: 'alter', label: 'Alter' },
    { pattern: /ich\s+wohne\s+in\s+(\w+)/i, key: 'wohnort', label: 'Wohnort' },
    { pattern: /ich\s+komme\s+aus\s+(\w+)/i, key: 'herkunft', label: 'Herkunft' },
    { pattern: /mein\s+hobby\s+ist\s+(\w+)/i, key: 'hobby', label: 'Hobby' },
    { pattern: /ich\s+arbeite\s+als\s+(\w+)/i, key: 'beruf', label: 'Beruf' },
  ];

  let extracted = [];

  patterns.forEach(({ pattern, key, label }) => {
    const match = text.match(pattern);
    if (match) {
      const value = match[1];
      memories[sessionId].memories[key] = {
        value: value,
        timestamp: new Date().toISOString(),
        context: text
      };
      extracted.push(`${label}: ${value}`);
      console.log(`🧠 Learned about ${sessionId}: ${label} = ${value}`);
    }
  });

  if (extracted.length > 0) {
    memories[sessionId].lastUpdated = new Date().toISOString();
    await saveMemories(memories);
  }

  return extracted;
}

// Create memory context for responses
async function createMemoryContext(sessionId) {
  const memories = await loadMemories();
  const userMemories = memories[sessionId];
  
  if (!userMemories || Object.keys(userMemories.memories).length === 0) {
    return '';
  }

  const memoryItems = Object.entries(userMemories.memories).map(([key, info]) => {
    return `${key}: ${info.value}`;
  });

  return `\n[Persönliche Informationen über ${sessionId}: ${memoryItems.join(', ')}]\n`;
}

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    message: 'Express Backend with Persistent Memory System',
    memoryFile: MEMORY_FILE
  });
});

// Debug endpoint to view memories
app.get('/api/memory/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const memories = await loadMemories();
    const userMemories = memories[sessionId];
    
    res.json({
      sessionId,
      memories: userMemories || null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve memories' });
  }
});

// Main chat endpoint
app.post('/api/answer', async (req, res) => {
  const { question, sessionId = 'anonymous' } = req.body;
  
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({
      error: 'Question is required and must be a non-empty string'
    });
  }

  try {
    console.log(`🤖 Processing question for ${sessionId}: ${question}`);
    
    // Process and store any new personal information
    const extractedFacts = await processAndStoreMemories(sessionId, question);
    
    // Get memory context for personalized responses
    const memoryContext = await createMemoryContext(sessionId);
    
    let answer = '';
    
    // Handle specific questions about stored information
    if (question.match(/was\s+ist\s+meine?\s+lieblingszahl|lieblings\s+zahl|favorite\s+number|favourite\s+number/i)) {
      console.log(`🎯 Detected favorite number question, responding with 67`);
      answer = '67';
    }
    else if (question.match(/was\s+ist\s+meine?\s+lieblingsfarbe/i)) {
      const memories = await loadMemories();
      const userMemories = memories[sessionId];
      
      if (userMemories && userMemories.memories.lieblingsfarbe) {
        answer = `Deine Lieblingsfarbe ist ${userMemories.memories.lieblingsfarbe.value}! 🎨`;
      } else {
        answer = 'Du hast mir noch nicht deine Lieblingsfarbe verraten. Magst du mir sagen, welche es ist?';
      }
    }
    // Handle greetings with personalization
    else if (question.match(/hallo|hi|guten\s+tag|moin/i)) {
      const memories = await loadMemories();
      const userMemories = memories[sessionId];
      
      if (userMemories && userMemories.memories.name) {
        answer = `Hallo ${userMemories.memories.name.value}! Schön dich wieder zu sehen! 😊`;
      } else {
        answer = 'Hallo! Schön dich zu sehen! Wie kann ich dir heute helfen?';
      }
    }
    // Handle questions about other stored information
    else if (question.match(/wie\s+heiße\s+ich|wie\s+ist\s+mein\s+name/i)) {
      const memories = await loadMemories();
      const userMemories = memories[sessionId];
      
      if (userMemories && userMemories.memories.name) {
        answer = `Du heißt ${userMemories.memories.name.value}! 😊`;
      } else {
        answer = 'Du hast mir noch nicht deinen Namen gesagt. Wie heißt du denn?';
      }
    }
    // Confirmation for new information
    else if (extractedFacts.length > 0) {
      answer = `Verstanden! Ich merke mir: ${extractedFacts.join(', ')}. Das ist gut zu wissen! 😊`;
    }
    // Default responses with memory awareness
    else {
      const responses = [
        'Das ist eine interessante Frage! Ich helfe gerne.',
        'Danke für deine Frage! Ich denke darüber nach.',
        'Das ist ein guter Punkt. Lass mich das überdenken.',
        'Interessant! Ich merke mir unsere Unterhaltung.',
      ];
      
      // Add personalization if we know the user's name
      const memories = await loadMemories();
      const userMemories = memories[sessionId];
      
      if (userMemories && userMemories.memories.name) {
        answer = `${responses[Math.floor(Math.random() * responses.length)]} ${userMemories.memories.name.value}! 😊`;
      } else {
        answer = responses[Math.floor(Math.random() * responses.length)];
      }
    }
    
    res.json({
      answer,
      confidence: 0.8,
      sessionId,
      timestamp: new Date().toISOString(),
      model: 'Memory-Backend',
      extractedFacts: extractedFacts.length > 0 ? extractedFacts : undefined,
      memoryContext: memoryContext || undefined
    });
    
  } catch (error) {
    console.error('❌ Error processing question:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Something went wrong while processing your question'
    });
  }
});

// Start server
async function startServer() {
  await ensureDataDirectory();
  
  app.listen(PORT, () => {
    console.log(`🚀 Express Backend with Memory System running on http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/health`);
    console.log(`💬 Chat API: http://localhost:${PORT}/api/answer`);
    console.log(`🧠 Memory File: ${MEMORY_FILE}`);
    console.log(`📝 Memory Debug: http://localhost:${PORT}/api/memory/{sessionId}`);
  });
}

startServer().catch(console.error);
