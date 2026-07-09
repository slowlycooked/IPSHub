import { ProxyNode, ParseResult } from '@/types/proxy';
import { generateFingerprint } from '@/core/merge/fingerprint';
import { parseSsUri } from './parseSsUri';
import { parseVmessUri } from './parseVmessUri';
import { parseTrojanUri } from './parseTrojanUri';
import { createLogger } from '@/utils/logger';

const logger = createLogger('uri-list-parser');

/**
 * 检测内容是否为 base64 编码的 URI 列表
 */
function isBase64(str: string): boolean {
  try {
    const decoded = Buffer.from(str.trim(), 'base64').toString('utf-8');
    // 有效的 base64 应该能解码且包含有效的 URI
    return (
      /^[a-zA-Z0-9+/=\s]*$/.test(str.trim()) &&
      (decoded.includes('ss://') ||
        decoded.includes('vmess://') ||
        decoded.includes('trojan://') ||
        decoded.includes('vless://') ||
        decoded.includes('hysteria2://') ||
        decoded.includes('hy2://'))
    );
  } catch {
    return false;
  }
}

/**
 * 解析 URI 列表格式（可以是 base64 编码或纯文本）
 */
export function parseUriList(content: string, providerId?: string): ParseResult {
  const nodes: ProxyNode[] = [];
  const errors: Array<{ raw: string; error: string }> = [];

  let uriListContent = content;

  // 检测并解码 base64
  if (isBase64(content)) {
    try {
      uriListContent = Buffer.from(content.trim(), 'base64').toString('utf-8');
      logger.debug('Detected base64-encoded URI list');
    } catch (error) {
      errors.push({
        raw: content.substring(0, 100),
        error: 'Failed to decode base64',
      });
      return { nodes, errors };
    }
  }

  // 按行分割并解析每个 URI
  const lines = uriListContent
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  for (const uri of lines) {
    try {
      const node = parseUri(uri, providerId);
      if (node) {
        node.fingerprint = generateFingerprint(node);
        nodes.push(node);
      }
    } catch (error) {
      errors.push({
        raw: uri,
        error: error instanceof Error ? error.message : 'Failed to parse URI',
      });
    }
  }

  logger.debug(`Parsed ${nodes.length} nodes from URI list (${errors.length} errors)`);
  return { nodes, errors };
}

/**
 * 解析单个 URI
 */
function parseUri(uri: string, providerId?: string): ProxyNode | null {
  const trimmedUri = uri.trim();

  if (!trimmedUri) {
    return null;
  }

  try {
    if (trimmedUri.startsWith('ss://')) {
      return parseSsUri(trimmedUri, providerId);
    } else if (trimmedUri.startsWith('vmess://')) {
      return parseVmessUri(trimmedUri, providerId);
    } else if (trimmedUri.startsWith('trojan://')) {
      return parseTrojanUri(trimmedUri, providerId);
    } else if (trimmedUri.startsWith('vless://')) {
      return parseVlessUri(trimmedUri, providerId);
    } else if (trimmedUri.startsWith('hysteria2://') || trimmedUri.startsWith('hy2://')) {
      return parseHysteria2Uri(trimmedUri, providerId);
    } else {
      throw new Error(`Unsupported URI scheme: ${trimmedUri.split('://')[0]}`);
    }
  } catch (error) {
    throw error;
  }
}

/**
 * 解析 VLESS URI
 * 格式: vless://uuid@host:port?type=tcp&host=sni#name
 */
function parseVlessUri(uri: string, providerId?: string): ProxyNode {
  const url = new URL(uri);
  const uuid = url.username || '';
  const host = url.hostname || '';
  const port = parseInt(url.port) || 443;

  if (!uuid || !host || !port) {
    throw new Error('Invalid VLESS URI: missing uuid, host, or port');
  }

  const transport = url.searchParams.get('type') || url.searchParams.get('network') || 'tcp';
  const security = url.searchParams.get('security') || '';
  const tlsParam = url.searchParams.get('tls') || security || '';
  const sni = url.searchParams.get('sni') || url.searchParams.get('host') || '';
  const path = url.searchParams.get('path') || '';
  const grpcServiceName =
    url.searchParams.get('serviceName') || url.searchParams.get('grpc-service-name') || '';
  const flow = url.searchParams.get('flow') || undefined;
  const realityPublicKey =
    url.searchParams.get('pbk') || url.searchParams.get('public-key') || undefined;
  const realityShortId =
    url.searchParams.get('sid') || url.searchParams.get('short-id') || undefined;
  const realityFingerprint =
    url.searchParams.get('fp') || url.searchParams.get('fingerprint') || undefined;

  const name = decodeURIComponent(url.hash.slice(1) || 'VLESS');

  const node: ProxyNode = {
    name,
    protocol: 'vless' as any,
    server: host,
    port,
    uuid,
    tls: tlsParam || undefined,
    transport,
    host: sni,
    path: path,
    serviceName: grpcServiceName || undefined,
    flow,
    realityPublicKey,
    realityShortId,
    realityFingerprint,
    fingerprint: '',
    ...(providerId && { providerId }),
  };

  return node;
}

/**
 * 解析 Hysteria2 URI
 * 格式: hysteria2://password@host:port/?insecure=1&sni=sni&mport=60000-65530#name
 */
function parseHysteria2Uri(uri: string, providerId?: string): ProxyNode {
  const url = new URL(uri);
  const password = decodeURIComponent(url.username) || '';
  const host = url.hostname || '';
  const port = parseInt(url.port) || 443;

  if (!host || !port) {
    throw new Error('Invalid Hysteria2 URI: missing host or port');
  }

  const sni = url.searchParams.get('sni') || '';
  const insecure = url.searchParams.get('insecure') === '1';
  const mport = url.searchParams.get('mport') || undefined;
  const obfsPassword =
    url.searchParams.get('obfs-password') ||
    url.searchParams.get('salamander-password') ||
    undefined;
  const fastOpen = url.searchParams.get('tfo') || url.searchParams.get('fast-open');
  const name = decodeURIComponent(url.hash.slice(1) || 'Hysteria2');
  const extraData: Record<string, unknown> = {};
  if (mport) {
    extraData.mport = mport;
  }
  if (obfsPassword) {
    extraData['obfs-password'] = obfsPassword;
  }
  if (fastOpen !== null) {
    extraData.tfo = fastOpen === '1' || fastOpen.toLowerCase() === 'true';
  }

  const node: ProxyNode = {
    name,
    protocol: 'hysteria2' as any,
    server: host,
    port,
    password,
    tls: 'tls',
    tlsInsecure: insecure,
    host: sni || undefined,
    fingerprint: '',
    ...(Object.keys(extraData).length > 0 && { extraData }),
    ...(providerId && { providerId }),
  };

  return node;
}
