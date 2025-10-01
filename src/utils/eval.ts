/**
 * Task: Evaluate the current QA system end-to-end.
 * - Read ./eval/eval.csv (columns: question, answer_id, notes)
 * - For each row: call HTTP POST /api/answer with {question}
 * - Collect metrics:
 *    - accuracy@1: predicted.sourceId === expected answer_id (ignore rows with answer_id="__NONE__")
 *    - fallback rate: confidence < THRESHOLD or missing sourceId
 *    - average response time (ms)
 * - CLI flags:
 *    --endpoint=http://localhost:8080/api/answer
 *    --threshold=0.55
 *    --limit=100
 *    --fail-under-acc=0.6   (exit 1 if accuracy < 0.6)
 * - Print a compact report table (cli-table3) and a summary line.
 * - Handle network errors gracefully; count them as fallback.
 * - Return non-zero exit code on file read or schema errors.
 */

import fs from 'fs/promises';
import path from 'path';
import { parseArgs } from 'node:util';
import { parseEvalRows, isNoneCase, getEvalStats, type EvalRow } from './eval.validate.js';

// Simple table formatting without external dependency
class SimpleTable {
  private headers: string[];
  private rows: string[][] = [];
  private colWidths: number[];

  constructor(config: { head: string[]; colWidths?: number[] }) {
    this.headers = config.head;
    this.colWidths = config.colWidths || this.headers.map(() => 15);
  }

  push(row: string[]): void {
    this.rows.push(row);
  }

  toString(): string {
    const lines: string[] = [];
    
    // Header
    const headerLine = this.headers.map((header, i) => 
      header.padEnd(this.colWidths[i]).substring(0, this.colWidths[i])
    ).join(' | ');
    lines.push(headerLine);
    lines.push('-'.repeat(headerLine.length));
    
    // Rows
    this.rows.forEach(row => {
      const rowLine = row.map((cell, i) => 
        cell.padEnd(this.colWidths[i]).substring(0, this.colWidths[i])
      ).join(' | ');
      lines.push(rowLine);
    });
    
    return lines.join('\n');
  }
}

interface EvaluationConfig {
  endpoint: string;
  threshold: number;
  limit: number;
  failUnderAccuracy: number;
}

interface ApiResponse {
  answer: string;
  confidence: number;
  sourceId?: string;
  timestamp: string;
}

interface EvaluationResult {
  question: string;
  expectedId: string;
  predictedId: string | null;
  confidence: number | null;
  responseTime: number;
  isCorrect: boolean;
  isFallback: boolean;
  isNetworkError: boolean;
  notes: string;
  error?: string;
}

interface EvaluationMetrics {
  totalQuestions: number;
  accuracy: number;
  accuracyCount: number;
  fallbackRate: number;
  fallbackCount: number;
  avgResponseTime: number;
  networkErrors: number;
  questionsWithExpectedAnswers: number;
}

/**
 * Parse command line arguments
 */
function parseCommandLineArgs(): EvaluationConfig {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      endpoint: { type: 'string', default: 'http://localhost:8080/api/answer' },
      threshold: { type: 'string', default: '0.55' },
      limit: { type: 'string', default: '100' },
      'fail-under-acc': { type: 'string', default: '0.6' },
    },
    allowPositionals: false,
  });

  return {
    endpoint: values.endpoint!,
    threshold: parseFloat(values.threshold!),
    limit: parseInt(values.limit!, 10),
    failUnderAccuracy: parseFloat(values['fail-under-acc']!),
  };
}

/**
 * Load and parse evaluation CSV file
 */
async function loadEvaluationData(): Promise<EvalRow[]> {
  try {
    const csvPath = path.resolve(process.cwd(), 'backend/eval/eval.csv');
    const csvContent = await fs.readFile(csvPath, 'utf-8');
    
    // Simple CSV parsing (assuming well-formed CSV)
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    
    const records = lines.slice(1).map(line => {
      // Handle quoted fields properly
      const values = line.match(/("(?:[^"\\\\]|\\\\.)*"|[^,]*)/g) || [];
      const record: any = {};
      
      headers.forEach((header, index) => {
        record[header] = values[index]?.replace(/^"(.*)"$/, '$1') || '';
      });
      
      return record;
    });

    return parseEvalRows(records);
  } catch (error) {
    console.error('❌ Failed to load evaluation data:');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Make API call to get answer
 */
async function callAnswerApi(question: string, endpoint: string): Promise<{
  response: ApiResponse | null;
  responseTime: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question }),
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      return {
        response: null,
        responseTime,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      response: data as ApiResponse,
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      response: null,
      responseTime,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Evaluate a single question
 */
async function evaluateQuestion(
  evalRow: EvalRow,
  config: EvaluationConfig
): Promise<EvaluationResult> {
  const { question, answer_id: expectedId, notes } = evalRow;
  
  const { response, responseTime, error } = await callAnswerApi(question, config.endpoint);
  
  const isNetworkError = !!error;
  const predictedId = response?.sourceId || null;
  const confidence = response?.confidence || null;
  
  // Check if this is a fallback case
  const isFallback = isNetworkError || 
                    confidence === null || 
                    confidence < config.threshold || 
                    !predictedId;
  
  // Calculate accuracy (only for rows that expect a match)
  const expectsMatch = !isNoneCase(expectedId);
  const isCorrect = expectsMatch && predictedId === expectedId;

  return {
    question,
    expectedId,
    predictedId,
    confidence,
    responseTime,
    isCorrect,
    isFallback,
    isNetworkError,
    notes,
    error,
  };
}

/**
 * Calculate evaluation metrics
 */
function calculateMetrics(results: EvaluationResult[]): EvaluationMetrics {
  const questionsWithExpectedAnswers = results.filter(r => !isNoneCase(r.expectedId)).length;
  const accuracyCount = results.filter(r => r.isCorrect).length;
  const fallbackCount = results.filter(r => r.isFallback).length;
  const networkErrors = results.filter(r => r.isNetworkError).length;
  
  const totalResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0);
  const avgResponseTime = totalResponseTime / results.length;
  
  return {
    totalQuestions: results.length,
    accuracy: questionsWithExpectedAnswers > 0 ? accuracyCount / questionsWithExpectedAnswers : 0,
    accuracyCount,
    fallbackRate: fallbackCount / results.length,
    fallbackCount,
    avgResponseTime,
    networkErrors,
    questionsWithExpectedAnswers,
  };
}

/**
 * Print evaluation results table
 */
function printResultsTable(results: EvaluationResult[]): void {
  const table = new SimpleTable({
    head: ['Question', 'Expected', 'Predicted', 'Confidence', 'Time (ms)', 'Status', 'Notes'],
    colWidths: [35, 15, 15, 12, 10, 10, 15],
  });

  results.forEach(result => {
    const {
      question,
      expectedId,
      predictedId,
      confidence,
      responseTime,
      isCorrect,
      isFallback,
      isNetworkError,
      notes,
      error,
    } = result;

    const truncatedQuestion = question.length > 32 ? question.substring(0, 32) + '...' : question;
    const confidenceStr = confidence !== null ? confidence.toFixed(3) : 'N/A';
    const predictedStr = predictedId || (error ? 'ERROR' : 'NONE');
    
    let status = '';
    if (isNetworkError) {
      status = '🔴 NET_ERR';
    } else if (isFallback) {
      status = '🟡 FALLBACK';
    } else if (isNoneCase(expectedId)) {
      status = '🔵 NONE';
    } else if (isCorrect) {
      status = '✅ CORRECT';
    } else {
      status = '❌ WRONG';
    }

    table.push([
      truncatedQuestion,
      expectedId,
      predictedStr,
      confidenceStr,
      responseTime.toString(),
      status,
      notes,
    ]);
  });

  console.log('\n📊 Evaluation Results:');
  console.log(table.toString());
}

/**
 * Print summary metrics
 */
function printSummary(metrics: EvaluationMetrics, config: EvaluationConfig): void {
  console.log('\n📈 Summary Metrics:');
  console.log('─'.repeat(50));
  console.log(`Total Questions:     ${metrics.totalQuestions}`);
  console.log(`Expected Answers:    ${metrics.questionsWithExpectedAnswers}`);
  console.log(`Accuracy@1:          ${(metrics.accuracy * 100).toFixed(1)}% (${metrics.accuracyCount}/${metrics.questionsWithExpectedAnswers})`);
  console.log(`Fallback Rate:       ${(metrics.fallbackRate * 100).toFixed(1)}% (${metrics.fallbackCount}/${metrics.totalQuestions})`);
  console.log(`Avg Response Time:   ${metrics.avgResponseTime.toFixed(0)}ms`);
  console.log(`Network Errors:      ${metrics.networkErrors}`);
  console.log(`Confidence Threshold: ${config.threshold}`);
  console.log('─'.repeat(50));

  // Final status
  if (metrics.accuracy >= config.failUnderAccuracy) {
    console.log(`✅ PASSED: Accuracy ${(metrics.accuracy * 100).toFixed(1)}% >= ${(config.failUnderAccuracy * 100).toFixed(1)}%`);
  } else {
    console.log(`❌ FAILED: Accuracy ${(metrics.accuracy * 100).toFixed(1)}% < ${(config.failUnderAccuracy * 100).toFixed(1)}%`);
  }
}

/**
 * Main evaluation function
 */
export async function runEvaluation(): Promise<void> {
  console.log('🚀 Starting QA System Evaluation...\n');

  // Parse CLI arguments
  const config = parseCommandLineArgs();
  console.log(`📍 Endpoint: ${config.endpoint}`);
  console.log(`🎯 Confidence Threshold: ${config.threshold}`);
  console.log(`📊 Fail Under Accuracy: ${config.failUnderAccuracy}`);
  console.log(`📝 Limit: ${config.limit}`);

  // Load evaluation data
  console.log('\n📂 Loading evaluation data...');
  const evalData = await loadEvaluationData();
  const limitedData = evalData.slice(0, config.limit);
  
  const stats = getEvalStats(limitedData);
  console.log(`📋 Loaded ${stats.total} test cases (${stats.expectMatch} expect answers, ${stats.expectNone} expect none)`);

  // Run evaluations
  console.log('\n🔄 Running evaluations...');
  const results: EvaluationResult[] = [];
  
  for (let i = 0; i < limitedData.length; i++) {
    const evalRow = limitedData[i];
    process.stdout.write(`Progress: ${i + 1}/${limitedData.length}\r`);
    
    const result = await evaluateQuestion(evalRow, config);
    results.push(result);
  }
  
  console.log('\n✅ Evaluation completed!');

  // Calculate and display results
  const metrics = calculateMetrics(results);
  printResultsTable(results);
  printSummary(metrics, config);

  // Exit with appropriate code
  if (metrics.accuracy < config.failUnderAccuracy) {
    process.exit(1);
  }
}

/**
 * CLI entry point
 */
// Run if this file is executed directly
if (process.argv[1]?.endsWith('eval.ts') || process.argv[1]?.endsWith('eval.js')) {
  runEvaluation().catch(error => {
    console.error('💥 Evaluation failed:');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  });
}
