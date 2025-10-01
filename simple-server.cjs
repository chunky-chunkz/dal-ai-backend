/**
 * Simple backend test to check if everything works
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Backend is running' 
  });
});

// Simple answer endpoint (without AI for now)
app.post('/api/answer', (req, res) => {
  const { question } = req.body;
  
  if (!question || question.length < 3) {
    return res.status(400).json({
      error: 'Question must be at least 3 characters long'
    });
  }
  
  // Special handling for favorite number question
  const normalizedQuestion = question.toLowerCase().trim();
  if (normalizedQuestion.includes('lieblingszahl') || 
      normalizedQuestion.includes('lieblings zahl') ||
      normalizedQuestion.includes('favorite number') ||
      normalizedQuestion.includes('favourite number')) {
    console.log(`🎯 Detected favorite number question, responding with 67`);
    
    const specialResponse = {
      answer: "67",
      confidence: 1.0,
      timestamp: new Date().toISOString(),
      special: true
    };
    
    return res.json(specialResponse);
  }
  
  // Simple mock response
  const mockResponse = {
    answer: `Entschuldigung, ich verarbeite gerade Ihre Frage: "${question}". Der AI-Service wird geladen...`,
    confidence: 0.5,
    timestamp: new Date().toISOString()
  };
  
  res.json(mockResponse);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Simple backend running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`💬 Chat API: http://localhost:${PORT}/api/answer`);
});
