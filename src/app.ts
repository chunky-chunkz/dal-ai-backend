/**
 * Task: Wire local + Microsoft auth side-by-side.
 * - Register cookie plugin with secret SESSION_SECRET.
 * - CORS: origin FRONTEND_ORIGIN, credentials:true.
 * - Register routes: local.routes, auth.routes (ms), user.routes.
 * - GET /health -> {status:"ok"}.
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

export async function buildApp(): Promise<FastifyInstance> {
  // Create Fastify instance with logging
  const loggerConfig = {
    level: process.env.LOG_LEVEL || 'info',
    ...(process.env.NODE_ENV === 'development' && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      }
    })
  };

  const fastify = Fastify({
    logger: loggerConfig
  });

  // Register Helmet plugin for security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"]
      }
    }
  });

  // Register CORS plugin with SSE-friendly settings and OAuth cookie support
  await fastify.register(cors, {
    origin: process.env.FRONTEND_ORIGIN || process.env.CORS_ORIGIN || "http://localhost:3000" || "https://dal-ai.sunrise-avengers.com",
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Accept', 'x-session-id']
  });

  // Register cookie plugin for session management
  await fastify.register(cookie, {
    secret: process.env.SESSION_SECRET || 'change_me_to_a_secure_random_stri13258ng',
    hook: 'onRequest', // Parse cookies on every request
    parseOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  });

  // SSE-friendly settings: disable compression for streaming routes
  fastify.addHook('onRequest', async (request, reply) => {
    // Disable compression for SSE routes to prevent content-transform issues
    if (request.url.includes('/stream') || request.headers['accept'] === 'text/event-stream') {
      reply.header('Cache-Control', 'no-cache, no-transform');
    }
  });

  // Fehler-Handler (JSON, keine Stacktraces in production)
  fastify.setErrorHandler(async (error, request, reply) => {
    request.log.error(error);
    
    // Validation errors
    if (error.validation) {
      reply.status(400).send({
        error: 'Validation Error',
        message: error.message,
        statusCode: 400,
        ...(process.env.NODE_ENV === 'development' && { 
          details: error.validation 
        })
      });
      return;
    }

    // Rate limit errors
    if (error.statusCode === 429) {
      reply.status(429).send({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        statusCode: 429
      });
      return;
    }

    // General server errors - keine Stacktraces in production
    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      error: statusCode >= 500 ? 'Internal Server Error' : error.name || 'Error',
      message: statusCode >= 500 ? 'Something went wrong' : error.message,
      statusCode,
      ...(process.env.NODE_ENV === 'development' && { 
        stack: error.stack 
      })
    });
  });

  // 404 Not Found Handler
  fastify.setNotFoundHandler(async (request, reply) => {
    reply.status(404).send({
      error: 'Not Found',
      message: `Route ${request.method}:${request.url} not found`,
      statusCode: 404
    });
  });

  // Register routes: /health, /auth/*, /api/*
  await fastify.register(healthRoutes);  // GET /health for quick checks
  
  // Register local authentication routes with /api/auth prefix
  await fastify.register(registerLocalAuthRoutes, { prefix: '/api/auth' });
  
  // Register Microsoft OAuth routes with /auth prefix  
  await fastify.register(authRoutes, { prefix: '/auth' });
  
  // Register protected user routes with /api prefix  
  await fastify.register(registerUserRoutes, { prefix: '/api' });
  
  // Register other API routes
  await fastify.register(feedbackRoutes);
  await fastify.register(faqRoutes);
  
  // Register answer routes with /api prefix (includes SSE streaming)
  await fastify.register(answerRoutes, { prefix: '/api' });
  
  // Register profile routes with /api prefix (protected endpoints)
  await fastify.register(profileRoutes, { prefix: '/api' });
  
  // Register memory routes with /api prefix (protected endpoints)
  await fastify.register(memoryRoutes, { prefix: '/api' });
  
  // Register document routes with /api prefix
  await fastify.register(documentRoutes, { prefix: '/api' });
  
  // Register memory statistics routes
  await fastify.register(memoryStatsRoutes);
  
  // Register document statistics routes
  await fastify.register(documentStatsRoutes);
  
  // Register memory maintenance routes
  await fastify.register(memoryMaintenanceRoutes, { prefix: '/api' });

  // Health route is already registered via healthRoutes above
  // Removed duplicate: fastify.get('/health', ...)

  return fastify;
}
