/**
 * Document Statistics Types
 */

export type DocumentEvent =
  | { type: "search"; userId?: string; query: string; queryHash: string; resultsCount: number; latencyMs: number; ts: number }
  | { type: "retrieve"; userId?: string; docId: string; docTitle: string; relevanceScore: number; source: "search" | "related" | "direct"; ts: number }
  | { type: "click"; userId?: string; docId: string; position: number; query?: string; ts: number }
  | { type: "feedback"; userId?: string; docId: string; query: string; helpful: boolean; ts: number }
  | { type: "index"; docId: string; title: string; category?: string; wordCount: number; ts: number }
  | { type: "update"; docId: string; changeType: "content" | "metadata" | "reindex"; ts: number }
  | { type: "delete"; docId: string; reason?: string; ts: number }
  | { type: "error"; where: string; message: string; userId?: string; ts: number };

export type DocumentKPIs = {
  // Search Metrics
  totalSearches: number;
  avgSearchLatency: number;
  latencyP50: number;
  latencyP95: number;
  avgResultsPerSearch: number;
  
  // Retrieval Metrics
  totalRetrievals: number;
  avgRelevanceScore: number;
  retrievalsBySource: {
    search: number;
    related: number;
    direct: number;
  };
  
  // Engagement Metrics
  totalClicks: number;
  clickThroughRate: number;
  avgClickPosition: number;
  
  // Feedback Metrics
  totalFeedback: number;
  helpfulRate: number;
  
  // Top Queries & Documents
  topQueries: { query: string; count: number; avgLatency: number }[];
  topDocuments: { docId: string; title: string; clicks: number; avgRelevance: number }[];
  
  // Index Metrics
  totalDocuments: number;
  documentsIndexed: number;
  documentsUpdated: number;
  documentsDeleted: number;
  
  // Categories
  topCategories: { category: string; count: number }[];
  
  // Errors
  errors: number;
};
