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
  'alter-id'?: number;
  /** Mihomo uses boolean true for tls */
  tls?: boolean | string;
  network?: string;
  /** legacy field name used by some providers */
  transport?: string;
  servername?: string;
  sni?: string;
  host?: string;
  path?: string;
  flow?: string;
  udp?: boolean;
  'udp-relay'?: boolean;
  'skip-cert-verify'?: boolean;
  'allow-insecure'?: boolean;
  'tls-fingerprint'?: string;
  'client-fingerprint'?: string;
  obfs?: string;
  'obfs-host'?: string;
  username?: string;
  'ws-opts'?: {
    path?: string;
    headers?: Record<string, string>;
  };
  'grpc-opts'?: {
    'grpc-service-name'?: string;
  };
  'h2-opts'?: {
    host?: string[];
    path?: string;
  };
  'reality-opts'?: {
    'public-key'?: string;
    'short-id'?: string;
    fingerprint?: string;
  };
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

    case 'vmess': {
      const wsOpts  = proxy['ws-opts']  ?? {};
      const grpcOpts = proxy['grpc-opts'] ?? {};
      const h2Opts  = proxy['h2-opts']  ?? {};
      // Clash YAML uses `network`, some old formats use `transport`
      const network = proxy.network || proxy.transport || 'tcp';
      // TLS for vmess is a boolean `true` in mihomo format
      const hasTls  = proxy.tls === true || proxy.tls === 'tls';
      // ws Host header > outer servername/sni/host fields
      const wsHost  =
        wsOpts.headers?.Host || wsOpts.headers?.host || '';
      const sniHost = proxy.servername || proxy.sni || proxy.host || '';
      return normalizeNode({
        ...baseNode,
        protocol: 'vmess',
        uuid: proxy.uuid || '',
        alterId: proxy['alter-id'] ?? proxy.alterId ?? 0,
        cipher: proxy.cipher || 'auto',
        tls: hasTls ? 'tls' : '',
        tlsInsecure: proxy['skip-cert-verify'] || proxy['allow-insecure'] || false,
        transport: network,
        host: wsHost || sniHost,
        path: wsOpts.path || (h2Opts.path as string | undefined) || proxy.path || '',
        serviceName: grpcOpts['grpc-service-name'] || '',
        udpRelay: proxy.udp === true || proxy['udp-relay'] === true,
        obfs: proxy.obfs || '',
        obfsHost: proxy['obfs-host'] || '',
      });
    }

    case 'trojan': {
      const wsOpts   = proxy['ws-opts']   ?? {};
      const grpcOpts  = proxy['grpc-opts']  ?? {};
      const network  = proxy.network || proxy.transport || 'tcp';
      return normalizeNode({
        ...baseNode,
        protocol: 'trojan',
        password: proxy.password || '',
        tls: 'tls',
        tlsInsecure: proxy['skip-cert-verify'] || proxy['allow-insecure'] || false,
        allowInsecure: proxy['skip-cert-verify'] || proxy['allow-insecure'] || false,
        host: proxy.sni || proxy.servername || proxy.host || '',
        transport: network,
        path: wsOpts.path || proxy.path || '',
        serviceName: grpcOpts['grpc-service-name'] || '',
        udpRelay: proxy.udp === true || proxy['udp-relay'] === true,
      });
    }

    case 'vless': {
      const wsOpts     = proxy['ws-opts']     ?? {};
      const grpcOpts    = proxy['grpc-opts']    ?? {};
      const h2Opts     = proxy['h2-opts']     ?? {};
      const realityOpts = proxy['reality-opts'] ?? {};
      // Reject nodes that declare reality-opts without the mandatory public-key
      if (proxy['reality-opts'] && !realityOpts['public-key']) {
        throw new Error(`VLESS node "${proxy.name}" has reality-opts but is missing public-key`);
      }
      const network    = proxy.network || proxy.transport || 'tcp';
      const hasTls     = proxy.tls === true || proxy.tls === 'tls';
      const wsHost     =
        wsOpts.headers?.Host || wsOpts.headers?.host || '';
      const sniHost    = proxy.servername || proxy.sni || proxy.host || '';
      return normalizeNode({
        ...baseNode,
        protocol: 'vless' as any,
        uuid: proxy.uuid || '',
        tls: hasTls ? 'tls' : '',
        tlsInsecure: proxy['skip-cert-verify'] || proxy['allow-insecure'] || false,
        transport: network,
        host: wsHost || sniHost,
        path: wsOpts.path || (h2Opts.path as string | undefined) || proxy.path || '',
        serviceName: grpcOpts['grpc-service-name'] || '',
        flow: proxy.flow || '',
        realityPublicKey:  realityOpts['public-key']  || '',
        realityShortId:    realityOpts['short-id']     || '',
        realityFingerprint: realityOpts['fingerprint'] || proxy['client-fingerprint'] || '',
        udpRelay: proxy.udp === true || proxy['udp-relay'] === true,
      });
    }

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
