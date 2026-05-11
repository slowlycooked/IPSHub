import { ProxyNode } from '@/types/proxy';

/**
 * 将节点渲染为 Loon 格式
 * Loon 使用 URI 格式，每行一个节点
 */
export function renderLoon(nodes: ProxyNode[]): string {
  return nodes
    .map(nodeToLoonUri)
    .filter(Boolean)
    .join('\n');
}

function nodeToLoonUri(node: ProxyNode): string | null {
  switch (node.protocol) {
    case 'ss': {
      const cipher = node.cipher || 'aes-256-gcm';
      const password = encodeURIComponent(node.password || '');
      return `ss://${cipher}:${password}@${node.server}:${node.port}#${encodeURIComponent(node.name)}`;
    }

    case 'vmess': {
      const config = {
        v: '2',
        ps: node.name,
        add: node.server,
        port: node.port,
        id: node.uuid,
        aid: node.alterId || 0,
        net: node.transport || 'tcp',
        type: 'none',
        host: node.host || '',
        path: node.path || '',
        tls: node.tls ? 'tls' : 'none',
      };
      const encoded = Buffer.from(JSON.stringify(config)).toString('base64');
      return `vmess://${encoded}`;
    }

    case 'trojan': {
      const password = encodeURIComponent(node.password || '');
      const sni = node.host || node.server;
      return `trojan://${password}@${node.server}:${node.port}?sni=${sni}#${encodeURIComponent(node.name)}`;
    }

    case 'vless': {
      const uuid = node.uuid || '';
      const base = `vless://${uuid}@${node.server}:${node.port}`;
      const params = new URLSearchParams();
      if (node.transport) params.append('type', node.transport);
      if (node.host) params.append('host', node.host);
      if (node.path) params.append('path', node.path);
      if (node.tls) params.append('tls', 'tls');
      const hash = encodeURIComponent(node.name);
      return `${base}?${params.toString()}#${hash}`;
    }

    default:
      return null;
  }
}
