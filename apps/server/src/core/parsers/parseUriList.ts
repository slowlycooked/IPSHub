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
    return /^[a-zA-Z0-9+/=\s]*$/.test(str.trim()) && 
           (decoded.includes('ss://') || decoded.includes('vmess://') || decoded.includes('trojan://') || decoded.includes('vless://'));
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
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));

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

  const transport = url.searchParams.get('type') || 'tcp';
  const tlsParam = url.searchParams.get('tls') || url.searchParams.get('security') || '';
  const sni = url.searchParams.get('host') || url.searchParams.get('sni') || '';
  const path = url.searchParams.get('path') || '';

  const name = decodeURIComponent(url.hash.slice(1) || 'VLESS');

  const node: ProxyNode = {
    name,
    protocol: 'vless' as any,
    server: host,
    port,
    uuid,
    tls: tlsParam || 'tls',
    transport,
    host: sni,
    path: path,
    fingerprint: '',
    ...(providerId && { providerId }),
  };

  return node;
}
