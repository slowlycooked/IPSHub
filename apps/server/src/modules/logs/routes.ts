import { FastifyInstance } from 'fastify';
import { requireAuth } from '@/modules/auth/routes';
import { getDatabase } from '@/db/client';
import { createLogger } from '@/utils/logger';

const logger = createLogger('logs-routes');

interface AuthenticatedRequest {
  user?: {
    userId?: string;
  };
}

interface RefreshJobRow {
  id: string;
  provider_id: string;
  provider_name: string;
  status: string;
  node_count: number | null;
  error_message: string | null;
  duration_ms: number | null;
  created_at: number | null;
  updated_at: number | null;
}

interface AccessLogRow {
  id: string;
  profile_id: string;
  profile_name: string;
  output_format: string;
  ip_address: string | null;
  user_agent: string | null;
  status_code: number | null;
  response_size: number | null;
  duration_ms: number | null;
  accessed_at: number;
}

function getUserId(request: unknown): string | undefined {
  return (request as AuthenticatedRequest).user?.userId;
}

export async function registerLogsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/logs/refresh', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return reply.status(401).send({ success: false });
      }

      const db = getDatabase();
      const rows = db
        .prepare(
          `
          SELECT
            rj.id,
            rj.provider_id,
            rj.status,
            rj.node_count,
            rj.error_message,
            rj.duration_ms,
            rj.created_at,
            rj.updated_at,
            p.name AS provider_name
          FROM refresh_jobs rj
          JOIN providers p ON p.id = rj.provider_id
          WHERE p.user_id = ?
          ORDER BY rj.updated_at DESC
          LIMIT 200
        `,
        )
        .all(userId) as RefreshJobRow[];

      const logs = rows.map((job) => ({
        id: job.id,
        providerId: job.provider_id,
        providerName: job.provider_name,
        status: job.status,
        nodeCount: job.node_count ?? undefined,
        errorMessage: job.error_message ?? undefined,
        durationMs: job.duration_ms ?? undefined,
        createdAt: job.created_at ?? undefined,
        updatedAt: job.updated_at ?? undefined,
      }));

      return { success: true, data: { logs } };
    } catch (error) {
      logger.error({ error }, 'Get refresh logs error');
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get refresh logs' },
      });
    }
  });

  app.get('/api/logs/access', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return reply.status(401).send({ success: false });
      }

      const db = getDatabase();
      const rows = db
        .prepare(
          `
          SELECT
            al.id,
            al.profile_id,
            al.ip_address,
            al.user_agent,
            al.status_code,
            al.response_size,
            al.duration_ms,
            al.accessed_at,
            pr.name AS profile_name,
            pr.output_format AS output_format
          FROM access_logs al
          JOIN profiles pr ON pr.id = al.profile_id
          WHERE pr.user_id = ?
          ORDER BY al.accessed_at DESC
          LIMIT 200
        `,
        )
        .all(userId) as AccessLogRow[];

      const logs = rows.map((log) => ({
        id: log.id,
        profileId: log.profile_id,
        profileName: log.profile_name,
        outputFormat: log.output_format,
        ipAddress: log.ip_address ?? undefined,
        userAgent: log.user_agent ?? undefined,
        statusCode: log.status_code ?? undefined,
        responseSize: log.response_size ?? undefined,
        durationMs: log.duration_ms ?? undefined,
        accessedAt: log.accessed_at,
      }));

      return { success: true, data: { logs } };
    } catch (error) {
      logger.error({ error }, 'Get access logs error');
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get access logs' },
      });
    }
  });
}
