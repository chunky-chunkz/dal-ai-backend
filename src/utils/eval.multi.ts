/**
 * Task: Evaluate multi-turn dialog capability.
 * - Read eval_multi.json: [{sessionId, turns:[{role, text, expectedId?}]}]
 * - Play turns sequentially via /api/answer using same sessionId
 * - Score final answers vs expectedId, compute accuracy and fallback
 */

import fs from 'fs';
import path from 'path';
import http from 'http';

interface EvalTurn {
  role: 'user' | 'assistant';
  text: string;
  expectedId?: string;
}

interface EvalSession {
  sessionId: string;
  description: string;
  turns: EvalTurn[];
}

interface AnswerResponse {
  answer: string;
  confidence: number;
  sourceId?: string;
  timestamp: string;
}

interface EvalResult {
  sessionId: string;
  description: string;
  turns: Array<{
    input: string;
    expectedId?: string;
    actualId?: string;
    confidence: number;
    correct: boolean;
    isFallback: boolean;
    responseTime: number;
  }>;
  accuracy: number;
  fallbackRate: number;
  avgResponseTime: number;
}

const EVAL_DATA_PATH = path.join(process.cwd(), 'eval', 'eval_multi.json');

/**
 * Make HTTP request to the answer API
 */
async function askQuestion(question: string, sessionId: string): Promise<{ response: AnswerResponse; responseTime: number }> {
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ question });
    
    const options = {
      hostname: '127.0.0.1',
      port: 3002,
      path: '/api/answer',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'x-session-id': sessionId
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        try {
          const response = JSON.parse(data) as AnswerResponse;
          resolve({ response, responseTime });
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Evaluate a single session with multiple turns
 */
async function evaluateSession(session: EvalSession): Promise<EvalResult> {
  console.log(`📝 Evaluating session: ${session.sessionId} - ${session.description}`);
  
  const turnResults: EvalResult['turns'] = [];
  let correctCount = 0;
  let fallbackCount = 0;
  let totalResponseTime = 0;
  
  for (const [index, turn] of session.turns.entries()) {
    if (turn.role === 'user') {
      console.log(`   Turn ${index + 1}: "${turn.text}"`);
      
      try {
        const { response, responseTime } = await askQuestion(turn.text, session.sessionId);
        
        const isFallback = response.confidence < 0.5;
        const correct = turn.expectedId ? response.sourceId === turn.expectedId : true;
        
        if (correct) correctCount++;
        if (isFallback) fallbackCount++;
        totalResponseTime += responseTime;
        
        turnResults.push({
          input: turn.text,
          expectedId: turn.expectedId,
          actualId: response.sourceId,
          confidence: response.confidence,
          correct,
          isFallback,
          responseTime
        });
        
        console.log(`      Expected: ${turn.expectedId || 'any'}`);
        console.log(`      Actual: ${response.sourceId || 'none'}`);
        console.log(`      Confidence: ${response.confidence.toFixed(3)}`);
        console.log(`      ${correct ? '✅' : '❌'} ${isFallback ? '(fallback)' : ''}`);
        console.log(`      Response time: ${responseTime}ms`);
        
        // Small delay between turns to simulate real conversation
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`      ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        turnResults.push({
          input: turn.text,
          expectedId: turn.expectedId,
          actualId: undefined,
          confidence: 0,
          correct: false,
          isFallback: true,
          responseTime: 0
        });
        
        fallbackCount++;
      }
    }
  }
  
  const userTurns = session.turns.filter(t => t.role === 'user').length;
  const accuracy = userTurns > 0 ? correctCount / userTurns : 0;
  const fallbackRate = userTurns > 0 ? fallbackCount / userTurns : 0;
  const avgResponseTime = userTurns > 0 ? totalResponseTime / userTurns : 0;
  
  return {
    sessionId: session.sessionId,
    description: session.description,
    turns: turnResults,
    accuracy,
    fallbackRate,
    avgResponseTime
  };
}

/**
 * Load evaluation data from JSON file
 */
function loadEvalData(): EvalSession[] {
  try {
    const data = fs.readFileSync(EVAL_DATA_PATH, 'utf-8');
    return JSON.parse(data) as EvalSession[];
  } catch (error) {
    throw new Error(`Failed to load eval data from ${EVAL_DATA_PATH}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Save evaluation results to file
 */
function saveResults(results: EvalResult[], summary: any) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultPath = path.join(process.cwd(), 'eval', `multi_turn_results_${timestamp}.json`);
  
  const output = {
    timestamp: new Date().toISOString(),
    summary,
    sessions: results
  };
  
  fs.writeFileSync(resultPath, JSON.stringify(output, null, 2));
  console.log(`📊 Results saved to: ${resultPath}`);
}

/**
 * Main evaluation function
 */
async function runMultiTurnEvaluation() {
  console.log('🧪 Starting Multi-Turn Dialog Evaluation');
  console.log('==========================================');
  
  try {
    // Load evaluation sessions
    const sessions = loadEvalData();
    console.log(`📋 Loaded ${sessions.length} evaluation sessions`);
    
    // Run evaluations
    const results: EvalResult[] = [];
    
    for (const session of sessions) {
      const result = await evaluateSession(session);
      results.push(result);
      
      // Short delay between sessions
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Calculate overall metrics
    const totalTurns = results.reduce((sum, r) => sum + r.turns.length, 0);
    const totalCorrect = results.reduce((sum, r) => sum + r.turns.filter(t => t.correct).length, 0);
    const totalFallbacks = results.reduce((sum, r) => sum + r.turns.filter(t => t.isFallback).length, 0);
    const totalResponseTime = results.reduce((sum, r) => sum + r.turns.reduce((tSum, t) => tSum + t.responseTime, 0), 0);
    
    const overallAccuracy = totalTurns > 0 ? totalCorrect / totalTurns : 0;
    const overallFallbackRate = totalTurns > 0 ? totalFallbacks / totalTurns : 0;
    const overallAvgResponseTime = totalTurns > 0 ? totalResponseTime / totalTurns : 0;
    const p50ResponseTime = calculateP50(results.flatMap(r => r.turns.map(t => t.responseTime)));
    
    const summary = {
      totalSessions: sessions.length,
      totalTurns,
      overallAccuracy: Math.round(overallAccuracy * 100 * 10) / 10, // Round to 1 decimal
      overallFallbackRate: Math.round(overallFallbackRate * 100 * 10) / 10,
      avgResponseTime: Math.round(overallAvgResponseTime),
      p50ResponseTime: Math.round(p50ResponseTime),
      sessionResults: results.map(r => ({
        sessionId: r.sessionId,
        accuracy: Math.round(r.accuracy * 100 * 10) / 10,
        fallbackRate: Math.round(r.fallbackRate * 100 * 10) / 10,
        avgResponseTime: Math.round(r.avgResponseTime)
      }))
    };
    
    // Print summary
    console.log('\n📊 EVALUATION SUMMARY');
    console.log('====================');
    console.log(`Total Sessions: ${summary.totalSessions}`);
    console.log(`Total Turns: ${summary.totalTurns}`);
    console.log(`Overall Accuracy: ${summary.overallAccuracy}%`);
    console.log(`Overall Fallback Rate: ${summary.overallFallbackRate}%`);
    console.log(`Avg Response Time: ${summary.avgResponseTime}ms`);
    console.log(`P50 Response Time: ${summary.p50ResponseTime}ms`);
    
    console.log('\n📋 Session Breakdown:');
    for (const sessionResult of summary.sessionResults) {
      console.log(`  ${sessionResult.sessionId}: ${sessionResult.accuracy}% accuracy, ${sessionResult.fallbackRate}% fallback, ${sessionResult.avgResponseTime}ms avg`);
    }
    
    // Identify problematic turns
    console.log('\n❌ Failed Turns:');
    for (const result of results) {
      const failedTurns = result.turns.filter(t => !t.correct);
      if (failedTurns.length > 0) {
        console.log(`  Session ${result.sessionId}:`);
        for (const turn of failedTurns) {
          console.log(`    "${turn.input}"`);
          console.log(`      Expected: ${turn.expectedId}, Got: ${turn.actualId || 'none'}`);
        }
      }
    }
    
    // Save results
    saveResults(results, summary);
    
    console.log('\n✅ Multi-turn evaluation completed successfully!');
    
  } catch (error) {
    console.error('❌ Evaluation failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Calculate P50 (median) response time
 */
function calculateP50(times: number[]): number {
  if (times.length === 0) return 0;
  
  const sorted = times.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

// Run evaluation if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMultiTurnEvaluation().catch(console.error);
}

export { runMultiTurnEvaluation, EvalSession, EvalResult };
