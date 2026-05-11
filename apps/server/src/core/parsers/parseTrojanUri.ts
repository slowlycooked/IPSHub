import { ProxyNode } from '@/types/proxy';

/**
 * 解析 Trojan URI
 * 格式: trojan://password@host:port?sni=sni#name
 */
export function parseTrojanUri(uri: string, providerId?: string): ProxyNode {
  try {
    const url = new URL(uri);
    const password = url.username || '';
    const host = url.hostname || '';
    const port = parseInt(url.port) || 443;
    const sni = url.searchParams.get('sni') || '';
    const skipVerify = url.searchParams.get('skip-cert-verify') === 'true' || 
                       url.searchParams.get('allowInsecure') === 'true';
    const name = decodeURIComponent(url.hash.slice(1) || 'Trojan');

    if (!password || !host) {
      throw new Error('Invalid Trojan URI: missing password or host');
    }

    const node: ProxyNode = {
      name,
      protocol: 'trojan',
      server: host,
      port,
      password,
      tls: 'tls',
      allowInsecure: skipVerify,
      host: sni || host,
      fingerprint: '',
      ...(providerId && { providerId }),
    };

    return node;
  } catch (error) {
    throw new Error(`Failed to parse Trojan URI: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
