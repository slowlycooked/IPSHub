import { createLogger } from '@/utils/logger';

const logger = createLogger('ssrf-guard');

/**
 * SSRF Guard - 防止服务器端请求伪造攻击
 * 检查 URL 是否为私有地址或潜在危险的地址
 */

const PRIVATE_IP_RANGES = [
  /^127\./, // 127.0.0.0/8 - Loopback
  /^10\./, // 10.0.0.0/8 - Private
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12 - Private
  /^192\.168\./, // 192.168.0.0/16 - Private
  /^169\.254\./, // 169.254.0.0/16 - Link Local
  /^224\./, // 224.0.0.0/4 - Multicast
  /^240\./, // 240.0.0.0/4 - Reserved
  /^0\./, // 0.0.0.0/8 - This Network
  /^255\./, // 255.255.255.255 - Broadcast
];

const PRIVATE_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
  'localhost.localdomain',
  '.local',
  '.internal',
  '.private',
];

export class SSRFGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SSRFGuardError';
  }
}

/**
 * 验证 URL 是否安全可访问
 * @param urlString 要验证的 URL
 * @param allowPrivate 是否允许私有 IP（用于开发环境）
 * @returns 验证是否通过
 * @throws SSRFGuardError 如果 URL 不安全
 */
export function validateUrl(urlString: string, allowPrivate = false): URL {
  let url: URL;
  
  try {
    url = new URL(urlString);
  } catch (error) {
    throw new SSRFGuardError(`Invalid URL: ${urlString}`);
  }

  // 检查协议
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new SSRFGuardError(`Invalid protocol: ${url.protocol}. Only http and https are allowed.`);
  }

  if (allowPrivate) {
    logger.warn(`SSRF check bypassed for URL: ${url.hostname} (dev mode)`);
    return url;
  }

  const hostname = url.hostname.toLowerCase();

  // 检查私有主机名
  if (PRIVATE_HOSTNAMES.some(h => 
    h.startsWith('.') ? hostname.endsWith(h) : hostname === h
  )) {
    throw new SSRFGuardError(`Private hostname not allowed: ${hostname}`);
  }

  // 检查 IPv6
  if (hostname.includes(':') && hostname.startsWith('[')) {
    const ipv6 = hostname.slice(1, -1).toLowerCase();
    if (ipv6 === '::1' || ipv6.startsWith('fe80:')) {
      throw new SSRFGuardError(`Private IPv6 address not allowed: ${ipv6}`);
    }
  }

  // 检查 IPv4
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    if (PRIVATE_IP_RANGES.some(range => range.test(hostname))) {
      throw new SSRFGuardError(`Private IP address not allowed: ${hostname}`);
    }
  }

  logger.debug(`URL validated: ${url.hostname}`);
  return url;
}

export interface FetchOptions {
  timeout?: number;
  maxSize?: number;
  allowPrivate?: boolean;
  userAgent?: string;
  headers?: Record<string, string>;
}

/**
 * 安全地获取远程订阅内容
 */
export async function safeFetch(
  urlString: string,
  options: FetchOptions = {}
): Promise<string> {
  const {
    timeout = 30000,
    maxSize = 10 * 1024 * 1024, // 10MB
    allowPrivate = false,
    userAgent = 'IPSHub/1.0',
    headers = {},
  } = options;

  const url = validateUrl(urlString, allowPrivate);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': userAgent,
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate',
        ...headers,
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > maxSize) {
      throw new Error(`Response too large: ${contentLength} bytes (max ${maxSize})`);
    }

    const data = await response.text();
    
    if (data.length > maxSize) {
      throw new Error(`Response body too large: ${data.length} bytes (max ${maxSize})`);
    }

    logger.debug(`Successfully fetched ${data.length} bytes from ${url.hostname}`);
    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(`Network error: unable to reach ${url.hostname}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
