import { FastifyInstance } from 'fastify';
import { requireAuth } from '@/modules/auth/routes';
import {
  createProfile,
  getProfiles,
  getProfileById,
  updateProfile,
  deleteProfile,
  regenerateToken,
  createProfileSchema,
  updateProfileSchema,
  CreateProfileInput,
  UpdateProfileInput,
} from './service';
import { createLogger } from '@/utils/logger';

const logger = createLogger('profiles-routes');

export async function registerProfilesRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/profiles - 列出所有 Profile
  app.get('/api/profiles', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = (request as any).user?.userId;
      const profiles = getProfiles(userId);
      return {
        success: true,
        data: { profiles },
      };
    } catch (error) {
      logger.error('Get profiles error', error);
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get profiles',
        },
      });
    }
  });

  // POST /api/profiles - 创建新 Profile
  app.post<{ Body: CreateProfileInput }>(
    '/api/profiles',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const userId = (request as any).user?.userId;
        const parsed = createProfileSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid profile data',
            },
          });
        }

        const profile = createProfile(parsed.data, userId);
        return {
          success: true,
          data: { profile },
        };
      } catch (error) {
        logger.error('Create profile error', error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to create profile',
          },
        });
      }
    }
  );

  // GET /api/profiles/:id - 获取单个 Profile
  app.get<{ Params: { id: string } }>(
    '/api/profiles/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const userId = (request as any).user?.userId;
        const profile = getProfileById(request.params.id, userId);
        if (!profile) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Profile not found',
            },
          });
        }

        return {
          success: true,
          data: { profile },
        };
      } catch (error) {
        logger.error('Get profile error', error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to get profile',
          },
        });
      }
    }
  );

  // PUT /api/profiles/:id - 更新 Profile
  app.put<{ Params: { id: string }; Body: UpdateProfileInput }>(
    '/api/profiles/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const userId = (request as any).user?.userId;
        const parsed = updateProfileSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid profile data',
            },
          });
        }

        const profile = updateProfile(request.params.id, userId, parsed.data);
        if (!profile) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Profile not found',
            },
          });
        }

        return {
          success: true,
          data: { profile },
        };
      } catch (error) {
        logger.error('Update profile error', error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to update profile',
          },
        });
      }
    }
  );

  // DELETE /api/profiles/:id - 删除 Profile
  app.delete<{ Params: { id: string } }>(
    '/api/profiles/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const userId = (request as any).user?.userId;
        const success = deleteProfile(request.params.id, userId);
        if (!success) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Profile not found',
            },
          });
        }

        return {
          success: true,
          data: { message: 'Profile deleted' },
        };
      } catch (error) {
        logger.error('Delete profile error', error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to delete profile',
          },
        });
      }
    }
  );

  // POST /api/profiles/:id/regenerate-token - 重新生成 Token
  app.post<{ Params: { id: string } }>(
    '/api/profiles/:id/regenerate-token',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const userId = (request as any).user?.userId;
        const profile = regenerateToken(request.params.id, userId);
        if (!profile) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Profile not found',
            },
          });
        }

        return {
          success: true,
          data: { profile },
        };
      } catch (error) {
        logger.error('Regenerate token error', error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to regenerate token',
          },
        });
      }
    }
  );
}
