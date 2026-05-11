import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '@/db/client';
import { fetchSubscription } from '@/core/fetcher/fetchSubscription';
import { SubscriptionFormat } from '@/core/parsers/detectType';
import { upsertNodes } from '@/modules/nodes/service';
import { createLogger } from '@/utils/logger';
import { getDecryptedSubscriptionUrl, updateProviderStats } from './service';
import { parseRequestHeaders } from './request-headers';

const logger = createLogger('provider-refresh');
const activeRefreshes = new Set<string>();

type RefreshTrigger = 'manual' | 'scheduled';

interface ProviderRecord {
  id: string;
  name: string;
  type: string;
  enabled: number;
  timeout_seconds: number | null;
  user_agent: string | null;
  request_headers_json: string | null;
}

interface RefreshOptions {
  trigger?: RefreshTrigger;
  retryCount?: number;
  force?: boolean;
  jobId?: string;
}

interface RefreshExecutionResult {
  jobId: string;
  status: 'success' | 'failed';
  nodeCount: number;
  errorMessage?: string;
}

export function isProviderRefreshActive(providerId: string): boolean {
  return activeRefreshes.has(providerId);
}

export function enqueueProviderRefresh(providerId: string, options: RefreshOptions = {}): { jobId: string } | null {
  if (!reserveProvider(providerId)) {
    return null;
  }

  const jobId = options.jobId || createRefreshJob(providerId);

  void runProviderRefresh(providerId, { ...options, jobId }).finally(() => {
    activeRefreshes.delete(providerId);
  });

  return { jobId };
}

/**
 * 同步刷新 Provider，等待刷新完成后返回结果
 */
export async function refreshProviderSync(providerId: string): Promise<RefreshExecutionResult | null> {
  if (!reserveProvider(providerId)) {
    return null;
  }

  const jobId = createRefreshJob(providerId);
  try {
    return await runProviderRefresh(providerId, { trigger: 'manual', jobId });
  } finally {
    activeRefreshes.delete(providerId);
  }
}

export async function refreshDueProviders(): Promise<void> {
  const dueProviderIds = listDueProviderIds();

  for (const providerId of dueProviderIds) {
    if (!reserveProvider(providerId)) {
      continue;
    }

    const jobId = createRefreshJob(providerId);
    await runProviderRefresh(providerId, {
      trigger: 'scheduled',
      retryCount: 1,
      jobId,
    }).finally(() => {
      activeRefreshes.delete(providerId);
    });
  }
}

function reserveProvider(providerId: string): boolean {
  if (activeRefreshes.has(providerId)) {
    return false;
  }

  activeRefreshes.add(providerId);
  return true;
}

function listDueProviderIds(now = Date.now()): string[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT id
    FROM providers
    WHERE enabled = 1
      AND (last_refresh_at IS NULL OR (last_refresh_at + (refresh_interval * 1000)) <= ?)
    ORDER BY COALESCE(last_refresh_at, 0) ASC
  `).all(now) as Array<{ id: string }>;

  return rows.map((row) => row.id);
}

function createRefreshJob(providerId: string): string {
  const db = getDatabase();
  const jobId = uuidv4();
  const now = Date.now();

  db.prepare(`
    INSERT INTO refresh_jobs (id, provider_id, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(jobId, providerId, 'pending', now, now);

  return jobId;
}

async function runProviderRefresh(providerId: string, options: RefreshOptions): Promise<RefreshExecutionResult> {
  const db = getDatabase();
  const provider = db.prepare(`
    SELECT id, name, type, enabled, timeout_seconds, user_agent, request_headers_json
    FROM providers
    WHERE id = ?
  `).get(providerId) as ProviderRecord | undefined;

  if (!provider) {
    throw new Error('Provider not found');
  }

  if (!options.force && provider.enabled !== 1) {
    throw new Error('Provider is disabled');
  }

  const jobId = options.jobId || createRefreshJob(providerId);
  const startedAt = Date.now();
  const maxAttempts = Math.max(1, (options.retryCount ?? 0) + 1);
  const headers = parseRequestHeaders(provider.request_headers_json);
  const subscriptionUrl = getDecryptedSubscriptionUrl(providerId);

  if (!subscriptionUrl) {
    const errorMessage = 'No subscription URL configured';
    finalizeRefreshFailure(jobId, providerId, startedAt, errorMessage);
    return { jobId, status: 'failed', nodeCount: 0, errorMessage };
  }

  db.prepare('UPDATE refresh_jobs SET status = ?, updated_at = ? WHERE id = ?').run('running', startedAt, jobId);

  let lastError = 'Unknown error';

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await fetchSubscription(subscriptionUrl, providerId, {
        timeout: (provider.timeout_seconds || 30) * 1000,
        userAgent: provider.user_agent || undefined,
        headers,
        name: provider.name,
        preferredFormat: mapProviderTypeToFormat(provider.type),
      });

      if (result.success) {
        const nodes = upsertNodes(result.nodes, providerId);
        updateProviderStats(providerId, nodes.length);

        db.prepare(`
          UPDATE refresh_jobs
          SET status = ?, node_count = ?, duration_ms = ?, updated_at = ?
          WHERE id = ?
        `).run('success', nodes.length, Date.now() - startedAt, Date.now(), jobId);

        logger.info({ providerId, trigger: options.trigger || 'manual', nodeCount: nodes.length }, 'Provider refresh completed');
        return { jobId, status: 'success', nodeCount: nodes.length };
      }

      lastError = result.errors[0]?.error || 'Failed to fetch subscription';
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
    }

    if (attempt < maxAttempts) {
      logger.warn({ providerId, attempt, maxAttempts, error: lastError }, 'Provider refresh failed, retrying');
    }
  }

  finalizeRefreshFailure(jobId, providerId, startedAt, lastError);
  return { jobId, status: 'failed', nodeCount: 0, errorMessage: lastError };
}

export function mapProviderTypeToFormat(providerType: string): SubscriptionFormat | undefined {
  switch (providerType) {
    case 'clash':
      return SubscriptionFormat.CLASH_YAML;
    case 'base64-uri':
      return SubscriptionFormat.BASE64_URI;
    case 'uri-list':
      return SubscriptionFormat.URI_LIST;
    case 'auto':
    default:
      return undefined;
  }
}

function finalizeRefreshFailure(jobId: string, providerId: string, startedAt: number, errorMessage: string): void {
  const db = getDatabase();
  updateProviderStats(providerId, 0, errorMessage);

  db.prepare(`
    UPDATE refresh_jobs
    SET status = ?, error_message = ?, duration_ms = ?, updated_at = ?
    WHERE id = ?
  `).run('failed', errorMessage, Date.now() - startedAt, Date.now(), jobId);

  logger.error({ providerId, errorMessage }, 'Provider refresh failed');
}
