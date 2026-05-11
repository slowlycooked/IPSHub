import { ProxyNode } from '@/types/proxy';

/**
 * 解析 Vmess URI
 * 格式: vmess://base64(config)#name
 * config 是 JSON: {
 *   "v": "2",
 *   "ps": "name",
 *   "add": "host",
 *   "port": 443,
 *   "id": "uuid",
 *   "aid": 0,
 *   "net": "tcp/ws",
 *   "type": "none",
 *   "host": "sni",
 *   "path": "/path",
 *   "tls": "tls/none",
 *   "alpn": "h2,http/1.1"
 * }
 */
export function parseVmessUri(uri: string, providerId?: string): ProxyNode {
  try {
    const url = new URL(uri);
    const encodedConfig = url.hostname + url.pathname.substring(1);
    
    let config: any;
    try {
      const decoded = Buffer.from(encodedConfig, 'base64').toString('utf-8');
      config = JSON.parse(decoded);
    } catch {
      throw new Error('Failed to decode or parse base64 config');
    }

    const {
      ps: name = 'Vmess',
      add: host = '',
      port = 443,
      id: uuid = '',
      aid: alterId = 0,
      net: transport = 'tcp',
      host: sni = '',
      path = '',
      tls = '',
    } = config;

    if (!host || !uuid) {
      throw new Error('Missing required fields: host or uuid');
    }

    const node: ProxyNode = {
      name: decodeURIComponent(name),
      protocol: 'vmess',
      server: host,
      port,
      uuid,
      alterId: parseInt(alterId) || 0,
      transport: transport || 'tcp',
      tls: tls || 'tls',
      host: sni || '',
      path: path || '',
      fingerprint: '',
      ...(providerId && { providerId }),
    };

    return node;
  } catch (error) {
    throw new Error(`Failed to parse Vmess URI: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
