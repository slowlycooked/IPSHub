import { ProxyNode } from '@/types/proxy';

/**
 * 解析 SS (Shadowsocks) URI
 * 格式: ss://method:password@host:port#name
 * 或: ss://base64(method:password)@host:port#name
 */
export function parseSsUri(uri: string, providerId?: string): ProxyNode {
  try {
    const url = new URL(uri);
    let method = '';
    let password = '';

    // 尝试直接读取用户信息
    if (url.username && url.password) {
      method = url.username;
      password = url.password;
    } else if (url.username) {
      // 尝试 base64 解码用户信息
      try {
        const decoded = Buffer.from(url.username, 'base64').toString('utf-8');
        const [m, p] = decoded.split(':');
        method = m;
        password = p;
      } catch {
        const [m, p] = url.username.split(':');
        method = m;
        password = p;
      }
    }

    const host = url.hostname || '';
    const port = parseInt(url.port) || 8388;
    const name = decodeURIComponent(url.hash.slice(1) || 'SS');

    if (!method || !password || !host) {
      throw new Error('Invalid SS URI: missing method, password, or host');
    }

    const node: ProxyNode = {
      name,
      protocol: 'ss',
      server: host,
      port,
      cipher: method,
      password,
      fingerprint: '',
      ...(providerId && { providerId }),
    };

    return node;
  } catch (error) {
    throw new Error(`Failed to parse SS URI: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
