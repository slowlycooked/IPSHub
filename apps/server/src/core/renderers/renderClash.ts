import { ProxyNode } from '@/types/proxy';
import { stringify as stringifyYaml } from 'yaml';

/**
 * 将节点渲染为 Clash YAML 格式
 */
export function renderClash(nodes: ProxyNode[]): string {
  const proxies = nodes.map(nodeToClashProxy);

  const config = {
    proxies,
    'proxy-groups': [
      {
        name: 'Proxy',
        type: 'select',
        proxies: nodes.map(n => n.name),
      },
      {
        name: 'Auto Select',
        type: 'url-test',
        proxies: nodes.map(n => n.name),
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
      if (node.udpRelay !== undefined) {
        proxy['udp'] = node.udpRelay;
      }
      break;

    case 'vmess':
      proxy.uuid = node.uuid;
      proxy.alterId = node.alterId || 0;
      proxy.cipher = 'auto';
      if (node.tls) {
        proxy.tls = true;
        proxy['tls-hostname'] = node.host || '';
      }
      if (node.transport && node.transport !== 'tcp') {
        proxy.network = node.transport;
        if (node.host) proxy.host = node.host;
        if (node.path) proxy.path = node.path;
      }
      break;

    case 'trojan':
      proxy.password = node.password;
      if (node.host) {
        proxy['sni'] = node.host;
      }
      if (node.allowInsecure) {
        proxy['skip-cert-verify'] = true;
      }
      break;

    case 'vless':
      proxy.uuid = node.uuid;
      if (node.tls) {
        proxy.tls = true;
      }
      if (node.transport) {
        proxy.network = node.transport;
      }
      if (node.host) {
        proxy['tls-hostname'] = node.host;
      }
      if (node.path) {
        proxy.path = node.path;
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
