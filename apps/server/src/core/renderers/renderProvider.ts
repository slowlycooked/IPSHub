import { ProxyNode } from '@/types/proxy';
import { stringify as stringifyYaml } from 'yaml';
import { nodeToMihomoProxy } from './mihomoProxy';

/**
 * 将节点渲染为 Clash Provider YAML 格式
 * 只包含 proxies 部分，用于 proxy-provider
 */
export function renderProvider(nodes: ProxyNode[]): string {
  const proxies = nodes
    .map((node) => nodeToMihomoProxy(node))
    .filter((proxy): proxy is Record<string, unknown> => proxy !== null);

  const config = {
    proxies,
  };

  return stringifyYaml(config);
}
