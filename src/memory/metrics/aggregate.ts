/**
 * Memory Metrics Aggregator
 * 
 * Task: Implement computeKPIs({from,to}) that scans NDJSON and returns:
 * totalSaved, autoSaveRate, askRate, rejectRate,
 * avgScoreSaved, avgScoreRejected,
 * retrievals, avgRelevantCount, latencyP50, latencyP95, topKeys[], errors.
 * Optimize for streaming (readline).
 */

import fs from "fs";
import path from "path";
import readline from "readline";
import type { MemoryKPIs } from "./types.js";

const LOG_FILE = path.resolve("data/metrics/memory_events.ndjson");

export async function computeKPIs({ from, to }: { from?: number; to?: number }): Promise<MemoryKPIs> {
  const inRange = (ts: number) => (!from || ts >= from) && (!to || ts <= to);
  
  let saved = 0, auto = 0, ask = 0, reject = 0, err = 0;
  let sumSaveScore = 0, rejCnt = 0, sumRejScore = 0;
  let retr = 0, sumReturned = 0;
  const latencies: number[] = [];
  const keyCount = new Map<string, number>();
  let consolidations = 0, summariesCreated = 0, memoriesArchived = 0;

  try {
    const rl = readline.createInterface({ 
      input: fs.createReadStream(LOG_FILE, { encoding: "utf8" }),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (!line.trim()) continue;
      
      try {
        const e = JSON.parse(line);
        if (!inRange(e.ts)) continue;

        switch (e.type) {
          case "save":
            saved++;
            if (e.kind === "auto") auto++;
            sumSaveScore += e.score ?? 0;
            keyCount.set(e.key, (keyCount.get(e.key) || 0) + 1);
            break;
          
          case "ask":
            ask++;
            break;
          
          case "reject":
            reject++;
            if (e.score != null) {
              rejCnt++;
              sumRejScore += e.score;
            }
            keyCount.set(e.key, (keyCount.get(e.key) || 0) + 1);
            break;
          
          case "retrieve":
            retr++;
            sumReturned += e.returned || 0;
            if (typeof e.latencyMs === "number") {
              latencies.push(e.latencyMs);
            }
            break;
          
          case "consolidate":
            consolidations++;
            break;
          
          case "summarize":
            summariesCreated++;
            memoriesArchived += e.archived || 0;
            break;
          
          case "error":
            err++;
            break;
        }
      } catch (parseError) {
        // Skip malformed lines
        console.warn("Failed to parse log line:", parseError);
      }
    }
  } catch (error) {
    // If file doesn't exist yet, return empty stats
    if ((error as any).code === "ENOENT") {
      return getEmptyKPIs();
    }
    throw error;
  }

  // Calculate percentiles
  latencies.sort((a, b) => a - b);
  const percentile = (q: number) => 
    latencies.length ? latencies[Math.floor((latencies.length - 1) * q)] : 0;

  // Get top keys
  const topKeys = [...keyCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([key, count]) => ({ key, count }));

  const total = saved + ask + reject || 1;

  return {
    totalSaved: saved,
    autoSaveRate: saved ? auto / saved : 0,
    askRate: ask / total,
    rejectRate: reject / total,
    avgScoreSaved: saved ? sumSaveScore / saved : 0,
    avgScoreRejected: rejCnt ? sumRejScore / rejCnt : 0,
    retrievals: retr,
    avgRelevantCount: retr ? sumReturned / retr : 0,
    latencyP50: percentile(0.5),
    latencyP95: percentile(0.95),
    topKeys,
    errors: err,
    consolidations,
    summariesCreated,
    memoriesArchived
  };
}

function getEmptyKPIs(): MemoryKPIs {
  return {
    totalSaved: 0,
    autoSaveRate: 0,
    askRate: 0,
    rejectRate: 0,
    avgScoreSaved: 0,
    avgScoreRejected: 0,
    retrievals: 0,
    avgRelevantCount: 0,
    latencyP50: 0,
    latencyP95: 0,
    topKeys: [],
    errors: 0,
    consolidations: 0,
    summariesCreated: 0,
    memoriesArchived: 0
  };
}
