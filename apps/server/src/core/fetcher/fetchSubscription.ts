import { safeFetch, FetchOptions } from './ssrfGuard';
import { parseSubscription, SubscriptionFormat } from '@/core/parsers/detectType';
import { ProxyNode } from '@/types/proxy';
import { dedupeNodes } from '@/core/merge/filterNodes';
import { cleanNodeNames, dedupeNodeNames } from '@/core/merge/renameNodes';
import { createLogger } from '@/utils/logger';

const logger = createLogger('fetch-subscription');

export interface SubscriptionFetchResult {
  success: boolean;
  nodes: ProxyNode[];
  nodeCount: number;
  format: string;
  errors: Array<{ raw: string; error: string }>;
  fetchedAt: string;
  contentLength: number;
}

/**
 * 从提供商 URL 拉取订阅
 */
export async function fetchSubscription(
  url: string,
  providerId: string,
  options: FetchOptions & { name?: string; preferredFormat?: SubscriptionFormat } = {}
): Promise<SubscriptionFetchResult> {
  const startTime = Date.now();
  const fetchOptions: FetchOptions = {
    timeout: options.timeout || 30000,
    maxSize: options.maxSize || 10 * 1024 * 1024,
    userAgent: options.userAgent || `IPSHub/1.0 (Provider-ID: ${providerId})`,
    allowPrivate: process.env.NODE_ENV === 'development',
    headers: options.headers,
  };

  try {
    // 获取远程内容
    logger.info(`Fetching subscription from provider ${providerId}: ${url.substring(0, 50)}...`);
    const content = await safeFetch(url, fetchOptions);
    const contentLength = content.length;

    logger.debug(`Fetched ${contentLength} bytes from ${providerId}`);

    // 解析内容
    const parseResult = parseSubscription(content, providerId, options.preferredFormat);

    // 后处理节点
    let nodes = parseResult.nodes;

    // 清理名称
    nodes = cleanNodeNames(nodes);

    // 去重
    nodes = dedupeNodes(nodes);

    // 去重名称（处理相同名称的节点）
    nodes = dedupeNodeNames(nodes);

    // 更新提供商信息
    nodes = nodes.map(node => ({
      ...node,
      provider: options.name || providerId,
      updatedAt: Date.now(),
    }));

    logger.info(
      `Successfully parsed ${nodes.length} nodes from provider ${providerId} ` +
      `(${parseResult.errors.length} parse errors, took ${Date.now() - startTime}ms)`
    );

    return {
      success: true,
      nodes,
      nodeCount: nodes.length,
      format: options.preferredFormat || 'auto-detected',
      errors: parseResult.errors,
      fetchedAt: new Date().toISOString(),
      contentLength,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error(
      `Failed to fetch subscription from provider ${providerId}: ${errorMessage} (${duration}ms)`,
      error
    );

    return {
      success: false,
      nodes: [],
      nodeCount: 0,
      format: 'unknown',
      errors: [{ raw: url, error: errorMessage }],
      fetchedAt: new Date().toISOString(),
      contentLength: 0,
    };
  }
}

/**
 * 从多个 Provider 并行拉取订阅
 */
export async function fetchMultipleSubscriptions(
  providers: Array<{
    id: string;
    url: string;
    name: string;
    timeout?: number;
    userAgent?: string;
  }>,
  options: FetchOptions = {}
): Promise<{
  nodes: ProxyNode[];
  results: SubscriptionFetchResult[];
  totalErrors: number;
}> {
  const results = await Promise.all(
    providers.map(provider =>
      fetchSubscription(provider.url, provider.id, {
        ...options,
        timeout: provider.timeout,
        userAgent: provider.userAgent,
        name: provider.name,
      })
    )
  );

  let allNodes: ProxyNode[] = [];
  let totalErrors = 0;

  for (const result of results) {
    allNodes = allNodes.concat(result.nodes);
    totalErrors += result.errors.length;
  }

  // 全局去重
  allNodes = dedupeNodes(allNodes);

  logger.info(`Fetched ${allNodes.length} total nodes from ${providers.length} providers`);

  return {
    nodes: allNodes,
    results,
    totalErrors,
  };
}
