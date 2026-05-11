import { FastifyInstance } from 'fastify';
import { requireAuth } from '@/modules/auth/routes';
import {
  createProvider,
  getProviders,
  getProviderById,
  updateProvider,
  deleteProvider,
  createProviderSchema,
  updateProviderSchema,
  CreateProviderInput,
  UpdateProviderInput,
} from './service';
import { createLogger } from '@/utils/logger';

const logger = createLogger('provider-routes');

export async function registerProviderRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/providers - 列出所有 Provider
  app.get('/api/providers', { preHandler: requireAuth }, async (_request, reply) => {
    try {
      const providers = getProviders();
      return {
        success: true,
        data: { providers },
      };
    } catch (error) {
      logger.error('Get providers error', error);
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get providers',
        },
      });
    }
  });

  // POST /api/providers - 创建新 Provider
  app.post<{ Body: CreateProviderInput }>(
    '/api/providers',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const parsed = createProviderSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid provider data',
            },
          });
        }

        const provider = createProvider(parsed.data);
        return {
          success: true,
          data: { provider },
        };
      } catch (error) {
        logger.error('Create provider error', error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to create provider',
          },
        });
      }
    }
  );

  // GET /api/providers/:id - 获取单个 Provider
  app.get<{ Params: { id: string } }>(
    '/api/providers/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const provider = getProviderById(request.params.id);
        if (!provider) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Provider not found',
            },
          });
        }

        return {
          success: true,
          data: { provider },
        };
      } catch (error) {
        logger.error('Get provider error', error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to get provider',
          },
        });
      }
    }
  );

  // PUT /api/providers/:id - 更新 Provider
  app.put<{ Params: { id: string }; Body: UpdateProviderInput }>(
    '/api/providers/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const parsed = updateProviderSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid provider data',
            },
          });
        }

        const provider = updateProvider(request.params.id, parsed.data);
        if (!provider) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Provider not found',
            },
          });
        }

        return {
          success: true,
          data: { provider },
        };
      } catch (error) {
        logger.error('Update provider error', error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to update provider',
          },
        });
      }
    }
  );

  // DELETE /api/providers/:id - 删除 Provider
  app.delete<{ Params: { id: string } }>(
    '/api/providers/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const success = deleteProvider(request.params.id);
        if (!success) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Provider not found',
            },
          });
        }

        return {
          success: true,
          data: { message: 'Provider deleted' },
        };
      } catch (error) {
        logger.error('Delete provider error', error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to delete provider',
          },
        });
      }
    }
  );
}
