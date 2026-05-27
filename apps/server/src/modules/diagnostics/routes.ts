import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '@/modules/auth/routes';
import { createLogger } from '@/utils/logger';
import { sanitizeJson } from '@/utils/sanitize';
import {
  getRunById,
  getRecentRuns,
  getRunResults,
  getNodeLogs,
  getNodeDiff,
  getRunAllData,
} from './repository';
import { enqueueLatencyRun } from './service';
import { findSingBoxBinary } from './singboxRunner';

const logger = createLogger('diagnostics-routes');

const createRunSchema = z.object({
  mode: z.enum(['compare']).default('compare'),
  clientFormats: z.array(z.enum(['clash', 'loon'])).default(['clash', 'loon']),
  scope: z.enum(['provider', 'node']).default('provider'),
  providerIds: z.array(z.string().uuid()).min(1, 'At least one provider required'),
  nodeIds: z.array(z.string()).default([]),
  testUrls: z
    .array(z.string().url())
    .default([
      'http://www.gstatic.com/generate_204',
      'http://cp.cloudflare.com/generate_204',
    ]),
  timeoutMs: z.number().int().min(2000).max(15000).default(5000),
  concurrency: z.number().int().min(1).max(5).default(3),
});

export async function registerDiagnosticsRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/diagnostics/capabilities — check which optional features are available
  app.get('/api/diagnostics/capabilities', { preHandler: requireAuth }, async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        singBoxAvailable: findSingBoxBinary() !== null,
      },
    });
  });

  // POST /api/diagnostics/latency-runs — create and start a new run
  app.post('/api/diagnostics/latency-runs', { preHandler: requireAuth }, async (request, reply) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (request as any).user?.userId as string | undefined;
      if (!userId) {
        return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED' } });
      }
      const parsed = createRunSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        });
      }
      const result = enqueueLatencyRun({
        userId,
        mode: parsed.data.mode,
        clientFormats: parsed.data.clientFormats,
        scope: parsed.data.scope,
        providerIds: parsed.data.providerIds,
        nodeIds: parsed.data.nodeIds,
        testUrls: parsed.data.testUrls,
        timeoutMs: parsed.data.timeoutMs,
        concurrency: parsed.data.concurrency,
      });
      return reply.status(202).send({ success: true, data: result });
    } catch (err) {
      logger.error({ err }, 'Create diagnostic run error');
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR' } });
    }
  });

  // GET /api/diagnostics/latency-runs — list recent runs
  app.get('/api/diagnostics/latency-runs', { preHandler: requireAuth }, async (request, reply) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (request as any).user?.userId as string | undefined;
      if (!userId) return reply.status(401).send({ success: false });
      const runs = getRecentRuns(userId, 30);
      return { success: true, data: { runs } };
    } catch (err) {
      logger.error({ err }, 'List diagnostic runs error');
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR' } });
    }
  });

  // GET /api/diagnostics/latency-runs/:runId — run status + progress
  app.get<{ Params: { runId: string } }>(
    '/api/diagnostics/latency-runs/:runId',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userId = (request as any).user?.userId as string | undefined;
        if (!userId) return reply.status(401).send({ success: false });
        const run = getRunById(request.params.runId, userId);
        if (!run) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
        return { success: true, data: { run } };
      } catch (err) {
        logger.error({ err }, 'Get diagnostic run error');
        return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR' } });
      }
    },
  );

  // GET /api/diagnostics/latency-runs/:runId/results — full results
  app.get<{ Params: { runId: string } }>(
    '/api/diagnostics/latency-runs/:runId/results',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userId = (request as any).user?.userId as string | undefined;
        if (!userId) return reply.status(401).send({ success: false });
        const run = getRunById(request.params.runId, userId);
        if (!run) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
        const results = getRunResults(request.params.runId);
        return { success: true, data: { run, results } };
      } catch (err) {
        logger.error({ err }, 'Get diagnostic results error');
        return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR' } });
      }
    },
  );

  // GET /api/diagnostics/latency-runs/:runId/nodes/:nodeId/logs
  app.get<{ Params: { runId: string; nodeId: string } }>(
    '/api/diagnostics/latency-runs/:runId/nodes/:nodeId/logs',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userId = (request as any).user?.userId as string | undefined;
        if (!userId) return reply.status(401).send({ success: false });
        const run = getRunById(request.params.runId, userId);
        if (!run) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
        const logs = getNodeLogs(request.params.runId, request.params.nodeId);
        return { success: true, data: { logs } };
      } catch (err) {
        logger.error({ err }, 'Get node logs error');
        return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR' } });
      }
    },
  );

  // GET /api/diagnostics/latency-runs/:runId/nodes/:nodeId/diff
  app.get<{ Params: { runId: string; nodeId: string } }>(
    '/api/diagnostics/latency-runs/:runId/nodes/:nodeId/diff',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userId = (request as any).user?.userId as string | undefined;
        if (!userId) return reply.status(401).send({ success: false });
        const run = getRunById(request.params.runId, userId);
        if (!run) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
        const diff = getNodeDiff(request.params.runId, request.params.nodeId);
        return { success: true, data: { diff } };
      } catch (err) {
        logger.error({ err }, 'Get node diff error');
        return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR' } });
      }
    },
  );

  // GET /api/diagnostics/latency-runs/:runId/debug-package
  app.get<{ Params: { runId: string } }>(
    '/api/diagnostics/latency-runs/:runId/debug-package',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userId = (request as any).user?.userId as string | undefined;
        if (!userId) return reply.status(401).send({ success: false });
        const run = getRunById(request.params.runId, userId);
        if (!run) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
        const allData = getRunAllData(request.params.runId);
        const sanitized = sanitizeJson(allData);
        const json = JSON.stringify(sanitized, null, 2);
        reply.header('Content-Type', 'application/json');
        reply.header(
          'Content-Disposition',
          `attachment; filename="diag-${request.params.runId.slice(0, 8)}.json"`,
        );
        return reply.send(json);
      } catch (err) {
        logger.error({ err }, 'Get debug package error');
        return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR' } });
      }
    },
  );
}
