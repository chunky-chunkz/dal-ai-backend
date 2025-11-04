/**
 * Memory Statistics API Route
 * 
 * Task: Fastify GET /api/stats/memory?from=&to=
 * - Parse timestamps, call computeKPIs, return JSON
 * - Add basic input validation and 200ms timeout guard
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { computeKPIs } from "../memory/metrics/aggregate.js";

interface StatsQuery {
  from?: string;
  to?: string;
}

export default async function memoryStatsRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: StatsQuery
  }>("/api/stats/memory", async (request: FastifyRequest<{ Querystring: StatsQuery }>, reply: FastifyReply) => {
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
      
      // Set timeout guard (200ms recommended)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Stats computation timeout")), 200)
      );
      
      const kpisPromise = computeKPIs({ from: fromTs, to: toTs });
      
      const result = await Promise.race([kpisPromise, timeoutPromise]);
      
      return reply.send(result);
    } catch (error) {
      console.error("Error computing memory stats:", error);
      return reply.status(500).send({ 
        error: error instanceof Error ? error.message : "Failed to compute statistics" 
      });
    }
  });
}
