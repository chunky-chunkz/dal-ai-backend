/**
 * Aufgabe: Starte einen Fastify-Server (TypeScript).
 * Anforderungen:
 * - Lies PORT aus .env (Default 8080), host "0.0.0.0"
 * - App-Konfiguration via buildApp() aus app.ts
 * - pino-Logger nutzen
 * - Sauberes Shutdown-Handling (SIGINT/SIGTERM)
 */
import 'dotenv/config';
import { buildApp } from './app.js';
import pino from 'pino';

import { startMemoryCleanupJob } from './jobs/memory-cleanup.js';

const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// pino-Logger konfigurieren
const logger = pino({
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
});

async function startServer() {
  let app;
  
  try {
    // App-Konfiguration via buildApp()
    app = await buildApp();

    // Server starten
    await app.listen({ 
      port: PORT, 
      host: HOST 
    });

    logger.info(`🚀 Server is running on http://${HOST}:${PORT} - New config`);
    logger.info(`📋 Health check: http://${HOST}:${PORT}/health`);
    logger.info(`💬 Chat API: http://${HOST}:${PORT}/api/answer`);

    // Start background jobs
    startMemoryCleanupJob();

  } catch (error) {
    logger.error('Error starting server:');
    console.error(error); // Also log to console for visibility
    if (error instanceof Error) {
      logger.error({
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    process.exit(1);
  }

  return app;
}

// Sauberes Shutdown-Handling
async function gracefulShutdown(signal: string, app?: any) {
  logger.info(`\n🛑 Received ${signal}, shutting down gracefully...`);
  
  if (app) {
    try {
      await app.close();
      logger.info('✅ Server closed successfully');
    } catch (error) {
      logger.error('Error during server shutdown:', error);
      process.exit(1);
    }
  }
  
  process.exit(0);
}

// Signal Handler registrieren
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Unhandled Promise Rejections abfangen
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Server starten
startServer().then(app => {
  // App-Instanz für Shutdown verfügbar machen
  process.on('SIGINT', () => gracefulShutdown('SIGINT', app));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM', app));
}).catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
