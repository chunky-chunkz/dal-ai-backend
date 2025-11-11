// src/@types/fastify-schema-augment.d.ts
import '@fastify/swagger'; // optional, falls du swagger nutzt

declare module 'fastify' {
  interface FastifySchema {
    description?: string;
    summary?: string;
    tags?: string[];
    operationId?: string;
    security?: unknown[];
    // falls du weitere Felder nutzt:
    // deprecated?: boolean;
    // externalDocs?: { url: string; description?: string };
  }
}
