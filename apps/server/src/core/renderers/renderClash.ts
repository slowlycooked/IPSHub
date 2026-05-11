import { ProxyNode } from '@/types/proxy';
import { stringify as stringifyYaml } from 'yaml';
import { nodeToMihomoProxy } from './mihomoProxy';

const CLASH_SUPPORTED_PROTOCOLS = new Set(['ss', 'vmess', 'trojan', 'vless', 'socks5', 'http']);

/**
 * 将节点渲染为 Clash YAML 格式
 */
export function renderClash(nodes: ProxyNode[]): string {
  const clashNodes = nodes.filter((node) => CLASH_SUPPORTED_PROTOCOLS.has(node.protocol));
  const proxies = clashNodes
    .map((node) => nodeToMihomoProxy(node))
    .filter((proxy): proxy is Record<string, unknown> => proxy !== null);

  if (proxies.length === 0) {
    throw new Error('No supported nodes available for this profile');
  }

  const proxyNames = clashNodes.map((n) => n.name);
  const groupProxyNames = [...proxyNames, 'DIRECT'];

  const config = {
    port: 7890,
    'socks-port': 7891,
    'allow-lan': false,
    mode: 'rule',
    'log-level': 'info',
    'external-controller': '127.0.0.1:9090',
    proxies,
    'proxy-groups': [
      {
        name: 'Proxy',
        type: 'select',
        proxies: groupProxyNames,
      },
      {
        name: 'Auto Select',
        type: 'url-test',
        proxies: proxyNames,
        url: 'https://www.gstatic.com/generate_204',
        interval: 300,
      },
    ],
    rules: ['MATCH,Proxy'],
  };

  // 使用 YAML 格式输出
  return stringifyYaml(config);
}
