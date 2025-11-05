/**
 * Document Statistics Aggregator
 * 
 * Computes KPIs from document events NDJSON log
 */

import fs from "fs";
import path from "path";
import readline from "readline";
import type { DocumentKPIs, DocumentEvent } from "./types.js";

const LOG_FILE = path.resolve("data/metrics/document_events.ndjson");

export async function computeDocumentKPIs({ from, to }: { from?: number; to?: number }): Promise<DocumentKPIs> {
  const inRange = (ts: number) => (!from || ts >= from) && (!to || ts <= to);
  
  // Counters
  let searches = 0;
  let retrievals = 0;
  let clicks = 0;
  let feedback = 0;
  let helpful = 0;
  let indexed = 0;
  let updated = 0;
  let deleted = 0;
  let errors = 0;
  
  // Aggregates
  let sumSearchLatency = 0;
  let sumResults = 0;
  let sumRelevance = 0;
  let sumClickPosition = 0;
  
  const searchLatencies: number[] = [];
  const queryCount = new Map<string, { count: number; latencySum: number }>();
  const docStats = new Map<string, { 
    title: string; 
    clicks: number; 
    relevanceSum: number; 
    relevanceCount: number 
  }>();
  const categoryCount = new Map<string, number>();
  const sourceCount = { search: 0, related: 0, direct: 0 };

  try {
    // Check if file exists
    if (!fs.existsSync(LOG_FILE)) {
      return getEmptyKPIs();
    }

    const rl = readline.createInterface({ 
      input: fs.createReadStream(LOG_FILE, { encoding: "utf8" }),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (!line.trim()) continue;
      
      try {
        const e = JSON.parse(line) as DocumentEvent;
        if (!inRange(e.ts)) continue;

        switch (e.type) {
          case "search":
            searches++;
            sumSearchLatency += e.latencyMs;
            sumResults += e.resultsCount;
            searchLatencies.push(e.latencyMs);
            
            const existing = queryCount.get(e.query) || { count: 0, latencySum: 0 };
            queryCount.set(e.query, {
              count: existing.count + 1,
              latencySum: existing.latencySum + e.latencyMs
            });
            break;
          
          case "retrieve":
            retrievals++;
            sumRelevance += e.relevanceScore;
            sourceCount[e.source]++;
            
            const doc = docStats.get(e.docId) || { 
              title: e.docTitle, 
              clicks: 0, 
              relevanceSum: 0, 
              relevanceCount: 0 
            };
            doc.relevanceSum += e.relevanceScore;
            doc.relevanceCount++;
            docStats.set(e.docId, doc);
            break;
          
          case "click":
            clicks++;
            sumClickPosition += e.position;
            
            const clickDoc = docStats.get(e.docId) || { 
              title: "Unknown", 
              clicks: 0, 
              relevanceSum: 0, 
              relevanceCount: 0 
            };
            clickDoc.clicks++;
            docStats.set(e.docId, clickDoc);
            break;
          
          case "feedback":
            feedback++;
            if (e.helpful) helpful++;
            break;
          
          case "index":
            indexed++;
            if (e.category) {
              categoryCount.set(e.category, (categoryCount.get(e.category) || 0) + 1);
            }
            break;
          
          case "update":
            updated++;
            break;
          
          case "delete":
            deleted++;
            break;
          
          case "error":
            errors++;
            break;
        }
      } catch (parseError) {
        console.error("Failed to parse document event line:", line, parseError);
      }
    }
  } catch (error) {
    console.error("Error reading document events:", error);
    return getEmptyKPIs();
  }

  // Calculate percentiles
  searchLatencies.sort((a, b) => a - b);
  const percentile = (q: number) => 
    searchLatencies.length ? searchLatencies[Math.floor((searchLatencies.length - 1) * q)] : 0;

  // Get top queries
  const topQueries = [...queryCount.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([query, data]) => ({ 
      query, 
      count: data.count,
      avgLatency: data.count > 0 ? data.latencySum / data.count : 0
    }));

  // Get top documents
  const topDocuments = [...docStats.entries()]
    .sort((a, b) => b[1].clicks - a[1].clicks)
    .slice(0, 10)
    .map(([docId, data]) => ({ 
      docId, 
      title: data.title,
      clicks: data.clicks,
      avgRelevance: data.relevanceCount > 0 ? data.relevanceSum / data.relevanceCount : 0
    }));

  // Get top categories
  const topCategories = [...categoryCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([category, count]) => ({ category, count }));

  return {
    totalSearches: searches,
    avgSearchLatency: searches > 0 ? sumSearchLatency / searches : 0,
    latencyP50: percentile(0.5),
    latencyP95: percentile(0.95),
    avgResultsPerSearch: searches > 0 ? sumResults / searches : 0,
    
    totalRetrievals: retrievals,
    avgRelevanceScore: retrievals > 0 ? sumRelevance / retrievals : 0,
    retrievalsBySource: sourceCount,
    
    totalClicks: clicks,
    clickThroughRate: searches > 0 ? clicks / searches : 0,
    avgClickPosition: clicks > 0 ? sumClickPosition / clicks : 0,
    
    totalFeedback: feedback,
    helpfulRate: feedback > 0 ? helpful / feedback : 0,
    
    topQueries,
    topDocuments,
    
    totalDocuments: indexed - deleted,
    documentsIndexed: indexed,
    documentsUpdated: updated,
    documentsDeleted: deleted,
    
    topCategories,
    
    errors
  };
}

function getEmptyKPIs(): DocumentKPIs {
  return {
    totalSearches: 0,
    avgSearchLatency: 0,
    latencyP50: 0,
    latencyP95: 0,
    avgResultsPerSearch: 0,
    totalRetrievals: 0,
    avgRelevanceScore: 0,
    retrievalsBySource: { search: 0, related: 0, direct: 0 },
    totalClicks: 0,
    clickThroughRate: 0,
    avgClickPosition: 0,
    totalFeedback: 0,
    helpfulRate: 0,
    topQueries: [],
    topDocuments: [],
    totalDocuments: 0,
    documentsIndexed: 0,
    documentsUpdated: 0,
    documentsDeleted: 0,
    topCategories: [],
    errors: 0
  };
}
