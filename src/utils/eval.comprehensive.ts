/**
 * Comprehensive evaluation script for measuring accuracy improvements
 * - Single-turn evaluation for baseline accuracy
 * - Multi-turn evaluation for memory capability
 * - Performance metrics (P50, fallback rates)
 * - Before/after comparison support
 */

import fs from 'fs';
import path from 'path';
import http from 'http';

interface SingleEvalItem {
  question: string;
  expectedId: string;
}

interface AnswerResponse {
  answer: string;
  confidence: number;
  sourceId?: string;
  timestamp: string;
}

interface SingleTurnResult {
  question: string;
  expectedId: string;
  actualId?: string;
  confidence: number;
  correct: boolean;
  isFallback: boolean;
  responseTime: number;
}

interface EvaluationSummary {
  type: 'single' | 'multi';
  timestamp: string;
  totalQuestions: number;
  accuracy: number;
  fallbackRate: number;
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  results: SingleTurnResult[];
  errorAnalysis: {
    topErrors: Array<{
      question: string;
      expectedId: string;
      actualId?: string;
      frequency: number;
    }>;
  };
}

/**
 * Make HTTP request to the answer API
 */
async function askQuestion(question: string, sessionId: string = 'eval-session'): Promise<{ response: AnswerResponse; responseTime: number }> {
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
 * Run single-turn evaluation
 */
async function runSingleTurnEvaluation(): Promise<EvaluationSummary> {
  console.log('🎯 Running Single-Turn Evaluation');
  console.log('================================');
  
  const evalPath = path.join(process.cwd(), 'eval', 'eval_single.json');
  const evalData: SingleEvalItem[] = JSON.parse(fs.readFileSync(evalPath, 'utf-8'));
  
  console.log(`📋 Evaluating ${evalData.length} questions`);
  
  const results: SingleTurnResult[] = [];
  let correctCount = 0;
  let fallbackCount = 0;
  
  for (const [index, item] of evalData.entries()) {
    console.log(`\n${index + 1}/${evalData.length}: "${item.question}"`);
    
    try {
      const { response, responseTime } = await askQuestion(item.question);
      
      const isFallback = response.confidence < 0.5;
      const correct = response.sourceId === item.expectedId;
      
      if (correct) correctCount++;
      if (isFallback) fallbackCount++;
      
      results.push({
        question: item.question,
        expectedId: item.expectedId,
        actualId: response.sourceId,
        confidence: response.confidence,
        correct,
        isFallback,
        responseTime
      });
      
      console.log(`   Expected: ${item.expectedId}`);
      console.log(`   Actual: ${response.sourceId || 'none'}`);
      console.log(`   Confidence: ${response.confidence.toFixed(3)}`);
      console.log(`   ${correct ? '✅' : '❌'} ${isFallback ? '(fallback)' : ''} (${responseTime}ms)`);
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 50));
      
    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      results.push({
        question: item.question,
        expectedId: item.expectedId,
        actualId: undefined,
        confidence: 0,
        correct: false,
        isFallback: true,
        responseTime: 0
      });
      
      fallbackCount++;
    }
  }
  
  // Calculate metrics
  const accuracy = correctCount / evalData.length;
  const fallbackRate = fallbackCount / evalData.length;
  const responseTimes = results.map(r => r.responseTime).filter(t => t > 0);
  const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  const p50ResponseTime = calculatePercentile(responseTimes, 50);
  const p95ResponseTime = calculatePercentile(responseTimes, 95);
  
  // Error analysis
  const errors = results.filter(r => !r.correct);
  const errorCounts = new Map<string, number>();
  
  for (const error of errors) {
    const key = `${error.expectedId}->${error.actualId || 'none'}`;
    errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
  }
  
  const topErrors = Array.from(errorCounts.entries())
    .map(([key, frequency]) => {
      const [expectedId, actualId] = key.split('->');
      const errorItem = errors.find(e => e.expectedId === expectedId && (e.actualId || 'none') === actualId);
      return {
        question: errorItem?.question || '',
        expectedId,
        actualId: actualId === 'none' ? undefined : actualId,
        frequency
      };
    })
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 5);
  
  return {
    type: 'single',
    timestamp: new Date().toISOString(),
    totalQuestions: evalData.length,
    accuracy: Math.round(accuracy * 100 * 10) / 10,
    fallbackRate: Math.round(fallbackRate * 100 * 10) / 10,
    avgResponseTime: Math.round(avgResponseTime),
    p50ResponseTime: Math.round(p50ResponseTime),
    p95ResponseTime: Math.round(p95ResponseTime),
    results,
    errorAnalysis: {
      topErrors
    }
  };
}

/**
 * Calculate percentile of an array
 */
function calculatePercentile(arr: number[], percentile: number): number {
  if (arr.length === 0) return 0;
  
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  
  if (Number.isInteger(index)) {
    return sorted[index];
  } else {
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }
}

/**
 * Save evaluation results
 */
function saveEvaluationResults(summary: EvaluationSummary, filename?: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const defaultFilename = `eval_${summary.type}_${timestamp}.json`;
  const resultPath = path.join(process.cwd(), 'eval', filename || defaultFilename);
  
  fs.writeFileSync(resultPath, JSON.stringify(summary, null, 2));
  console.log(`💾 Results saved to: ${resultPath}`);
  
  return resultPath;
}

/**
 * Compare two evaluation results
 */
function compareEvaluations(before: EvaluationSummary, after: EvaluationSummary) {
  console.log('\n📊 COMPARISON RESULTS');
  console.log('====================');
  console.log(`Accuracy: ${before.accuracy}% → ${after.accuracy}% (${after.accuracy > before.accuracy ? '+' : ''}${(after.accuracy - before.accuracy).toFixed(1)}%)`);
  console.log(`Fallback Rate: ${before.fallbackRate}% → ${after.fallbackRate}% (${after.fallbackRate < before.fallbackRate ? '-' : '+'}${(after.fallbackRate - before.fallbackRate).toFixed(1)}%)`);
  console.log(`P50 Response Time: ${before.p50ResponseTime}ms → ${after.p50ResponseTime}ms (${after.p50ResponseTime < before.p50ResponseTime ? '-' : '+'}${after.p50ResponseTime - before.p50ResponseTime}ms)`);
  console.log(`Avg Response Time: ${before.avgResponseTime}ms → ${after.avgResponseTime}ms (${after.avgResponseTime < before.avgResponseTime ? '-' : '+'}${Math.round(after.avgResponseTime - before.avgResponseTime)}ms)`);
  
  // Show improvement/regression details
  const improvements = [];
  const regressions = [];
  
  for (const afterResult of after.results) {
    const beforeResult = before.results.find(r => r.question === afterResult.question);
    if (beforeResult) {
      if (!beforeResult.correct && afterResult.correct) {
        improvements.push(afterResult.question);
      } else if (beforeResult.correct && !afterResult.correct) {
        regressions.push(afterResult.question);
      }
    }
  }
  
  if (improvements.length > 0) {
    console.log(`\n✅ Improvements (${improvements.length}):`);
    improvements.forEach(q => console.log(`   "${q}"`));
  }
  
  if (regressions.length > 0) {
    console.log(`\n❌ Regressions (${regressions.length}):`);
    regressions.forEach(q => console.log(`   "${q}"`));
  }
}

/**
 * Print evaluation summary
 */
function printSummary(summary: EvaluationSummary) {
  console.log(`\n📊 ${summary.type.toUpperCase()}-TURN EVALUATION SUMMARY`);
  console.log('='.repeat(40));
  console.log(`Total Questions: ${summary.totalQuestions}`);
  console.log(`Accuracy@1: ${summary.accuracy}%`);
  console.log(`Fallback Rate: ${summary.fallbackRate}%`);
  console.log(`Avg Response Time: ${summary.avgResponseTime}ms`);
  console.log(`P50 Response Time: ${summary.p50ResponseTime}ms`);
  console.log(`P95 Response Time: ${summary.p95ResponseTime}ms`);
  
  if (summary.errorAnalysis.topErrors.length > 0) {
    console.log('\n❌ Top Errors:');
    for (const error of summary.errorAnalysis.topErrors) {
      console.log(`   ${error.frequency}x: "${error.question}"`);
      console.log(`      Expected: ${error.expectedId}, Got: ${error.actualId || 'none'}`);
    }
  }
}

/**
 * Main evaluation function
 */
async function runEvaluation(type: 'single' | 'multi' | 'both' = 'single') {
  console.log('🧪 Starting Evaluation System');
  console.log('=============================');
  
  try {
    if (type === 'single' || type === 'both') {
      const singleResults = await runSingleTurnEvaluation();
      printSummary(singleResults);
      saveEvaluationResults(singleResults);
    }
    
    if (type === 'multi' || type === 'both') {
      // Import and run multi-turn evaluation
      const { runMultiTurnEvaluation } = await import('./eval.multi.js');
      await runMultiTurnEvaluation();
    }
    
    console.log('\n✅ Evaluation completed successfully!');
    
  } catch (error) {
    console.error('❌ Evaluation failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const evalType = process.argv[2] as 'single' | 'multi' | 'both' || 'single';
  runEvaluation(evalType).catch(console.error);
}

export { 
  runSingleTurnEvaluation, 
  runEvaluation, 
  compareEvaluations, 
  EvaluationSummary, 
  SingleTurnResult 
};
