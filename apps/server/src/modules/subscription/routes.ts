import { FastifyInstance } from 'fastify';
import { validateToken, recordAccess, getProfileById } from '@/modules/profiles/service';
import { getNodes } from '@/modules/nodes/service';
import { renderClash } from '@/core/renderers/renderClash';
import { renderProvider } from '@/core/renderers/renderProvider';
import { renderLoon } from '@/core/renderers/renderLoon';
import { renderRaw } from '@/core/renderers/renderRaw';
import { applyFilters, FilterOptions } from '@/core/merge/filterNodes';
import { renameNodes, RenameOptions } from '@/core/merge/renameNodes';
import { createLogger } from '@/utils/logger';

const logger = createLogger('subscription-routes');

/**
 * 获取和渲染订阅内容
 */
function getProfileNodes(profileId: string, userId: string) {
  const profile = getProfileById(profileId, userId);
  if (!profile) {
    return null;
  }

  const allNodes = getNodes(userId);

  // 构建过滤选项
  const filterOptions: FilterOptions = {
    protocols: profile.include_protocols,
    excludeKeywords: profile.exclude_keywords,
    enabled: true,
  };

  let nodes = applyFilters(allNodes, filterOptions);

  // 应用基本的重命名规则
  const renameOptions: RenameOptions = {
    clean: true,
    dedupeName: true,
  };

  nodes = renameNodes(nodes, renameOptions);

  return { profile, nodes };
}

export async function registerSubscriptionRoutes(app: FastifyInstance): Promise<void> {
  // GET /sub/clash/:profileName?token=xxx
  app.get<{
    Params: { profileName: string };
    Querystring: { token: string };
  }>(
    '/sub/clash/:profileName',
    async (request, reply) => {
      try {
        const { token } = request.query;

        if (!token) {
          reply.status(401);
          reply.type('application/json');
          return { error: 'Missing token' };
        }

        // 验证 token
        const validation = validateToken(token);
        if (!validation) {
          reply.status(401);
          reply.type('application/json');
          return { error: 'Invalid token' };
        }

        // 获取 profile
        const result = getProfileNodes(validation.id, validation.userId);
        if (!result) {
          reply.status(404);
          reply.type('application/json');
          return { error: 'Profile not found' };
        }

        // 记录访问
        recordAccess(validation.id, request.ip, request.headers['user-agent']);

        // 生成 Clash YAML
        const content = renderClash(result.nodes);

        reply.type('application/yaml');
        reply.header('Content-Disposition', `attachment; filename="${result.profile.name}.yaml"`);
        return content;
      } catch (error) {
        logger.error('Clash subscription error', error);
        reply.status(500);
        reply.type('application/json');
        return { error: 'Failed to generate subscription' };
      }
    }
  );

  // GET /sub/loon/:profileName?token=xxx
  app.get<{
    Params: { profileName: string };
    Querystring: { token: string };
  }>(
    '/sub/loon/:profileName',
    async (request, reply) => {
      try {
        const { token } = request.query;

        if (!token) {
          reply.status(401);
          reply.type('application/json');
          return { error: 'Missing token' };
        }

        const validation = validateToken(token);
        if (!validation) {
          reply.status(401);
          reply.type('application/json');
          return { error: 'Invalid token' };
        }

        const result = getProfileNodes(validation.id, validation.userId);
        if (!result) {
          reply.status(404);
          reply.type('application/json');
          return { error: 'Profile not found' };
        }

        recordAccess(validation.id, request.ip, request.headers['user-agent']);

        const content = renderLoon(result.nodes);

        reply.type('text/plain');
        reply.header('Content-Disposition', `attachment; filename="${result.profile.name}.txt"`);
        return content;
      } catch (error) {
        logger.error('Loon subscription error', error);
        reply.status(500);
        reply.type('application/json');
        return { error: 'Failed to generate subscription' };
      }
    }
  );

  // GET /sub/raw/:profileName?token=xxx
  app.get<{
    Params: { profileName: string };
    Querystring: { token: string };
  }>(
    '/sub/raw/:profileName',
    async (request, reply) => {
      try {
        const { token } = request.query;

        if (!token) {
          reply.status(401);
          reply.type('application/json');
          return { error: 'Missing token' };
        }

        const validation = validateToken(token);
        if (!validation) {
          reply.status(401);
          reply.type('application/json');
          return { error: 'Invalid token' };
        }

        const result = getProfileNodes(validation.id, validation.userId);
        if (!result) {
          reply.status(404);
          reply.type('application/json');
          return { error: 'Profile not found' };
        }

        recordAccess(validation.id, request.ip, request.headers['user-agent']);

        const content = renderRaw(result.nodes);

        reply.type('text/plain');
        reply.header('Content-Disposition', `attachment; filename="${result.profile.name}.txt"`);
        return content;
      } catch (error) {
        logger.error('Raw subscription error', error);
        reply.status(500);
        reply.type('application/json');
        return { error: 'Failed to generate subscription' };
      }
    }
  );

  // GET /sub/provider/:profileName?token=xxx
  app.get<{
    Params: { profileName: string };
    Querystring: { token: string };
  }>(
    '/sub/provider/:profileName',
    async (request, reply) => {
      try {
        const { token } = request.query;

        if (!token) {
          reply.status(401);
          reply.type('application/json');
          return { error: 'Missing token' };
        }

        const validation = validateToken(token);
        if (!validation) {
          reply.status(401);
          reply.type('application/json');
          return { error: 'Invalid token' };
        }

        const result = getProfileNodes(validation.id, validation.userId);
        if (!result) {
          reply.status(404);
          reply.type('application/json');
          return { error: 'Profile not found' };
        }

        recordAccess(validation.id, request.ip, request.headers['user-agent']);

        const content = renderProvider(result.nodes);

        reply.type('application/yaml');
        reply.header('Content-Disposition', `attachment; filename="${result.profile.name}-provider.yaml"`);
        return content;
      } catch (error) {
        logger.error('Provider subscription error', error);
        reply.status(500);
        reply.type('application/json');
        return { error: 'Failed to generate subscription' };
      }
    }
  );
}
