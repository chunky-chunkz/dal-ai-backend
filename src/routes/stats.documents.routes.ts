/**
 * Document Statistics API Route
 * 
 * GET /api/stats/documents?from=&to=
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { computeDocumentKPIs } from "../documents/metrics/aggregate.js";

interface StatsQuery {
  from?: string;
  to?: string;
}

export default async function documentStatsRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: StatsQuery
  }>("/api/stats/documents", async (request: FastifyRequest<{ Querystring: StatsQuery }>, reply: FastifyReply) => {
    try {
      const { from, to } = request.query;
      
      // Parse timestamps
      const fromTs = from ? Number(from) : undefined;
      const toTs = to ? Number(to) : undefined;
      
      // Validate
      if (from && isNaN(fromTs!)) {
        return reply.status(400).send({ error: "Invalid 'from' timestamp" });
      }
      if (to && isNaN(toTs!)) {
        return reply.status(400).send({ error: "Invalid 'to' timestamp" });
      }
      
      // Set timeout guard (500ms for documents as they might be larger)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Stats computation timeout")), 500)
      );
      
      const kpisPromise = computeDocumentKPIs({ from: fromTs, to: toTs });
      
      const result = await Promise.race([kpisPromise, timeoutPromise]);
      
      return reply.send(result);
    } catch (error) {
      console.error("Error computing document stats:", error);
      return reply.status(500).send({ 
        error: error instanceof Error ? error.message : "Failed to compute statistics" 
      });
    }
  });
}
