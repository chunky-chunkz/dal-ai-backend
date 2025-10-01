/**
 * Aufgabe: Reporting-Helfer für Eval.
 * - makeRowView({i, question, expected, predicted, confidence, ms, ok})
 * - printTable(rows): cli-table3 mit Spalten [#, Question, Expected, Predicted, Conf, ms, ✓]
 * - printSummary({total, correct, acc, fallbacks, fbRate, avgMs})
 * - optional: export CSV der Fehlfälle nach ./eval/fails.csv
 */

import fs from 'fs/promises';
import path from 'path';
import { formatMs } from './stopwatch.js';

// Row view interface for table display
export interface RowView {
  index: number;
  question: string;
  expected: string;
  predicted: string | null;
  confidence: number | null;
  responseTime: number;
  isCorrect: boolean;
  isFallback?: boolean;
  isNetworkError?: boolean;
  notes?: string;
  error?: string;
}

// Summary metrics interface
export interface SummaryMetrics {
  total: number;
  correct: number;
  accuracy: number;
  fallbacks: number;
  fallbackRate: number;
  avgResponseTime: number;
  networkErrors?: number;
  questionsWithExpectedAnswers?: number;
}

// Simple table formatting (no external dependency)
class ReportTable {
  private headers: string[];
  private rows: string[][] = [];
  private colWidths: number[];

  constructor(config: { head: string[]; colWidths?: number[] }) {
    this.headers = config.head;
    this.colWidths = config.colWidths || this.headers.map(() => 12);
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
    lines.push('─'.repeat(headerLine.length));
    
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

/**
 * Create a standardized row view for table display
 */
export function makeRowView(input: {
  i: number;
  question: string;
  expected: string;
  predicted: string | null;
  confidence: number | null;
  ms: number;
  ok: boolean;
  isFallback?: boolean;
  isNetworkError?: boolean;
  notes?: string;
  error?: string;
}): RowView {
  return {
    index: input.i,
    question: input.question,
    expected: input.expected,
    predicted: input.predicted,
    confidence: input.confidence,
    responseTime: input.ms,
    isCorrect: input.ok,
    isFallback: input.isFallback,
    isNetworkError: input.isNetworkError,
    notes: input.notes,
    error: input.error,
  };
}

/**
 * Print evaluation results in a formatted table
 */
export function printTable(rows: RowView[]): void {
  const table = new ReportTable({
    head: ['#', 'Question', 'Expected', 'Predicted', 'Conf', 'ms', '✓', 'Notes'],
    colWidths: [3, 35, 15, 15, 8, 8, 8, 12],
  });

  rows.forEach(row => {
    const {
      index,
      question,
      expected,
      predicted,
      confidence,
      responseTime,
      isCorrect,
      isFallback,
      isNetworkError,
      notes,
      error,
    } = row;

    // Truncate question for display
    const truncatedQuestion = question.length > 32 
      ? question.substring(0, 32) + '...' 
      : question;

    // Format confidence
    const confidenceStr = confidence !== null 
      ? confidence.toFixed(3) 
      : 'N/A';

    // Format predicted result
    const predictedStr = predicted || (error ? 'ERROR' : 'NONE');

    // Status indicator
    let status = '';
    if (isNetworkError) {
      status = '🔴';
    } else if (isFallback) {
      status = '🟡';
    } else if (expected === '__NONE__') {
      status = '🔵';
    } else if (isCorrect) {
      status = '✅';
    } else {
      status = '❌';
    }

    // Response time
    const responseTimeStr = responseTime.toString();

    table.push([
      index.toString(),
      truncatedQuestion,
      expected,
      predictedStr,
      confidenceStr,
      responseTimeStr,
      status,
      notes || '',
    ]);
  });

  console.log('\n📊 Evaluation Results:');
  console.log(table.toString());
}

/**
 * Print summary metrics
 */
export function printSummary(metrics: SummaryMetrics): void {
  console.log('\n📈 Summary Metrics:');
  console.log('─'.repeat(50));
  console.log(`Total Questions:      ${metrics.total}`);
  
  if (metrics.questionsWithExpectedAnswers !== undefined) {
    console.log(`Expected Answers:     ${metrics.questionsWithExpectedAnswers}`);
  }
  
  console.log(`Correct Predictions:  ${metrics.correct}`);
  console.log(`Accuracy:             ${(metrics.accuracy * 100).toFixed(1)}%`);
  console.log(`Fallbacks:            ${metrics.fallbacks}`);
  console.log(`Fallback Rate:        ${(metrics.fallbackRate * 100).toFixed(1)}%`);
  console.log(`Avg Response Time:    ${formatMs(metrics.avgResponseTime)}`);
  
  if (metrics.networkErrors !== undefined && metrics.networkErrors > 0) {
    console.log(`Network Errors:       ${metrics.networkErrors}`);
  }
  
  console.log('─'.repeat(50));
}

/**
 * Export failed cases to CSV file
 */
export async function exportFailedCases(rows: RowView[], outputPath?: string): Promise<void> {
  const failedRows = rows.filter(row => 
    !row.isCorrect && row.expected !== '__NONE__' || row.isNetworkError
  );

  if (failedRows.length === 0) {
    console.log('✅ No failed cases to export - all tests passed!');
    return;
  }

  const csvPath = outputPath || path.resolve(process.cwd(), 'backend/eval/fails.csv');
  
  try {
    // Create CSV header
    const headers = [
      'index',
      'question',
      'expected',
      'predicted', 
      'confidence',
      'response_time_ms',
      'is_correct',
      'is_fallback',
      'is_network_error',
      'notes',
      'error'
    ];

    // Create CSV rows
    const csvRows = failedRows.map(row => [
      row.index.toString(),
      `"${row.question.replace(/"/g, '""')}"`, // Escape quotes
      row.expected,
      row.predicted || 'NULL',
      row.confidence?.toString() || 'NULL',
      row.responseTime.toString(),
      row.isCorrect.toString(),
      (row.isFallback || false).toString(),
      (row.isNetworkError || false).toString(),
      `"${(row.notes || '').replace(/"/g, '""')}"`, // Escape quotes
      `"${(row.error || '').replace(/"/g, '""')}"`, // Escape quotes
    ]);

    // Combine header and rows
    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');

    // Ensure directory exists
    await fs.mkdir(path.dirname(csvPath), { recursive: true });
    
    // Write CSV file
    await fs.writeFile(csvPath, csvContent, 'utf-8');
    
    console.log(`\n📁 Exported ${failedRows.length} failed cases to: ${csvPath}`);
  } catch (error) {
    console.error('❌ Failed to export failed cases:');
    console.error(error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Print pass/fail status with color coding
 */
export function printPassFailStatus(
  accuracy: number, 
  threshold: number, 
  networkErrors: number = 0
): void {
  const passed = accuracy >= threshold;
  const hasNetworkIssues = networkErrors > 0;

  console.log('\n🎯 Final Result:');
  console.log('─'.repeat(30));

  if (passed && !hasNetworkIssues) {
    console.log(`✅ PASSED: Accuracy ${(accuracy * 100).toFixed(1)}% >= ${(threshold * 100).toFixed(1)}%`);
  } else if (passed && hasNetworkIssues) {
    console.log(`⚠️  PASSED: Accuracy ${(accuracy * 100).toFixed(1)}% >= ${(threshold * 100).toFixed(1)}%`);
    console.log(`    (Warning: ${networkErrors} network errors occurred)`);
  } else {
    console.log(`❌ FAILED: Accuracy ${(accuracy * 100).toFixed(1)}% < ${(threshold * 100).toFixed(1)}%`);
    if (hasNetworkIssues) {
      console.log(`    (${networkErrors} network errors also occurred)`);
    }
  }
  
  console.log('─'.repeat(30));
}

/**
 * Create detailed failure analysis
 */
export function analyzeFailures(rows: RowView[]): void {
  const failures = rows.filter(row => !row.isCorrect && row.expected !== '__NONE__');
  const networkErrors = rows.filter(row => row.isNetworkError);
  const fallbacks = rows.filter(row => row.isFallback && !row.isNetworkError);

  if (failures.length === 0 && networkErrors.length === 0) {
    return;
  }

  console.log('\n🔍 Failure Analysis:');
  console.log('─'.repeat(40));

  if (failures.length > 0) {
    console.log(`❌ Wrong Predictions: ${failures.length}`);
    
    // Group by predicted vs expected pattern
    const wrongPredictions = failures.filter(f => !f.isNetworkError && f.predicted);
    if (wrongPredictions.length > 0) {
      console.log('   Common mismatches:');
      wrongPredictions.slice(0, 3).forEach(f => {
        console.log(`   • "${f.expected}" → "${f.predicted}" (conf: ${f.confidence?.toFixed(3) || 'N/A'})`);
      });
    }
  }

  if (fallbacks.length > 0) {
    console.log(`🟡 Low Confidence Fallbacks: ${fallbacks.length}`);
    
    const avgFallbackConfidence = fallbacks
      .filter(f => f.confidence !== null)
      .reduce((sum, f, _, arr) => sum + (f.confidence! / arr.length), 0);
    
    if (avgFallbackConfidence > 0) {
      console.log(`   Average confidence: ${avgFallbackConfidence.toFixed(3)}`);
    }
  }

  if (networkErrors.length > 0) {
    console.log(`🔴 Network Errors: ${networkErrors.length}`);
    const errorTypes = networkErrors.reduce((acc, f) => {
      const error = f.error || 'Unknown';
      acc[error] = (acc[error] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(errorTypes).forEach(([error, count]) => {
      console.log(`   • ${error}: ${count}`);
    });
  }

  console.log('─'.repeat(40));
}
