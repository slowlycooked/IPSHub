import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import staticPlugin from '@fastify/static';
import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from '@/utils/logger';
import { initDatabase, closeDatabase } from '@/db/client';
import { initializeDatabase } from '@/db/init';
import { registerAuthRoutes } from '@/modules/auth/routes';
import { registerProviderRoutes } from '@/modules/providers/routes';
import { registerNodesRoutes } from '@/modules/nodes/routes';
import { registerProfilesRoutes } from '@/modules/profiles/routes';
import { registerDashboardRoutes } from '@/modules/dashboard/routes';
import { registerLogsRoutes } from '@/modules/logs/routes';
import { registerSubscriptionRoutes } from '@/modules/subscription/routes';
import { startProviderRefreshScheduler, stopProviderRefreshScheduler } from '@/modules/providers/scheduler';
import { registerConfigRoutes } from '@/modules/config/routes';

const currentDir = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(currentDir, '..');
const workspaceRoot = resolve(serverRoot, '..', '..');

// Load workspace-level env first so the monorepo .env works for server startup.
dotenv.config({ path: resolve(workspaceRoot, '.env') });
// Allow optional service-local overrides in apps/server/.env without changing existing env.
dotenv.config({ path: resolve(serverRoot, '.env') });

const logger = createLogger('main');

// Validate required environment variables in production
if (process.env.NODE_ENV === 'production') {
  if (!process.env.APP_SECRET || process.env.APP_SECRET === 'please-change-this-secret-in-production') {
    logger.error('ERROR: APP_SECRET is not set or using default value. Please set a secure APP_SECRET in .env');
    process.exit(1);
  }
}

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'debug',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
      },
    },
  },
});

// Register plugins
await app.register(cors, {
  origin: true,
  credentials: true,
});

await app.register(cookie);

// Register auth routes
await registerAuthRoutes(app);

// Register provider routes
await registerProviderRoutes(app);

// Register nodes routes
await registerNodesRoutes(app);

// Register profiles routes
await registerProfilesRoutes(app);

// Register dashboard routes
await registerDashboardRoutes(app);

// Register logs routes
await registerLogsRoutes(app);

// Register subscription routes (must be registered after auth middleware setup)
await registerSubscriptionRoutes(app);

// Register public config route (no auth required)
await registerConfigRoutes(app);

// Register static file serving for the frontend
const publicDir = resolve(process.cwd(), 'public');
const hasPublicDir = existsSync(publicDir);

if (hasPublicDir) {
  await app.register(staticPlugin, {
    root: publicDir,
    prefix: '/',
  });
}

// Health check endpoint
app.get('/health', async (_request, _reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Catch-all route for React Router history fallback
// This must be registered AFTER all API routes to avoid overriding them
app.setNotFoundHandler((request, reply) => {
  // Don't serve index.html for API routes
  if (request.url.startsWith('/api') || request.url.startsWith('/sub') || request.url.startsWith('/health')) {
    reply.code(404).send({ error: 'Not found' });
  } else if (hasPublicDir) {
    // For all other routes, serve index.html for React Router to handle
    reply.sendFile('index.html');
  } else {
    reply.code(404).send({ error: 'Frontend assets not available in server-only dev mode' });
  }
});

// Initialize database
initDatabase();
initializeDatabase();
startProviderRefreshScheduler();

logger.info('Database initialized successfully');

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.SERVER_PORT || '8080', 10);
    const host = '0.0.0.0';
    
    await app.listen({ port, host });
    logger.info(`Server running at http://${host}:${port}`);
  } catch (err) {
    logger.error(err);
    closeDatabase();
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  stopProviderRefreshScheduler();
  closeDatabase();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  stopProviderRefreshScheduler();
  closeDatabase();
  process.exit(0);
});

start();
