import { ProxyNode } from '@/types/proxy';
import {
  ClashConfig,
  ProxyGroupConfig,
  ProxyGroupSource,
  RuleConfig,
} from '@/types/clashConfig';
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';
import { nodeToMihomoProxy } from './mihomoProxy';
import { createLogger } from '@/utils/logger';

const logger = createLogger('render-clash-profile');

const CLASH_SUPPORTED_PROTOCOLS = new Set([
  'ss', 'vmess', 'trojan', 'vless', 'socks5', 'http', 'hysteria2',
]);

const DEFAULT_PROXY_POLICY = '🚀 节点选择';
const LOYALSOLDIER_RULESET_BASE_URL =
  'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release';

function buildLoyalsoldierRuleProvider(
  name: string,
  behavior: 'domain' | 'ipcidr' | 'classical'
): Record<string, unknown> {
  return {
    type: 'http',
    behavior,
    url: `${LOYALSOLDIER_RULESET_BASE_URL}/${name}.txt`,
    path: `./ruleset/${name}.yaml`,
    interval: 86400,
  };
}

const LEGACY_DEFAULT_RULES: RuleConfig[] = [
  { type: 'DOMAIN-SUFFIX', value: 'local', policy: 'DIRECT' },
  { type: 'IP-CIDR', value: '127.0.0.0/8', policy: 'DIRECT', noResolve: true },
  { type: 'IP-CIDR', value: '10.0.0.0/8', policy: 'DIRECT', noResolve: true },
  { type: 'IP-CIDR', value: '172.16.0.0/12', policy: 'DIRECT', noResolve: true },
  { type: 'IP-CIDR', value: '192.168.0.0/16', policy: 'DIRECT', noResolve: true },
  { type: 'GEOIP', value: 'CN', policy: 'DIRECT', noResolve: true },
  { type: 'MATCH', policy: DEFAULT_PROXY_POLICY },
];

function rulesEqual(left: RuleConfig[], right: RuleConfig[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((rule, index) => {
    const other = right[index];
    return (
      rule.type === other.type &&
      rule.value === other.value &&
      rule.policy === other.policy &&
      Boolean(rule.noResolve) === Boolean(other.noResolve)
    );
  });
}

function withLoyalsoldierRulesForLegacyDefault(config: ClashConfig): ClashConfig {
  if (config.ruleProviders && Object.keys(config.ruleProviders).length > 0) {
    return config;
  }

  if (!rulesEqual(config.rules, LEGACY_DEFAULT_RULES)) {
    return config;
  }

  const defaults = buildDefaultClashConfig();
  return {
    ...config,
    ruleProviders: defaults.ruleProviders,
    rules: defaults.rules,
  };
}

/**
 * Build the default Clash config template used when a profile has no clashConfig.
 */
export function buildDefaultClashConfig(): ClashConfig {
  return {
    general: {
      mode: 'rule',
      logLevel: 'info',
      allowLan: false,
      ipv6: false,
    },
    proxyGroups: [
      {
        name: DEFAULT_PROXY_POLICY,
        type: 'select',
        source: { type: 'all' },
        includeDirect: true,
        includeGroups: ['♻️ 自动选择', '🇭🇰 香港自动', '🇯🇵 日本自动', '🇺🇸 美国自动'],
      },
      {
        name: '♻️ 自动选择',
        type: 'url-test',
        source: { type: 'all' },
        url: 'https://www.gstatic.com/generate_204',
        interval: 300,
        timeout: 5000,
      },
      {
        name: '🇭🇰 香港自动',
        type: 'url-test',
        source: { type: 'region', keywords: ['香港', 'HK', 'Hong Kong'] },
        url: 'https://www.gstatic.com/generate_204',
        interval: 300,
        timeout: 5000,
      },
      {
        name: '🇯🇵 日本自动',
        type: 'url-test',
        source: { type: 'region', keywords: ['日本', 'JP', 'Japan'] },
        url: 'https://www.gstatic.com/generate_204',
        interval: 300,
        timeout: 5000,
      },
      {
        name: '🇺🇸 美国自动',
        type: 'url-test',
        source: { type: 'region', keywords: ['美国', 'US', 'United States'] },
        url: 'https://www.gstatic.com/generate_204',
        interval: 300,
        timeout: 5000,
      },
    ],
    ruleProviders: {
      reject: buildLoyalsoldierRuleProvider('reject', 'domain'),
      icloud: buildLoyalsoldierRuleProvider('icloud', 'domain'),
      apple: buildLoyalsoldierRuleProvider('apple', 'domain'),
      google: buildLoyalsoldierRuleProvider('google', 'domain'),
      proxy: buildLoyalsoldierRuleProvider('proxy', 'domain'),
      direct: buildLoyalsoldierRuleProvider('direct', 'domain'),
      private: buildLoyalsoldierRuleProvider('private', 'domain'),
      gfw: buildLoyalsoldierRuleProvider('gfw', 'domain'),
      'tld-not-cn': buildLoyalsoldierRuleProvider('tld-not-cn', 'domain'),
      telegramcidr: buildLoyalsoldierRuleProvider('telegramcidr', 'ipcidr'),
      cncidr: buildLoyalsoldierRuleProvider('cncidr', 'ipcidr'),
      lancidr: buildLoyalsoldierRuleProvider('lancidr', 'ipcidr'),
      applications: buildLoyalsoldierRuleProvider('applications', 'classical'),
    },
    rules: [
      { type: 'RULE-SET', value: 'applications', policy: 'DIRECT' },
      { type: 'DOMAIN', value: 'clash.razord.top', policy: 'DIRECT' },
      { type: 'DOMAIN', value: 'yacd.haishan.me', policy: 'DIRECT' },
      { type: 'RULE-SET', value: 'private', policy: 'DIRECT' },
      { type: 'RULE-SET', value: 'reject', policy: 'REJECT' },
      { type: 'RULE-SET', value: 'icloud', policy: 'DIRECT' },
      { type: 'RULE-SET', value: 'apple', policy: 'DIRECT' },
      { type: 'RULE-SET', value: 'google', policy: DEFAULT_PROXY_POLICY },
      { type: 'RULE-SET', value: 'proxy', policy: DEFAULT_PROXY_POLICY },
      { type: 'RULE-SET', value: 'direct', policy: 'DIRECT' },
      { type: 'RULE-SET', value: 'lancidr', policy: 'DIRECT' },
      { type: 'RULE-SET', value: 'cncidr', policy: 'DIRECT' },
      { type: 'RULE-SET', value: 'telegramcidr', policy: DEFAULT_PROXY_POLICY },
      { type: 'GEOIP', value: 'LAN', policy: 'DIRECT', noResolve: true },
      { type: 'GEOIP', value: 'CN', policy: 'DIRECT', noResolve: true },
      { type: 'MATCH', policy: DEFAULT_PROXY_POLICY },
    ],
  };
}

/**
 * Resolve the proxy names belonging to a proxy group based on its source selector.
 */
export function resolveGroupProxies(
  source: ProxyGroupSource,
  proxyNames: string[],
  nodes: ProxyNode[]
): string[] {
  switch (source.type) {
    case 'all':
      return [...proxyNames];

    case 'manual':
      return source.proxies.filter((p) => proxyNames.includes(p));

    case 'region': {
      const keywords = source.keywords.map((k) => k.toLowerCase());
      return proxyNames.filter((name) =>
        keywords.some((kw) => name.toLowerCase().includes(kw))
      );
    }

    case 'tag': {
      const tags = source.tags.map((t) => t.toLowerCase());
      const nodesByName = new Map(nodes.map((n) => [n.name, n]));
      return proxyNames.filter((name) => {
        const node = nodesByName.get(name);
        if (!node?.tag) return false;
        return tags.some((t) => node.tag!.toLowerCase().includes(t));
      });
    }

    case 'regex': {
      let re: RegExp;
      try {
        re = new RegExp(source.pattern, 'i');
      } catch {
        logger.warn(`Invalid regex pattern in proxy group source: "${source.pattern}"`);
        return [];
      }
      return proxyNames.filter((name) => re.test(name));
    }

    default:
      return [];
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a ClashConfig before rendering.
 * Returns a list of human-readable errors; empty array means valid.
 */
export function validateClashConfig(
  config: ClashConfig,
  proxyNames: string[],
  nodes: ProxyNode[]
): ValidationResult {
  const errors: string[] = [];

  // 1. Proxy group names must be unique
  const groupNames = config.proxyGroups.map((g) => g.name);
  if (new Set(groupNames).size !== groupNames.length) {
    errors.push('Proxy group names must be unique');
  }

  const validPolicies = new Set<string>([
    'DIRECT',
    'REJECT',
    ...proxyNames,
    ...groupNames,
  ]);

  // 2. Validate rule policies and MATCH-last
  const ruleCount = config.rules.length;
  for (let i = 0; i < ruleCount; i++) {
    const rule = config.rules[i];
    if (!validPolicies.has(rule.policy)) {
      const ruleId = rule.value != null ? `${rule.type},${rule.value}` : rule.type;
      errors.push(
        `Rule [${ruleId}]: policy "${rule.policy}" does not refer to DIRECT, REJECT, a proxy, or a proxy group`
      );
    }
    if (rule.type === 'MATCH' && i !== ruleCount - 1) {
      errors.push('MATCH rule must be the last rule');
    }
  }

  // 3. Each proxy group must have at least one proxy or included group
  for (const group of config.proxyGroups) {
    const resolved = resolveGroupProxies(group.source, proxyNames, nodes);
    const hasProxies =
      resolved.length > 0 ||
      (group.includeDirect ?? false) ||
      (group.includeReject ?? false);
    const hasIncludedGroups = (group.includeGroups ?? []).length > 0;
    if (!hasProxies && !hasIncludedGroups) {
      errors.push(`Proxy group "${group.name}" resolves to no proxies and has no included groups`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function buildRuleString(rule: RuleConfig): string {
  const parts: string[] = [rule.type];
  if (rule.value !== undefined && rule.value !== '') {
    parts.push(rule.value);
  }
  parts.push(rule.policy);
  if (rule.noResolve) {
    parts.push('no-resolve');
  }
  return parts.join(',');
}

/**
 * Render a full Clash profile YAML from a ClashConfig and a list of proxy nodes.
 * Falls back to the default template if clashConfig is null/undefined or fails validation.
 */
export function renderClashProfile(
  clashConfig: ClashConfig | null | undefined,
  nodes: ProxyNode[]
): string {
  const supportedNodes = nodes.filter((n) => CLASH_SUPPORTED_PROTOCOLS.has(n.protocol));

  if (supportedNodes.length === 0) {
    throw new Error('No supported nodes available for this profile');
  }

  const proxies = supportedNodes
    .map((n) => nodeToMihomoProxy(n))
    .filter((p): p is Record<string, unknown> => p !== null);
  const proxyNames = supportedNodes.map((n) => n.name);

  // Determine which config to use
  const config = withLoyalsoldierRulesForLegacyDefault(clashConfig ?? buildDefaultClashConfig());

  const { valid, errors } = validateClashConfig(config, proxyNames, supportedNodes);
  if (!valid) {
    logger.warn('Clash config validation failed, falling back to default template', { errors });
    // Use default config rather than re-entering with potentially invalid user config
    const fallback = buildDefaultClashConfig();
    const { valid: fallbackValid } = validateClashConfig(fallback, proxyNames, supportedNodes);
    if (!fallbackValid) {
      // Even default may fail if no nodes match regional groups — render without regional groups
      return renderSafeMinimal(proxies, proxyNames);
    }
    return renderWithConfig(fallback, proxies, proxyNames, supportedNodes);
  }

  return renderWithConfig(config, proxies, proxyNames, supportedNodes);
}

function renderWithConfig(
  config: ClashConfig,
  proxies: Record<string, unknown>[],
  proxyNames: string[],
  nodes: ProxyNode[]
): string {
  const general = config.general ?? {};

  const proxyGroups = config.proxyGroups.map((group: ProxyGroupConfig) => {
    const resolved = resolveGroupProxies(group.source, proxyNames, nodes);
    const groupProxies: string[] = [...resolved];

    if (group.includeGroups) {
      groupProxies.push(...group.includeGroups);
    }
    if (group.includeDirect) {
      groupProxies.push('DIRECT');
    }
    if (group.includeReject) {
      groupProxies.push('REJECT');
    }

    const result: Record<string, unknown> = {
      name: group.name,
      type: group.type,
      proxies: groupProxies,
    };

    if (group.type !== 'select') {
      result.url = group.url ?? 'https://www.gstatic.com/generate_204';
      result.interval = group.interval ?? 300;
      if (group.timeout !== undefined) {
        result.timeout = group.timeout;
      }
    }

    return result;
  });

  const rules = config.rules.map(buildRuleString);

  const output: Record<string, unknown> = {
    // Clash for Windows expects a full profile to define at least one listen port.
    // Keep the same defaults as renderClash for broad client compatibility.
    port: 7890,
    'socks-port': 7891,
    'mixed-port': 7890,
    mode: general.mode ?? 'rule',
    'log-level': general.logLevel ?? 'info',
    ipv6: general.ipv6 ?? false,
    'allow-lan': general.allowLan ?? false,
    'external-controller': '127.0.0.1:9090',
    proxies,
    'proxy-groups': proxyGroups,
    rules,
  };

  if (config.ruleProviders && Object.keys(config.ruleProviders).length > 0) {
    output['rule-providers'] = config.ruleProviders;
  }

  const yaml = stringifyYaml(output);

  // Validate YAML is parseable
  try {
    parseYaml(yaml);
  } catch (e) {
    logger.error('Generated YAML is not parseable', e);
    throw new Error('Failed to generate valid YAML for Clash profile');
  }

  return yaml;
}

/** Safe minimal fallback when even the default config cannot be validated. */
function renderSafeMinimal(
  proxies: Record<string, unknown>[],
  proxyNames: string[]
): string {
  const output: Record<string, unknown> = {
    port: 7890,
    'socks-port': 7891,
    'mixed-port': 7890,
    mode: 'rule',
    'log-level': 'info',
    ipv6: false,
    'allow-lan': false,
    'external-controller': '127.0.0.1:9090',
    proxies,
    'proxy-groups': [
      {
        name: '🚀 节点选择',
        type: 'select',
        proxies: [...proxyNames, 'DIRECT'],
      },
    ],
    rules: ['MATCH,🚀 节点选择'],
  };
  return stringifyYaml(output);
}
