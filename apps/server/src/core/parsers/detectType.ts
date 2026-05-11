import { ParseResult } from '@/types/proxy';
import { parseClashYaml } from './parseClashYaml';
import { parseUriList } from './parseUriList';
import { createLogger } from '@/utils/logger';

const logger = createLogger('detect-type');

export enum SubscriptionFormat {
  CLASH_YAML = 'clash',
  BASE64_URI = 'base64-uri',
  URI_LIST = 'uri-list',
  UNKNOWN = 'unknown',
}

/**
 * 检测订阅内容的格式
 */
export function detectFormat(content: string): SubscriptionFormat {
  const trimmed = content.trim();

  // 检测 Clash YAML
  if (isClashYaml(trimmed)) {
    return SubscriptionFormat.CLASH_YAML;
  }

  // 检测 Base64 URI List
  if (isBase64UriList(trimmed)) {
    return SubscriptionFormat.BASE64_URI;
  }

  // 检测纯文本 URI List
  if (isPlainUriList(trimmed)) {
    return SubscriptionFormat.URI_LIST;
  }

  return SubscriptionFormat.UNKNOWN;
}

/**
 * 检测是否为 Clash YAML 格式
 */
function isClashYaml(content: string): boolean {
  // 检查是否包含 'proxies:' 或 'proxy:' 和 YAML 结构
  return /^\s*(proxies|proxy|version):/m.test(content) &&
         /[\w\s]*:[\w\s]+/.test(content);
}

/**
 * 检测是否为 Base64 编码的 URI List
 */
function isBase64UriList(content: string): boolean {
  if (!/^[a-zA-Z0-9+/=\s]*$/.test(content.trim())) {
    return false;
  }

  try {
    const decoded = Buffer.from(content.trim(), 'base64').toString('utf-8');
    return isPlainUriList(decoded);
  } catch {
    return false;
  }
}

/**
 * 检测是否为纯文本 URI List
 */
function isPlainUriList(content: string): boolean {
  const uriPatterns = [
    /ss:\/\//,
    /vmess:\/\//,
    /trojan:\/\//,
    /vless:\/\//,
  ];

  return uriPatterns.some(pattern => pattern.test(content));
}

/**
 * 自动检测并解析订阅内容
 */
export function parseSubscription(
  content: string,
  providerId?: string,
  preferredFormat?: SubscriptionFormat
): ParseResult {
  const format = preferredFormat || detectFormat(content);

  logger.debug(`Parsing subscription with format: ${format}`);

  switch (format) {
    case SubscriptionFormat.CLASH_YAML:
      return parseClashYaml(content, providerId);

    case SubscriptionFormat.BASE64_URI:
    case SubscriptionFormat.URI_LIST:
      return parseUriList(content, providerId);

    default:
      // 尝试所有解析器
      const results: ParseResult[] = [
        parseClashYaml(content, providerId),
        parseUriList(content, providerId),
      ];

      // 返回找到节点最多的结果
      return results.reduce((best, current) => 
        current.nodes.length > best.nodes.length ? current : best
      );
  }
}
