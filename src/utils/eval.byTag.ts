/**
 * Aufgabe: Per-Tag Metriken, falls wir product_tags zuordnen können:
 * - Mappe predicted.sourceId bzw. expected answer_id -> FAQ -> product_tags[]
 * - Aggregiere Accuracy/Fallback pro Tag.
 * - printTagSummary(table)
 */

import { FaqRepository } from '../repos/faq.repository.js';
import type { RowView } from './eval.report.js';

// Per-tag metrics interface
export interface TagMetrics {
  tag: string;
  total: number;
  correct: number;
  accuracy: number;
  fallbacks: number;
  fallbackRate: number;
  avgConfidence: number;
  avgResponseTime: number;
}

// Tag mapping result
export interface TagMapping {
  questionIndex: number;
  expectedTags: string[];
  predictedTags: string[];
  isCorrect: boolean;
  isFallback: boolean;
}

/**
 * Map answer IDs to FAQ product tags
 */
export async function mapAnswerIdToTags(
  answerId: string,
  faqRepo: FaqRepository
): Promise<string[]> {
  if (answerId === '__NONE__' || !answerId) {
    return [];
  }

  const faq = await faqRepo.getById(answerId);
  return faq?.product_tags || [];
}

/**
 * Create tag mappings for all evaluation rows
 */
export async function createTagMappings(
  rows: RowView[],
  faqRepo: FaqRepository
): Promise<TagMapping[]> {
  const mappings: TagMapping[] = [];

  for (const row of rows) {
    // Get expected tags
    const expectedTags = await mapAnswerIdToTags(row.expected, faqRepo);
    
    // Get predicted tags
    const predictedTags = await mapAnswerIdToTags(row.predicted || '', faqRepo);

    mappings.push({
      questionIndex: row.index,
      expectedTags,
      predictedTags,
      isCorrect: row.isCorrect,
      isFallback: row.isFallback || false,
    });
  }

  return mappings;
}

/**
 * Calculate per-tag metrics from evaluation rows and tag mappings
 */
export function calculateTagMetrics(
  rows: RowView[],
  mappings: TagMapping[]
): TagMetrics[] {
  // Collect all unique tags
  const allTags = new Set<string>();
  mappings.forEach(mapping => {
    mapping.expectedTags.forEach(tag => allTags.add(tag));
    mapping.predictedTags.forEach(tag => allTags.add(tag));
  });

  const tagMetrics: TagMetrics[] = [];

  // Calculate metrics for each tag
  allTags.forEach(tag => {
    // Find rows where this tag was expected
    const relevantMappings = mappings.filter(mapping =>
      mapping.expectedTags.includes(tag)
    );

    if (relevantMappings.length === 0) {
      return; // Skip tags with no expected occurrences
    }

    // Get corresponding rows
    const relevantRows = relevantMappings.map(mapping =>
      rows.find(row => row.index === mapping.questionIndex)!
    );

    // Calculate metrics
    const total = relevantMappings.length;
    const correct = relevantMappings.filter(mapping => mapping.isCorrect).length;
    const accuracy = total > 0 ? correct / total : 0;
    
    const fallbacks = relevantMappings.filter(mapping => mapping.isFallback).length;
    const fallbackRate = total > 0 ? fallbacks / total : 0;

    // Calculate average confidence (only for non-null values)
    const confidenceValues = relevantRows
      .map(row => row.confidence)
      .filter(conf => conf !== null) as number[];
    const avgConfidence = confidenceValues.length > 0
      ? confidenceValues.reduce((sum, conf) => sum + conf, 0) / confidenceValues.length
      : 0;

    // Calculate average response time
    const avgResponseTime = relevantRows.length > 0
      ? relevantRows.reduce((sum, row) => sum + row.responseTime, 0) / relevantRows.length
      : 0;

    tagMetrics.push({
      tag,
      total,
      correct,
      accuracy,
      fallbacks,
      fallbackRate,
      avgConfidence,
      avgResponseTime,
    });
  });

  // Sort by accuracy (descending) then by total count (descending)
  return tagMetrics.sort((a, b) => {
    if (Math.abs(b.accuracy - a.accuracy) > 0.01) {
      return b.accuracy - a.accuracy;
    }
    return b.total - a.total;
  });
}

/**
 * Print tag-based metrics summary
 */
export function printTagSummary(tagMetrics: TagMetrics[]): void {
  if (tagMetrics.length === 0) {
    console.log('\n📊 No tag metrics available (no FAQs found or no product tags)');
    return;
  }

  console.log('\n📊 Per-Tag Performance:');
  console.log('─'.repeat(80));

  // Create simple table for tag metrics
  const headers = ['Tag', 'Total', 'Correct', 'Accuracy', 'Fallbacks', 'FB Rate', 'Avg Conf', 'Avg ms'];
  const colWidths = [15, 6, 7, 8, 9, 8, 8, 7];

  // Header
  const headerLine = headers.map((header, i) => 
    header.padEnd(colWidths[i]).substring(0, colWidths[i])
  ).join(' | ');
  console.log(headerLine);
  console.log('─'.repeat(headerLine.length));

  // Rows
  tagMetrics.forEach(metrics => {
    const row = [
      metrics.tag.padEnd(colWidths[0]).substring(0, colWidths[0]),
      metrics.total.toString().padEnd(colWidths[1]).substring(0, colWidths[1]),
      metrics.correct.toString().padEnd(colWidths[2]).substring(0, colWidths[2]),
      `${(metrics.accuracy * 100).toFixed(1)}%`.padEnd(colWidths[3]).substring(0, colWidths[3]),
      metrics.fallbacks.toString().padEnd(colWidths[4]).substring(0, colWidths[4]),
      `${(metrics.fallbackRate * 100).toFixed(1)}%`.padEnd(colWidths[5]).substring(0, colWidths[5]),
      metrics.avgConfidence.toFixed(3).padEnd(colWidths[6]).substring(0, colWidths[6]),
      Math.round(metrics.avgResponseTime).toString().padEnd(colWidths[7]).substring(0, colWidths[7]),
    ].join(' | ');

    console.log(row);
  });

  console.log('─'.repeat(80));

  // Summary insights
  const bestTag = tagMetrics[0];
  const worstTag = tagMetrics[tagMetrics.length - 1];
  
  console.log('\n🎯 Tag Insights:');
  if (bestTag && worstTag && bestTag !== worstTag) {
    console.log(`  🥇 Best performing:  ${bestTag.tag} (${(bestTag.accuracy * 100).toFixed(1)}% accuracy)`);
    console.log(`  🥉 Needs attention:  ${worstTag.tag} (${(worstTag.accuracy * 100).toFixed(1)}% accuracy)`);
  }

  // Highlight high fallback rates
  const highFallbackTags = tagMetrics.filter(tm => tm.fallbackRate > 0.3);
  if (highFallbackTags.length > 0) {
    console.log(`  ⚠️  High fallback rate: ${highFallbackTags.map(tm => tm.tag).join(', ')}`);
  }

  // Show tags with low confidence
  const lowConfidenceTags = tagMetrics.filter(tm => tm.avgConfidence < 0.6);
  if (lowConfidenceTags.length > 0) {
    console.log(`  🔍 Low confidence:    ${lowConfidenceTags.map(tm => tm.tag).join(', ')}`);
  }
}

/**
 * Export tag metrics to CSV
 */
export async function exportTagMetrics(
  tagMetrics: TagMetrics[],
  outputPath: string = 'backend/eval/tag_metrics.csv'
): Promise<void> {
  if (tagMetrics.length === 0) {
    console.log('📊 No tag metrics to export');
    return;
  }

  try {
    const headers = [
      'tag',
      'total',
      'correct',
      'accuracy',
      'fallbacks',
      'fallback_rate',
      'avg_confidence',
      'avg_response_time_ms'
    ];

    const csvRows = tagMetrics.map(metrics => [
      metrics.tag,
      metrics.total.toString(),
      metrics.correct.toString(),
      metrics.accuracy.toFixed(4),
      metrics.fallbacks.toString(),
      metrics.fallbackRate.toFixed(4),
      metrics.avgConfidence.toFixed(4),
      Math.round(metrics.avgResponseTime).toString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');

    // Ensure directory exists and write file
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const fullPath = path.resolve(process.cwd(), outputPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, csvContent, 'utf-8');

    console.log(`\n📁 Exported tag metrics to: ${fullPath}`);
  } catch (error) {
    console.error('❌ Failed to export tag metrics:');
    console.error(error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Analyze tag confusion matrix (which tags are commonly confused)
 */
export function analyzeTagConfusion(mappings: TagMapping[]): void {
  const confusionMap = new Map<string, Map<string, number>>();

  mappings
    .filter(mapping => !mapping.isCorrect && mapping.expectedTags.length > 0)
    .forEach(mapping => {
      mapping.expectedTags.forEach(expectedTag => {
        if (!confusionMap.has(expectedTag)) {
          confusionMap.set(expectedTag, new Map());
        }

        const predictedMap = confusionMap.get(expectedTag)!;

        if (mapping.predictedTags.length === 0) {
          // No prediction made
          const noPredict = predictedMap.get('__NO_PREDICTION__') || 0;
          predictedMap.set('__NO_PREDICTION__', noPredict + 1);
        } else {
          mapping.predictedTags.forEach(predictedTag => {
            const count = predictedMap.get(predictedTag) || 0;
            predictedMap.set(predictedTag, count + 1);
          });
        }
      });
    });

  if (confusionMap.size === 0) {
    return; // No confusions to report
  }

  console.log('\n🔀 Tag Confusion Analysis:');
  console.log('─'.repeat(40));

  confusionMap.forEach((predictedMap, expectedTag) => {
    const totalConfusions = Array.from(predictedMap.values()).reduce((sum, count) => sum + count, 0);
    console.log(`\n🏷️  ${expectedTag} (${totalConfusions} misclassifications):`);

    // Sort by frequency and show top confusions
    const sortedPredictions = Array.from(predictedMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3); // Show top 3 confusions

    sortedPredictions.forEach(([predictedTag, count]) => {
      const displayTag = predictedTag === '__NO_PREDICTION__' ? '(no prediction)' : predictedTag;
      console.log(`   → ${displayTag}: ${count}x`);
    });
  });

  console.log('─'.repeat(40));
}
