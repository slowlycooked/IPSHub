import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { validateToken, recordAccess, getProfileById } from '@/modules/profiles/service';
import { getNodes } from '@/modules/nodes/service';
import {
  normalizeClashProfileTarget,
  renderClashProfile,
} from '@/core/renderers/renderClashProfile';
import { renderProvider } from '@/core/renderers/renderProvider';
import { renderLoon } from '@/core/renderers/renderLoon';
import { renderRaw } from '@/core/renderers/renderRaw';
import { applyFilters, FilterOptions } from '@/core/merge/filterNodes';
import { renameNodes, RenameOptions } from '@/core/merge/renameNodes';
import { createLogger } from '@/utils/logger';
import { ProxyNode } from '@/types/proxy';

const logger = createLogger('subscription-routes');
type SubscriptionFormat = 'clash' | 'provider' | 'loon' | 'raw';

interface SubscriptionContext {
  profile: NonNullable<ReturnType<typeof getProfileById>>;
  nodes: ProxyNode[];
}

type SubscriptionRouteRequest = FastifyRequest<{
  Params: { profileName: string };
  Querystring: { token?: string; target?: string };
}>;

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

function decodeProfileName(rawName: string): string | null {
  try {
    return decodeURIComponent(rawName);
  } catch {
    return null;
  }
}

function resolveSubscriptionContext(
  request: SubscriptionRouteRequest,
  reply: FastifyReply,
  _format: SubscriptionFormat
): SubscriptionContext | { error: string } {
  const token = request.query.token;
  if (!token) {
    return sendJsonError(reply, 401, 'Missing token');
  }

  const validation = validateToken(token);
  if (!validation) {
    return sendJsonError(reply, 401, 'Invalid token');
  }

  const result = getProfileNodes(validation.id, validation.userId);
  if (!result) {
    return sendJsonError(reply, 404, 'Profile not found');
  }

  const requestedName = decodeProfileName(request.params.profileName);
  if (!requestedName) {
    return sendJsonError(reply, 400, 'Invalid profile name encoding');
  }

  if (requestedName !== result.profile.name) {
    return sendJsonError(reply, 404, 'Profile not found');
  }

  recordAccess(validation.id, request.ip, request.headers['user-agent']);

  return {
    profile: result.profile,
    nodes: result.nodes,
  };
}

function sendJsonError(reply: FastifyReply, statusCode: number, error: string) {
  reply.status(statusCode);
  reply.type('application/json');
  return { error };
}

export async function registerSubscriptionRoutes(app: FastifyInstance): Promise<void> {
  // GET /sub/clash/:profileName?token=xxx
  app.get<{
    Params: { profileName: string };
    Querystring: { token?: string; target?: string };
  }>('/sub/clash/:profileName', async (request, reply) => {
    try {
      const context = resolveSubscriptionContext(request, reply, 'clash');
      if ('error' in context) {
        return context;
      }

      const target = normalizeClashProfileTarget(
        request.query.target ?? context.profile.clash_config?.target
      );
      if (target === 'loon') {
        const content = renderLoon(context.nodes, context.profile.clash_config);
        reply.type('text/plain');
        reply.header('Content-Disposition', `attachment; filename="${context.profile.name}.txt"`);
        return content;
      }

      const content = renderClashProfile(context.profile.clash_config, context.nodes, {
        target,
      });
      reply.type('application/yaml');
      reply.header('Content-Disposition', `attachment; filename="${context.profile.name}.yaml"`);
      return content;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'No supported nodes available for this profile'
      ) {
        return sendJsonError(reply, 422, 'No supported nodes available for this profile');
      }

      logger.error('Clash subscription error', error);
      return sendJsonError(reply, 500, 'Failed to generate subscription');
    }
  });

  // GET /sub/loon/:profileName?token=xxx
  app.get<{
    Params: { profileName: string };
    Querystring: { token?: string };
  }>('/sub/loon/:profileName', async (request, reply) => {
    try {
      const context = resolveSubscriptionContext(request, reply, 'loon');
      if ('error' in context) {
        return context;
      }

      const content = renderLoon(context.nodes, context.profile.clash_config);
      reply.type('text/plain');
      reply.header('Content-Disposition', `attachment; filename="${context.profile.name}.txt"`);
      return content;
    } catch (error) {
      logger.error('Loon subscription error', error);
      return sendJsonError(reply, 500, 'Failed to generate subscription');
    }
  });

  // GET /sub/raw/:profileName?token=xxx
  app.get<{
    Params: { profileName: string };
    Querystring: { token?: string };
  }>('/sub/raw/:profileName', async (request, reply) => {
    try {
      const context = resolveSubscriptionContext(request, reply, 'raw');
      if ('error' in context) {
        return context;
      }

      const content = renderRaw(context.nodes);
      reply.type('text/plain');
      reply.header('Content-Disposition', `attachment; filename="${context.profile.name}.txt"`);
      return content;
    } catch (error) {
      logger.error('Raw subscription error', error);
      return sendJsonError(reply, 500, 'Failed to generate subscription');
    }
  });

  // GET /sub/provider/:profileName?token=xxx
  app.get<{
    Params: { profileName: string };
    Querystring: { token?: string };
  }>('/sub/provider/:profileName', async (request, reply) => {
    try {
      const context = resolveSubscriptionContext(request, reply, 'provider');
      if ('error' in context) {
        return context;
      }

      const content = renderProvider(context.nodes);
      reply.type('application/yaml');
      reply.header(
        'Content-Disposition',
        `attachment; filename="${context.profile.name}-provider.yaml"`
      );
      return content;
    } catch (error) {
      logger.error('Provider subscription error', error);
      return sendJsonError(reply, 500, 'Failed to generate subscription');
    }
  });
}
