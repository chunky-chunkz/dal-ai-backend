/**
 * Memory Event Types for Statistics & Debugging
 * 
 * All memory operations emit events that are logged for analysis
 */

export type MemoryEvent =
  | { type: "save"; userId: string; key: string; kind: "auto" | "user"; score: number; risk: "low" | "medium" | "high"; ts: number }
  | { type: "ask"; userId: string; key: string; score: number; ts: number }
  | { type: "reject"; userId: string; key: string; reason: "pii" | "low_score" | "policy"; score?: number; ts: number }
  | { type: "retrieve"; userId: string; queryHash: string; returned: number; latencyMs: number; ts: number }
  | { type: "expire"; userId: string; key: string; ts: number }
  | { type: "error"; userId?: string; where: string; message: string; ts: number }
  | { type: "consolidate"; userId: string; action: "merge" | "update" | "conflict"; originalIds: string[]; ts: number }
  | { type: "summarize"; userId: string; clusterSize: number; archived: number; ts: number };

export type MemoryKPIs = {
  totalSaved: number;
  autoSaveRate: number;
  askRate: number;
  rejectRate: number;
  avgScoreSaved: number;
  avgScoreRejected: number;
  retrievals: number;
  avgRelevantCount: number;
  latencyP50: number;
  latencyP95: number;
  topKeys: { key: string; count: number }[];
  errors: number;
  consolidations: number;
  summariesCreated: number;
  memoriesArchived: number;
};
