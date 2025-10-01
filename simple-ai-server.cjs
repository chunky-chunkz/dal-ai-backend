/**
 * Simple AI Backend Server with Real Ollama Integration
 */

const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');
const { putTurn, getContext, formatContextForPrompt, getActiveSessions, getTurnCount, summarize } = require('./sessionMemory.cjs');
const { getProfilePrompt, autoDetectPreferences } = require('./profileStore.cjs');

const app = express();
const PORT = 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Simple HTTP request function
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, json: () => jsonData, status: res.statusCode, statusText: res.statusMessage });
        } catch (e) {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, text: () => data, status: res.statusCode, statusText: res.statusMessage });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}
const OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'mistral:7b-instruct-q4_K_M'; // Fast model for simple questions
const STRONG_MODEL = 'sunrise-phi3:latest'; // More capable model for complex questions

// Simple model selection based on question complexity
function chooseModel(question) {
  // Use strong model for:
  // - Long questions (>160 chars)
  // - Complex questions (multiple sentences, specific topics)
  const questionLen = question.length;
  const isComplex = questionLen > 160 || 
                   question.includes('?') && question.split('.').length > 2 ||
                   /\b(warum|weshalb|wieso|erkl[äa]r|wie funktioniert|was ist der unterschied)\b/i.test(question);
  
  const selectedModel = isComplex ? STRONG_MODEL : DEFAULT_MODEL;
  console.log(`🤖 Model selection: ${selectedModel} (question length: ${questionLen}, complex: ${isComplex})`);
  
  return selectedModel;
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'AI Backend is running',
    ollama: OLLAMA_URL,
    models: {
      default: DEFAULT_MODEL,
      strong: STRONG_MODEL
    }
  });
});

// Memory debug endpoint
app.get('/api/memory/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  // Get memory for specific session
  const context = getContext(sessionId, 20); // Get up to 20 turns
  const summary = summarize(sessionId);
  const turnCount = getTurnCount(sessionId);
  
  res.json({
    sessionId,
    turnCount,
    summary,
    context,
    timestamp: new Date().toISOString()
  });
});

// Memory overview endpoint
app.get('/api/memory', (req, res) => {
  // Get overview of all sessions
  const activeSessions = getActiveSessions();
  const sessionStats = activeSessions.map(sid => ({
    sessionId: sid,
    turnCount: getTurnCount(sid),
    summary: summarize(sid)
  }));
  
  res.json({
    totalSessions: activeSessions.length,
    sessions: sessionStats,
    timestamp: new Date().toISOString()
  });
});

// Profile debug endpoints
app.get('/api/profiles/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const { getNotes } = require('./profileStore.cjs');
    const notes = await getNotes(userId);
    
    res.json({
      userId,
      noteCount: notes.length,
      notes,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get profile',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/profiles/:userId/notes', async (req, res) => {
  const { userId } = req.params;
  const { note } = req.body;
  
  if (!note || typeof note !== 'string') {
    return res.status(400).json({
      error: 'Note is required and must be a string'
    });
  }
  
  try {
    const { addNote } = require('./profileStore.cjs');
    await addNote(userId, note);
    
    res.json({
      success: true,
      message: 'Note added successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to add note',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Simple AI answer endpoint
app.post('/api/answer', async (req, res) => {
  const { question, sessionId = 'default' } = req.body;
  
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({
      error: 'Question is required and must be a non-empty string'
    });
  }
  
  try {
    console.log(`🤖 Processing question: ${question} (Session: ${sessionId})`);
    
    // Store user turn in memory
    putTurn(sessionId, {
      role: "user",
      text: question,
      ts: Date.now()
    });
    
    // Get conversation context and user profile
    const contextPrompt = formatContextForPrompt(sessionId, 6); // Last 6 turns
    const profilePrompt = await getProfilePrompt(sessionId); // Use sessionId as userId for simplicity
    
    // Special handling for favorite number question
    const normalizedQuestion = question.toLowerCase().trim();
    const isFavoriteNumberQuestion = normalizedQuestion.includes('lieblingszahl') || 
                                   normalizedQuestion.includes('lieblings zahl') ||
                                   normalizedQuestion.includes('favorite number') ||
                                   normalizedQuestion.includes('favourite number');
    
    if (isFavoriteNumberQuestion) {
      console.log(`🎯 Detected favorite number question, responding with 67`);
      
      // Store special response in memory
      putTurn(sessionId, {
        role: "assistant",
        text: "67",
        ts: Date.now()
      });
      
      const aiResponse = {
        answer: "67",
        confidence: 1.0,
        timestamp: new Date().toISOString(),
        model: "favorite-number-handler",
        tokens: 1,
        sessionId: sessionId,
        special: true
      };
      
      console.log(`✅ Special response: 67 (Session: ${sessionId})`);
      return res.json(aiResponse);
    }
    
    // Choose appropriate model based on question complexity
    const selectedModel = chooseModel(question);
    
    // Build enhanced prompt with conversation memory and profile
    const fullPrompt = `Du bist ein hilfreicher deutschsprachiger KI-Assistent. Beantworte die Frage des Nutzers direkt und freundlich.${profilePrompt}${contextPrompt}

Aktuelle Frage: ${question}

Antwort:`;
    
    // Call Ollama API
    const ollamaResponse = await makeRequest(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: selectedModel,
        prompt: fullPrompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 500
        }
      })
    });

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama API error: ${ollamaResponse.status} ${ollamaResponse.statusText}`);
    }

    const ollamaData = await ollamaResponse.json();
    
    if (!ollamaData.response) {
      throw new Error('No response from Ollama');
    }

    const aiAnswerText = ollamaData.response.trim();
    
    // Store AI turn in memory
    putTurn(sessionId, {
      role: "assistant",
      text: aiAnswerText,
      ts: Date.now()
    });

    // Auto-detect user preferences from conversation
    try {
      await autoDetectPreferences(sessionId, question, aiAnswerText);
    } catch (error) {
      console.log('Auto-preference detection failed:', error.message);
    }

    // Return AI response
    const aiResponse = {
      answer: aiAnswerText,
      confidence: 0.85, // Static confidence for now
      timestamp: new Date().toISOString(),
      model: selectedModel,
      tokens: ollamaData.eval_count || 0,
      sessionId: sessionId
    };
    
    console.log(`✅ AI responded with ${aiResponse.answer.length} characters (Session: ${sessionId})`);
    res.json(aiResponse);
    
  } catch (error) {
    console.error('❌ AI Error:', error.message);
    
    // Fallback response
    const fallbackResponse = {
      answer: `Entschuldigung, ich kann Ihre Frage derzeit nicht bearbeiten. Bitte versuchen Sie es später erneut. (Fehler: ${error.message})`,
      confidence: 0.1,
      timestamp: new Date().toISOString(),
      error: true,
      fallback: true
    };
    
    res.status(200).json(fallbackResponse); // Return 200 to avoid frontend errors
  }
});

// Test Ollama connection
async function testOllamaConnection() {
  try {
    console.log('🔍 Testing Ollama connection...');
    const response = await makeRequest(`${OLLAMA_URL}/api/tags`);
    if (response.ok) {
      const data = await response.json();
      const models = data.models || [];
      console.log(`✅ Ollama connected. Available models: ${models.map(m => m.name).join(', ')}`);
      
      // Check if our model exists
      const hasDefaultModel = models.some(m => m.name === DEFAULT_MODEL);
      const hasStrongModel = models.some(m => m.name === STRONG_MODEL);
      
      if (hasDefaultModel && hasStrongModel) {
        console.log(`✅ Both models available: ${DEFAULT_MODEL}, ${STRONG_MODEL}`);
      } else {
        console.warn(`⚠️  Missing models. Available: ${models.map(m => m.name).join(', ')}`);
        if (!hasDefaultModel) console.warn(`❌ Default model missing: ${DEFAULT_MODEL}`);
        if (!hasStrongModel) console.warn(`❌ Strong model missing: ${STRONG_MODEL}`);
      }
    } else {
      console.error(`❌ Ollama not responding: ${response.status}`);
    }
  } catch (error) {
    console.error(`❌ Ollama connection failed: ${error.message}`);
    console.log('💡 Make sure Ollama is running: ollama serve');
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 AI Backend running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`💬 Chat API: http://localhost:${PORT}/api/answer`);
  console.log('');
  
  // Test Ollama connection on startup
  await testOllamaConnection();
});
