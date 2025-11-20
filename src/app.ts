/**
 * Task: Wire local + Microsoft auth side-by-side.
 * - Cookie plugin with secret
 * - CORS (credentials)
 * - Register routes (local + MS)
 * - GET /health via healthRoutes
 */
import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';

import { healthRoutes } from './routes/health.routes.js';
import { feedbackRoutes } from './routes/feedback.routes.js';
import { faqRoutes } from './routes/faq.routes.js';
import { answerRoutes } from './routes/answer.routes.js';
import { authRoutes } from './auth/auth.routes.js';
import { registerLocalAuthRoutes } from './auth/local.routes.js';
import { registerUserRoutes } from './routes/user.routes.js';
import { profileRoutes } from './routes/profile.routes.js';
import { memoryRoutes } from './routes/memory.routes.js';
import { documentRoutes } from './routes/document.routes.js';
import memoryStatsRoutes from './routes/stats.memory.routes.js';
import documentStatsRoutes from './routes/stats.documents.routes.js';
import memoryMaintenanceRoutes from './routes/memory-maintenance.routes.js';

import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';

export async function buildApp(): Promise<FastifyInstance> {
  // Logger
  const loggerConfig =
    process.env.NODE_ENV === 'development'
      ? {
          level: process.env.LOG_LEVEL || 'info',
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' }
          }
        }
      : { level: process.env.LOG_LEVEL || 'info' };

  const app = Fastify({ logger: loggerConfig });

  // Helmet
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:']
      }
    }
  });

  // CORS – zum Debuggen erstmal alles erlauben + Cookies
  await app.register(cors, {
    origin: true, // spiegelt einfach das Origin zurück (egal welche URL)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cache-Control',
      'Accept',
      'x-session-id',
    ],
  });

  console.log('🌐 CORS enabled in debug mode (origin: true)');

  // Cookies - secure: true + sameSite: 'none' for cross-origin requests
  await app.register(cookie, {
    secret: process.env.SESSION_SECRET || 'PLEASE_CHANGE_ME__32+_random_chars',
    hook: 'onRequest',
    parseOptions: {
      httpOnly: true,
      secure: true,                   // always true on Render
      sameSite: 'none',               // required for CORS cookies
      maxAge: 24 * 60 * 60 * 1000     // 24h
    }
  });

  // Swagger + UI (jetzt korrekt nach Instanz-Erstellung)
  await app.register(fastifySwagger, {
    openapi: { openapi: '3.0.0', info: { title: 'DAL-AI', version: '1.0.0' } }
  });
  await app.register(fastifySwaggerUI, {
    routePrefix: '/docs',
    staticCSP: true
  });

  // SSE: keine Kompression/Transformation
  app.addHook('onRequest', async (request, reply) => {
    if (request.url.includes('/stream') || request.headers['accept'] === 'text/event-stream') {
      reply.header('Cache-Control', 'no-cache, no-transform');
    }
  });

  // Error Handler
  app.setErrorHandler(async (error, request, reply) => {
    request.log.error(error);
    if ((error as any).validation) {
      reply.status(400).send({
        error: 'Validation Error',
        message: error.message,
        statusCode: 400,
        ...(process.env.NODE_ENV === 'development' && { details: (error as any).validation })
      });
      return;
    }
    const statusCode = (error as any).statusCode || 500;
    reply.status(statusCode).send({
      error: statusCode >= 500 ? 'Internal Server Error' : (error.name || 'Error'),
      message: statusCode >= 500 ? 'Something went wrong' : error.message,
      statusCode,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  });

  // 404
  app.setNotFoundHandler(async (request, reply) => {
    reply.status(404).send({
      error: 'Not Found',
      message: `Route ${request.method}:${request.url} not found`,
      statusCode: 404
    });
  });

  // Routes
  await app.register(healthRoutes); // /health
  await app.register(registerLocalAuthRoutes, { prefix: '/api/auth' }); // local auth (unter /api/auth/*)
  await app.register(registerLocalAuthRoutes, { prefix: '/auth' });     // local auth (auch unter /auth/*)
  await app.register(authRoutes, { prefix: '/auth' });                  // MS OAuth
  await app.register(registerUserRoutes, { prefix: '/api' });           // protected /api/*
  await app.register(feedbackRoutes);
  await app.register(faqRoutes);
  await app.register(answerRoutes, { prefix: '/api' });                 // includes SSE
  await app.register(profileRoutes, { prefix: '/api' });
  await app.register(memoryRoutes, { prefix: '/api' });
  await app.register(documentRoutes, { prefix: '/api' });
  await app.register(memoryStatsRoutes);
  await app.register(documentStatsRoutes);
  await app.register(memoryMaintenanceRoutes, { prefix: '/api' });

  return app;
}
