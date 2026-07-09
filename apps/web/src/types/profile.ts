export type OutputType = 'clash' | 'clash_provider' | 'loon' | 'raw';

export type ClashMode = 'rule' | 'global' | 'direct';
export type ClashLogLevel = 'silent' | 'error' | 'warning' | 'info' | 'debug';
export type ClashProfileTarget =
  | 'clash-legacy'
  | 'clash-verge-rev'
  | 'mihomo'
  | 'clash-meta'
  | 'sing-box';
export type ProxyGroupType = 'select' | 'url-test' | 'fallback' | 'load-balance';

export type ProxyGroupSource =
  | { type: 'all' }
  | { type: 'manual'; proxies: string[] }
  | { type: 'region'; keywords: string[] }
  | { type: 'tag'; tags: string[] }
  | { type: 'regex'; pattern: string };

export interface ProxyGroupConfig {
  name: string;
  type: ProxyGroupType;
  source: ProxyGroupSource;
  includeDirect?: boolean;
  includeReject?: boolean;
  includeGroups?: string[];
  url?: string;
  interval?: number;
  timeout?: number;
}

export interface RuleConfig {
  type: string;
  value?: string;
  policy: string;
  noResolve?: boolean;
}

export interface ClashGeneralConfig {
  mode?: ClashMode;
  logLevel?: ClashLogLevel;
  allowLan?: boolean;
  ipv6?: boolean;
}

export interface ClashConfig {
  target?: ClashProfileTarget;
  general?: ClashGeneralConfig;
  proxyGroups: ProxyGroupConfig[];
  ruleProviders?: Record<string, unknown>;
  rules: RuleConfig[];
  fallbackPolicy?: string;
}

export interface Profile {
  id: string;
  name: string;
  description?: string;
  output_format: OutputType;
  include_protocols?: string[];
  exclude_keywords?: string[];
  clash_config?: ClashConfig;
  access_count: number;
  last_accessed_at?: number;
  token?: string;
  updated_at: number;
  created_at: number;
}

export interface ProfileUrls {
  clash: string;
  loon: string;
  raw: string;
  provider: string;
}
