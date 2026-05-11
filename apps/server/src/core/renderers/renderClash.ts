import { ProxyNode } from '@/types/proxy';
import { stringify as stringifyYaml } from 'yaml';

const CLASH_SUPPORTED_PROTOCOLS = new Set(['ss', 'vmess', 'trojan', 'socks5', 'http']);

/**
 * 将节点渲染为 Clash YAML 格式
 */
export function renderClash(nodes: ProxyNode[]): string {
  const clashNodes = nodes.filter((node) => CLASH_SUPPORTED_PROTOCOLS.has(node.protocol));
  const proxies = clashNodes.map(nodeToClashProxy);
  const proxyNames = clashNodes.map((n) => n.name);
  const groupProxyNames = proxyNames.length > 0 ? [...proxyNames, 'DIRECT'] : ['DIRECT'];

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
        proxies: proxyNames.length > 0 ? proxyNames : ['DIRECT'],
        url: 'https://www.gstatic.com/generate_204',
        interval: 300,
      },
    ],
    rules: ['MATCH,Proxy'],
  };

  // 使用 YAML 格式输出
  return stringifyYaml(config);
}

/**
 * 将单个节点转换为 Clash 代理配置
 */
function nodeToClashProxy(node: ProxyNode): any {
  const proxy: any = {
    name: node.name,
    type: node.protocol,
    server: node.server,
    port: node.port,
  };

  switch (node.protocol) {
    case 'ss':
      proxy.cipher = node.cipher || 'aes-256-gcm';
      proxy.password = node.password;
      proxy.udp = node.udpRelay ?? true;
      break;

    case 'vmess':
      proxy.uuid = node.uuid;
      proxy.alterId = node.alterId || 0;
      proxy.cipher = 'auto';
      proxy.udp = true;
      if (node.tls) {
        proxy.tls = true;
        if (node.host) {
          proxy.servername = node.host;
        }
      }
      if (node.transport && node.transport !== 'tcp') {
        proxy.network = node.transport;
        if (node.transport === 'ws') {
          proxy['ws-opts'] = {
            path: node.path || '/',
            headers: node.host ? { Host: node.host } : {},
          };
        }
      }
      break;

    case 'trojan':
      proxy.password = node.password;
      proxy.udp = true;
      if (node.host) {
        proxy.sni = node.host;
      }
      if (node.allowInsecure) {
        proxy['skip-cert-verify'] = true;
      }
      break;

    case 'socks5':
    case 'http':
      if (node.username) {
        proxy.username = node.username;
        proxy.password = node.password;
      }
      break;
  }

  return proxy;
}
