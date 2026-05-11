import { FastifyInstance } from 'fastify';
import { requireAuth } from '@/modules/auth/routes';
import { getDatabase } from '@/db/client';
import { createLogger } from '@/utils/logger';

const logger = createLogger('dashboard-routes');

export async function registerDashboardRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/dashboard - 获取仪表板数据
  app.get('/api/dashboard', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = (request as any).user?.userId;
      const db = getDatabase();

      const providerStats = db.prepare(`
        SELECT
          COUNT(*) AS totalProviders,
          SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS enabledProviders,
          MAX(last_refresh_at) AS latestRefreshAt
        FROM providers
        WHERE user_id = ?
      `).get(userId) as any;

      const nodeStats = db.prepare(`
        SELECT
          COUNT(*) AS totalNodes,
          SUM(CASE WHEN n.enabled = 1 THEN 1 ELSE 0 END) AS enabledNodes
        FROM nodes n
        JOIN providers p ON p.id = n.provider_id
        WHERE p.user_id = ?
      `).get(userId) as any;

      const profileStats = db.prepare(`
        SELECT COUNT(*) AS totalProfiles
        FROM profiles
        WHERE user_id = ?
      `).get(userId) as any;

      const refreshJobStats = db.prepare(`
        SELECT COUNT(*) AS totalRefreshJobs
        FROM refresh_jobs rj
        JOIN providers p ON p.id = rj.provider_id
        WHERE p.user_id = ?
      `).get(userId) as any;

      const stats = {
        totalProviders: providerStats?.totalProviders || 0,
        enabledProviders: providerStats?.enabledProviders || 0,
        totalNodes: nodeStats?.totalNodes || 0,
        enabledNodes: nodeStats?.enabledNodes || 0,
        totalProfiles: profileStats?.totalProfiles || 0,
        totalRefreshJobs: refreshJobStats?.totalRefreshJobs || 0,
        latestRefreshAt: providerStats?.latestRefreshAt || undefined,
      };

      const recentRefreshes = db.prepare(`
        SELECT
          rj.id,
          rj.status,
          rj.node_count,
          rj.error_message,
          rj.created_at,
          rj.updated_at,
          rj.duration_ms,
          p.name AS provider_name
        FROM refresh_jobs rj
        JOIN providers p ON p.id = rj.provider_id
        WHERE p.user_id = ?
        ORDER BY rj.updated_at DESC
        LIMIT 10
      `).all(userId) as any[];

      const recentAccessLogs = db.prepare(`
        SELECT
          al.id,
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
        LIMIT 10
      `).all(userId) as any[];

      const topProfiles = db.prepare(`
        SELECT id, name, access_count, last_accessed_at
        FROM profiles
        WHERE user_id = ?
        ORDER BY access_count DESC, updated_at DESC
        LIMIT 5
      `).all(userId) as any[];

      return {
        success: true,
        data: {
          stats,
          recentRefreshes,
          recentAccessLogs,
          topProfiles,
        },
      };
    } catch (error) {
      logger.error('Get dashboard error', error);
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get dashboard data',
        },
      });
    }
  });
}
