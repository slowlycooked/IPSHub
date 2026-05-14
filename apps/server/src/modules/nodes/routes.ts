import { FastifyInstance } from 'fastify';
import { requireAuth } from '@/modules/auth/routes';
import {
  getNodes,
  getNodeById,
  updateNode,
  enableNode,
  disableNode,
  testNodesConnectivity,
  updateNodeSchema,
  UpdateNodeInput,
} from './service';
import { createLogger } from '@/utils/logger';
import { z } from 'zod';

const logger = createLogger('nodes-routes');
const testLatencySchema = z.object({
  timeoutMs: z.number().int().min(500).max(15000).optional(),
});

export async function registerNodesRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/nodes - 列出所有节点
  app.get('/api/nodes', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = (request as any).user?.userId;
      const nodes = getNodes(userId).map((node) => ({
        ...node,
        provider_id: node.providerId,
      }));
      return {
        success: true,
        data: {
          nodes,
          total: nodes.length,
        },
      };
    } catch (error) {
      logger.error('Get nodes error', error);
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get nodes',
        },
      });
    }
  });

  // GET /api/nodes/:id - 获取单个节点
  app.get<{ Params: { id: string } }>(
    '/api/nodes/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const userId = (request as any).user?.userId;
        const node = getNodeById(request.params.id, userId);

        if (!node) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Node not found',
            },
          });
        }

        return {
          success: true,
          data: { node },
        };
      } catch (error) {
        logger.error('Get node error', error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to get node',
          },
        });
      }
    }
  );

  // PUT /api/nodes/:id - 更新节点
  app.put<{ Params: { id: string }; Body: UpdateNodeInput }>(
    '/api/nodes/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const userId = (request as any).user?.userId;
        const parsed = updateNodeSchema.safeParse(request.body);

        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid node data',
            },
          });
        }

        const node = updateNode(request.params.id, parsed.data, userId);

        if (!node) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Node not found',
            },
          });
        }

        return {
          success: true,
          data: { node },
        };
      } catch (error) {
        logger.error('Update node error', error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to update node',
          },
        });
      }
    }
  );

  // POST /api/nodes/:id/enable - 启用节点
  app.post<{ Params: { id: string } }>(
    '/api/nodes/:id/enable',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const userId = (request as any).user?.userId;
        const node = enableNode(request.params.id, userId);

        if (!node) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Node not found',
            },
          });
        }

        return {
          success: true,
          data: { node },
        };
      } catch (error) {
        logger.error('Enable node error', error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to enable node',
          },
        });
      }
    }
  );

  // POST /api/nodes/:id/disable - 禁用节点
  app.post<{ Params: { id: string } }>(
    '/api/nodes/:id/disable',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const userId = (request as any).user?.userId;
        const node = disableNode(request.params.id, userId);

        if (!node) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Node not found',
            },
          });
        }

        return {
          success: true,
          data: { node },
        };
      } catch (error) {
        logger.error('Disable node error', error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to disable node',
          },
        });
      }
    }
  );

  // POST /api/nodes/test-latency - 执行所有节点的 TCP/HTTP 连通性测试
  app.post<{ Body: { timeoutMs?: number } }>(
    '/api/nodes/test-latency',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const userId = (request as any).user?.userId;
        const parsed = testLatencySchema.safeParse(request.body ?? {});

        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid latency test payload',
            },
          });
        }

        const results = await testNodesConnectivity(userId, parsed.data.timeoutMs);
        return {
          success: true,
          data: {
            results,
            total: results.length,
            checkedAt: Date.now(),
          },
        };
      } catch (error) {
        logger.error('Test node latency error', error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to test node latency',
          },
        });
      }
    }
  );
}
