import { parse as parseYaml } from 'yaml';
import { ProxyNode, ParseResult } from '@/types/proxy';
import { generateFingerprint, normalizeNode } from '@/core/merge/fingerprint';
import { createLogger } from '@/utils/logger';

const logger = createLogger('clash-parser');

interface ClashProxy {
  name?: string;
  type?: string;
  server?: string;
  port?: number;
  password?: string;
  cipher?: string;
  uuid?: string;
  alterId?: number;
  tls?: string;
  'tls-fingerprint'?: string;
  'tls-skip-cert-verify'?: boolean;
  'allow-insecure'?: boolean;
  transport?: string;
  host?: string;
  path?: string;
  obfs?: string;
  'obfs-host'?: string;
  'sni'?: string;
  'skip-cert-verify'?: boolean;
  username?: string;
  [key: string]: any;
}

/**
 * 解析 Clash YAML 格式的订阅
 */
export function parseClashYaml(content: string, providerId?: string): ParseResult {
  const nodes: ProxyNode[] = [];
  const errors: Array<{ raw: string; error: string }> = [];

  try {
    const doc = parseYaml(content);
    
    if (!doc || typeof doc !== 'object') {
      throw new Error('Invalid YAML structure');
    }

    const proxies = doc.proxies || doc.proxy || [];
    
    if (!Array.isArray(proxies)) {
      throw new Error('Proxies must be an array');
    }

    for (const proxy of proxies) {
      try {
        const node = parseClashProxy(proxy, providerId);
        if (node) {
          node.fingerprint = generateFingerprint(node);
          nodes.push(node);
        }
      } catch (error) {
        errors.push({
          raw: JSON.stringify(proxy),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.debug(`Parsed ${nodes.length} nodes from Clash YAML (${errors.length} errors)`);
  } catch (error) {
    logger.error('Failed to parse Clash YAML', error);
    errors.push({
      raw: content.substring(0, 100),
      error: error instanceof Error ? error.message : 'Failed to parse YAML',
    });
  }

  return { nodes, errors };
}

function parseClashProxy(proxy: ClashProxy, providerId?: string): ProxyNode | null {
  if (!proxy.name || !proxy.type) {
    return null;
  }

  const type = proxy.type.toLowerCase();
  const server = proxy.server || '';
  const port = proxy.port || 0;

  if (!server || !port) {
    return null;
  }

  const baseNode: ProxyNode = {
    name: proxy.name,
    protocol: 'ss', // default
    server,
    port,
    fingerprint: '',
    ...(providerId && { providerId }),
  };

  switch (type) {
    case 'ss':
      return normalizeNode({
        ...baseNode,
        protocol: 'ss',
        cipher: proxy.cipher || '',
        password: proxy.password || '',
        udpRelay: proxy['udp-relay'] === true || proxy['udp'] === true,
      });

    case 'vmess':
      return normalizeNode({
        ...baseNode,
        protocol: 'vmess',
        uuid: proxy.uuid || '',
        alterId: proxy.alterId || 0,
        tls: proxy.tls || proxy['tls-skip-cert-verify'] ? 'tls' : '',
        transport: proxy.transport || 'tcp',
        host: proxy.host || '',
        path: proxy.path || '',
        obfs: proxy.obfs || '',
        obfsHost: proxy['obfs-host'] || '',
      });

    case 'trojan':
      return normalizeNode({
        ...baseNode,
        protocol: 'trojan',
        password: proxy.password || '',
        tls: 'tls',
        allowInsecure: proxy['skip-cert-verify'] || proxy['allow-insecure'] || false,
        host: proxy.host || proxy.sni || '',
      });

    case 'vless':
      return normalizeNode({
        ...baseNode,
        protocol: 'vless' as any,
        uuid: proxy.uuid || '',
        tls: proxy.tls || proxy['tls-skip-cert-verify'] ? 'tls' : '',
        transport: proxy.transport || 'tcp',
        host: proxy.host || '',
        path: proxy.path || '',
      });

    case 'socks5':
    case 'http':
      return normalizeNode({
        ...baseNode,
        protocol: type as any,
        username: proxy.username || '',
        password: proxy.password || '',
      });

    default:
      return null;
  }
}
