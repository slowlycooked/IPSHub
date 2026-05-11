import { ProxyNode } from '@/types/proxy';

/**
 * 将节点渲染为 Raw URI 格式
 * 输出 Base64 编码的 URI 列表
 */
export function renderRaw(nodes: ProxyNode[], base64 = true): string {
  const uriList = nodes
    .map(nodeToUri)
    .filter(Boolean)
    .join('\n');

  if (base64) {
    return Buffer.from(uriList).toString('base64');
  }

  return uriList;
}

function nodeToUri(node: ProxyNode): string | null {
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
