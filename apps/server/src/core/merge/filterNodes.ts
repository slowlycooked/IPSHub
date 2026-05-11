import { ProxyNode } from '@/types/proxy';
import { generateFingerprint, mergeNodes } from './fingerprint';

/**
 * 去重节点
 * 如果多个节点有相同的指纹，保留最优的那个
 */
export function dedupeNodes(nodes: ProxyNode[]): ProxyNode[] {
  const seen = new Map<string, ProxyNode>();

  for (const node of nodes) {
    const fp = node.fingerprint || generateFingerprint(node);
    
    if (seen.has(fp)) {
      const existing = seen.get(fp)!;
      // 如果找到重复，合并两个节点
      seen.set(fp, mergeNodes(existing, node));
    } else {
      seen.set(fp, { ...node, fingerprint: fp });
    }
  }

  return Array.from(seen.values());
}

/**
 * 按协议类型过滤节点
 */
export function filterByProtocol(
  nodes: ProxyNode[],
  protocols: string[]
): ProxyNode[] {
  if (!protocols || protocols.length === 0) {
    return nodes;
  }

  const allowed = new Set(protocols.map(p => p.toLowerCase()));
  return nodes.filter(node => allowed.has(node.protocol.toLowerCase()));
}

/**
 * 按 Provider 过滤节点
 */
export function filterByProvider(
  nodes: ProxyNode[],
  providerIds: string[]
): ProxyNode[] {
  if (!providerIds || providerIds.length === 0) {
    return nodes;
  }

  const allowed = new Set(providerIds);
  return nodes.filter(node => !node.providerId || allowed.has(node.providerId));
}

/**
 * 按名称或标签过滤（正则表达式）
 */
export function filterByNamePattern(
  nodes: ProxyNode[],
  patterns: Array<{ include?: string; exclude?: string }>
): ProxyNode[] {
  return nodes.filter(node => {
    // 所有 include 规则都要匹配（如果有的话）
    for (const pattern of patterns) {
      if (pattern.include) {
        const regex = new RegExp(pattern.include, 'i');
        if (!regex.test(node.name)) {
          return false;
        }
      }
    }

    // 所有 exclude 规则都要不匹配（如果有的话）
    for (const pattern of patterns) {
      if (pattern.exclude) {
        const regex = new RegExp(pattern.exclude, 'i');
        if (regex.test(node.name)) {
          return false;
        }
      }
    }

    return true;
  });
}

/**
 * 按关键词过滤节点
 */
export function filterByKeywords(
  nodes: ProxyNode[],
  includeKeywords: string[],
  excludeKeywords: string[]
): ProxyNode[] {
  return nodes.filter(node => {
    const name = node.name.toLowerCase();

    // 检查包含关键词
    if (includeKeywords.length > 0) {
      const hasIncluded = includeKeywords.some(keyword =>
        name.includes(keyword.toLowerCase())
      );
      if (!hasIncluded) return false;
    }

    // 检查排除关键词
    if (excludeKeywords.length > 0) {
      const hasExcluded = excludeKeywords.some(keyword =>
        name.includes(keyword.toLowerCase())
      );
      if (hasExcluded) return false;
    }

    return true;
  });
}

/**
 * 组合多个过滤条件（AND 逻辑）
 */
export interface FilterOptions {
  protocols?: string[];
  providerIds?: string[];
  includePatterns?: Array<{ include?: string; exclude?: string }>;
  includeKeywords?: string[];
  excludeKeywords?: string[];
  enabled?: boolean;
}

export function applyFilters(nodes: ProxyNode[], options: FilterOptions): ProxyNode[] {
  let result = [...nodes];

  if (options.protocols) {
    result = filterByProtocol(result, options.protocols);
  }

  if (options.providerIds) {
    result = filterByProvider(result, options.providerIds);
  }

  if (options.includePatterns) {
    result = filterByNamePattern(result, options.includePatterns);
  }

  if (options.includeKeywords || options.excludeKeywords) {
    result = filterByKeywords(
      result,
      options.includeKeywords || [],
      options.excludeKeywords || []
    );
  }

  if (options.enabled !== undefined) {
    result = result.filter(node => 
      options.enabled === undefined || node.enabled === options.enabled
    );
  }

  return result;
}
