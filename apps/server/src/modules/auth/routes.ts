import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { loginSchema, loginUser, generateSessionId } from './service';
import { setAuthCookie, getSessionFromRequest, clearSession } from './session';
import { createLogger } from '@/utils/logger';

const logger = createLogger('auth-routes');

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/auth/login
  app.post<{ Body: typeof loginSchema._input }>(
    '/api/auth/login',
    async (request, reply) => {
      try {
        const parsed = loginSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid username or password format',
            },
          });
        }

        const { username, password } = parsed.data;
        const user = loginUser(username, password);

        if (!user) {
          return reply.status(401).send({
            success: false,
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Invalid username or password',
            },
          });
        }

        const sessionId = generateSessionId();
        await setAuthCookie(reply, sessionId, { userId: user.id, username: user.username });

        return {
          success: true,
          data: {
            user: { id: user.id, username: user.username },
          },
        };
      } catch (error) {
        logger.error('Login error', error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred during login',
          },
        });
      }
    }
  );

  // POST /api/auth/logout
  app.post('/api/auth/logout', async (request, reply) => {
    try {
      const sessionId = request.cookies.sessionId;
      if (sessionId) {
        await clearSession(sessionId);
      }

      reply.clearCookie('sessionId');
      return {
        success: true,
        data: { message: 'Logged out successfully' },
      };
    } catch (error) {
      logger.error('Logout error', error);
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred during logout',
        },
      });
    }
  });

  // GET /api/auth/me
  app.get('/api/auth/me', async (request, reply) => {
    try {
      const session = await getSessionFromRequest(request);

      if (!session) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'NOT_AUTHENTICATED',
            message: 'Not authenticated',
          },
        });
      }

      return {
        success: true,
        data: {
          user: { id: session.userId, username: session.username },
        },
      };
    } catch (error) {
      logger.error('Get user error', error);
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred',
        },
      });
    }
  });
}

/**
 * 中间件：检查认证
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const session = await getSessionFromRequest(request);

  if (!session) {
    return reply.status(401).send({
      success: false,
      error: {
        code: 'NOT_AUTHENTICATED',
        message: 'Authentication required',
      },
    });
  }
    // 将用户信息附加到 request 对象上
    (request as any).user = session;
  }
