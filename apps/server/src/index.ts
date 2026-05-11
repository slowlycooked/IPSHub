import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from '@/utils/logger';
import { initDatabase, closeDatabase } from '@/db/client';
import { initializeDatabase } from '@/db/init';
import { registerAuthRoutes } from '@/modules/auth/routes';
import { registerProviderRoutes } from '@/modules/providers/routes';

const currentDir = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(currentDir, '..');
const workspaceRoot = resolve(serverRoot, '..', '..');

// Load workspace-level env first so the monorepo .env works for server startup.
dotenv.config({ path: resolve(workspaceRoot, '.env') });
// Allow optional service-local overrides in apps/server/.env without changing existing env.
dotenv.config({ path: resolve(serverRoot, '.env') });

const logger = createLogger('main');

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

// Initialize database
initDatabase();
initializeDatabase();

logger.info('Database initialized successfully');

// Health check endpoint
app.get('/health', async (_request, _reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

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
  closeDatabase();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  closeDatabase();
  process.exit(0);
});

start();
