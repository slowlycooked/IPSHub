/**
 * 脱敏工具 — 日志、API 响应、debug package 中不得明文输出敏感信息
 */

/** 对 UUID 脱敏：保留前4位和后4位 */
export function sanitizeUuid(value: string | undefined | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return '****';
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

/** 对 password / token 脱敏：保留前4位和后3位 */
export function sanitizeSecret(value: string | undefined | null): string | null {
  if (!value) return null;
  if (value.length <= 7) return '****';
  return `${value.slice(0, 4)}******${value.slice(-3)}`;
}

/** 对 URL 脱敏：隐藏 query 参数中的 token */
export function sanitizeUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    parsed.searchParams.forEach((_val, key) => {
      parsed.searchParams.set(key, '****');
    });
    return parsed.toString();
  } catch {
    return url.replace(/([?&][^=]+=)[^&]*/g, '$1****');
  }
}

/** 对 Reality public_key / short_id 脱敏：保留前6位 */
export function sanitizeKey(value: string | undefined | null): string | null {
  if (!value) return null;
  if (value.length <= 6) return '****';
  return `${value.slice(0, 6)}****`;
}

/**
 * 对任意字段值进行通用脱敏，根据字段名选择策略
 */
export function sanitizeSensitiveValue(fieldName: string, value: unknown): unknown {
  if (value === undefined || value === null) return value;

  const lower = fieldName.toLowerCase();

  if (lower.includes('uuid')) return sanitizeUuid(String(value));
  if (lower.includes('password') || lower.includes('token') || lower.includes('secret')) {
    return sanitizeSecret(String(value));
  }
  if (lower.includes('public_key') || lower.includes('publickey') || lower.includes('short_id')) {
    return sanitizeKey(String(value));
  }
  if (lower.includes('url') || lower.includes('subscription')) {
    return sanitizeUrl(String(value));
  }

  return value;
}

/** 对 ProxyNode-like 对象进行完整脱敏，返回可安全输出的副本 */
export function sanitizeNodeConfig(node: Record<string, unknown>): Record<string, unknown> {
  const SENSITIVE_FIELDS = new Set([
    'uuid', 'password', 'token', 'realityPublicKey', 'realityShortId',
    'realityFingerprint', 'subscriptionUrl', 'url',
  ]);

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(node)) {
    if (SENSITIVE_FIELDS.has(key)) {
      result[key] = sanitizeSensitiveValue(key, val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

/** 对任意 JSON-serializable 对象递归脱敏 */
export function sanitizeJson(obj: unknown, depth = 0): unknown {
  if (depth > 6) return obj;
  if (obj === null || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeJson(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    const lower = key.toLowerCase();
    if (
      lower.includes('uuid') ||
      lower.includes('password') ||
      lower.includes('token') ||
      lower.includes('secret') ||
      lower.includes('public_key') ||
      lower.includes('publickey') ||
      lower.includes('private') ||
      lower.includes('short_id')
    ) {
      result[key] = sanitizeSensitiveValue(key, val);
    } else if (lower.includes('url') && typeof val === 'string') {
      result[key] = sanitizeUrl(val);
    } else if (typeof val === 'object' && val !== null) {
      result[key] = sanitizeJson(val, depth + 1);
    } else {
      result[key] = val;
    }
  }
  return result;
}
