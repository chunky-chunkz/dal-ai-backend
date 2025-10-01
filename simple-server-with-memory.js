/**
 * Simple Express Server with TypeScript Memory System
 */

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
const PORT = 8080;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Simple memory storage
const conversations = new Map();

function addToMemory(sessionId, role, text) {
  if (!conversations.has(sessionId)) {
    conversations.set(sessionId, []);
  }
  
  const conversation = conversations.get(sessionId);
  conversation.push({
    role,
    text,
    timestamp: new Date().toISOString()
  });
  
  // Keep only last 20 messages
  if (conversation.length > 20) {
    conversation.splice(0, conversation.length - 20);
  }
  
  console.log(`💭 Memory for ${sessionId}: ${conversation.length} messages`);
}

function getMemoryContext(sessionId) {
  const conversation = conversations.get(sessionId) || [];
  if (conversation.length === 0) return '';
  
  return '\n\nVorherige Unterhaltung:\n' + 
    conversation.slice(-6).map(msg => `${msg.role}: ${msg.text}`).join('\n') + '\n';
}

function extractPersonalInfo(text, sessionId) {
  // Extrahiert persönliche Informationen aus deutschen Texten
  const patterns = [
    /meine?\s+lieblingsfarbe\s+ist\s+(\w+)/i,
    /ich\s+heiße\s+(\w+)/i,
    /mein\s+name\s+ist\s+(\w+)/i,
    /ich\s+bin\s+(\d+)\s+jahre?\s+alt/i,
    /ich\s+wohne\s+in\s+(\w+)/i,
    /ich\s+komme\s+aus\s+(\w+)/i,
  ];
  
  const facts = [];
  
  patterns.forEach(pattern => {
    const match = text.match(pattern);
    if (match) {
      let fact = '';
      if (pattern.source.includes('lieblingsfarbe')) {
        fact = `Lieblingsfarbe: ${match[1]}`;
      } else if (pattern.source.includes('heiße|name')) {
        fact = `Name: ${match[1]}`;
      } else if (pattern.source.includes('jahre')) {
        fact = `Alter: ${match[1]} Jahre`;
      } else if (pattern.source.includes('wohne')) {
        fact = `Wohnort: ${match[1]}`;
      } else if (pattern.source.includes('komme')) {
        fact = `Herkunft: ${match[1]}`;
      }
      
      if (fact) {
        facts.push(fact);
        console.log(`🧠 Learned about ${sessionId}: ${fact}`);
      }
    }
  });
  
  return facts;
}

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    message: 'Express Backend with Memory System',
    sessions: conversations.size
  });
});

// Memory debug endpoint
app.get('/api/memory/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const conversation = conversations.get(sessionId) || [];
  
  res.json({
    sessionId,
    messageCount: conversation.length,
    conversation,
    timestamp: new Date().toISOString()
  });
});

// Chat endpoint
app.post('/api/answer', async (req, res) => {
  const { question, sessionId = 'anonymous' } = req.body;
  
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({
      error: 'Question is required and must be a non-empty string'
    });
  }
  
  try {
    console.log(`🤖 Processing question for ${sessionId}: ${question}`);
    
    // Store user message
    addToMemory(sessionId, 'user', question);
    
    // Extract personal information
    const personalFacts = extractPersonalInfo(question, sessionId);
    
    // Get conversation context
    const context = getMemoryContext(sessionId);
    
    // Simple AI responses based on patterns
    let answer = '';
    
    // Antworte auf Fragen zu gespeicherten Informationen
    if (question.match(/was\s+ist\s+meine?\s+lieblingsfarbe/i)) {
      const conversation = conversations.get(sessionId) || [];
      const colorMention = conversation.find(msg => 
        msg.role === 'user' && msg.text.match(/meine?\s+lieblingsfarbe\s+ist\s+(\w+)/i)
      );
      
      if (colorMention) {
        const colorMatch = colorMention.text.match(/meine?\s+lieblingsfarbe\s+ist\s+(\w+)/i);
        answer = `Deine Lieblingsfarbe ist ${colorMatch[1]}! 🎨`;
      } else {
        answer = 'Du hast mir noch nicht deine Lieblingsfarbe verraten. Magst du mir sagen, welche es ist?';
      }
    }
    // Begrüßung
    else if (question.match(/hallo|hi|guten\s+tag|moin/i)) {
      const conversation = conversations.get(sessionId) || [];
      const nameMention = conversation.find(msg => 
        msg.role === 'user' && msg.text.match(/ich\s+heiße\s+(\w+)|mein\s+name\s+ist\s+(\w+)/i)
      );
      
      if (nameMention) {
        const nameMatch = nameMention.text.match(/ich\s+heiße\s+(\w+)|mein\s+name\s+ist\s+(\w+)/i);
        const name = nameMatch[1] || nameMatch[2];
        answer = `Hallo ${name}! Schön dich wieder zu sehen! 😊`;
      } else {
        answer = 'Hallo! Schön dich zu sehen! Wie kann ich dir heute helfen?';
      }
    }
    // Erinnerungsbestätigung
    else if (personalFacts.length > 0) {
      answer = `Verstanden! Ich merke mir: ${personalFacts.join(', ')}. Das ist gut zu wissen! 😊`;
    }
    // Standard-Antworten
    else {
      const responses = [
        'Das ist eine interessante Frage! Ich versuche mein Bestes zu helfen.',
        'Danke für deine Frage! Ich denke darüber nach.',
        'Das ist ein guter Punkt. Lass mich das überdenken.',
        'Interessant! Ich merke mir unsere Unterhaltung für zukünftige Gespräche.',
      ];
      answer = responses[Math.floor(Math.random() * responses.length)];
    }
    
    // Store AI response
    addToMemory(sessionId, 'assistant', answer);
    
    res.json({
      answer,
      confidence: 0.8,
      sessionId,
      timestamp: new Date().toISOString(),
      personalFacts: personalFacts.length > 0 ? personalFacts : undefined
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
app.listen(PORT, () => {
  console.log(`🚀 Express Backend running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`💬 Chat API: http://localhost:${PORT}/api/answer`);
  console.log(`🧠 Memory System: Enabled`);
});
