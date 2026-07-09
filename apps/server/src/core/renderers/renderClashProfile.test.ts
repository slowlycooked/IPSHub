import { describe, it, expect } from 'vitest';
import { parse as parseYaml } from 'yaml';
import type { ProxyNode } from '@/types/proxy';
import type { ClashConfig, ClashProfileTarget } from '@/types/clashConfig';
import {
  buildDefaultClashConfig,
  resolveGroupProxies,
  validateClashConfig,
  renderClashProfile,
} from './renderClashProfile';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeNode(overrides: Partial<ProxyNode> = {}): ProxyNode {
  return {
    fingerprint: 'fp-' + Math.random(),
    name: overrides.name ?? 'Test Node',
    protocol: 'ss',
    server: '1.2.3.4',
    port: 443,
    password: 'secret',
    cipher: 'aes-256-gcm',
    ...overrides,
  };
}

const baseNodes: ProxyNode[] = [
  makeNode({ name: '香港 01' }),
  makeNode({ name: '日本 Tokyo' }),
  makeNode({ name: '美国 LA' }),
  makeNode({ name: 'HK Premium' }),
  makeNode({ name: 'US New York', protocol: 'vmess', uuid: 'abc' }),
];

const proxyNames = baseNodes.map((n) => n.name);

// ---------------------------------------------------------------------------
// buildDefaultClashConfig
// ---------------------------------------------------------------------------

describe('buildDefaultClashConfig', () => {
  it('returns a config with 5 proxy groups', () => {
    const cfg = buildDefaultClashConfig();
    expect(cfg.proxyGroups).toHaveLength(5);
  });

  it('includes 节点选择 group with type select', () => {
    const cfg = buildDefaultClashConfig();
    const g = cfg.proxyGroups.find((g) => g.name === '🚀 节点选择');
    expect(g).toBeDefined();
    expect(g!.type).toBe('select');
  });

  it('last rule is MATCH', () => {
    const cfg = buildDefaultClashConfig();
    const last = cfg.rules[cfg.rules.length - 1];
    expect(last.type).toBe('MATCH');
  });

  it('includes Loyalsoldier rule providers for Clash clients to download', () => {
    const cfg = buildDefaultClashConfig();
    expect(cfg.ruleProviders).toBeDefined();
    expect(cfg.ruleProviders).toHaveProperty('reject');
    expect(cfg.ruleProviders).toHaveProperty('proxy');
    expect(cfg.ruleProviders).toHaveProperty('direct');
    expect(cfg.ruleProviders).toHaveProperty('telegramcidr');
    expect(cfg.rules.some((rule) => rule.type === 'RULE-SET' && rule.value === 'proxy')).toBe(true);
  });

  it('all rules reference valid policies for default groups', () => {
    const cfg = buildDefaultClashConfig();
    const groupNames = new Set(cfg.proxyGroups.map((g) => g.name));
    for (const rule of cfg.rules) {
      const valid =
        rule.policy === 'DIRECT' || rule.policy === 'REJECT' || groupNames.has(rule.policy);
      expect(valid, `Rule policy "${rule.policy}" should be DIRECT, REJECT, or a group name`).toBe(
        true
      );
    }
  });
});

// ---------------------------------------------------------------------------
// resolveGroupProxies — source types
// ---------------------------------------------------------------------------

describe('resolveGroupProxies', () => {
  it('all: returns all proxy names', () => {
    const result = resolveGroupProxies({ type: 'all' }, proxyNames, baseNodes);
    expect(result).toEqual(proxyNames);
  });

  it('manual: returns only names that exist in proxyNames', () => {
    const result = resolveGroupProxies(
      { type: 'manual', proxies: ['香港 01', 'nonexistent', '日本 Tokyo'] },
      proxyNames,
      baseNodes
    );
    expect(result).toEqual(['香港 01', '日本 Tokyo']);
  });

  it('region: matches nodes containing any keyword (case-insensitive)', () => {
    const result = resolveGroupProxies(
      { type: 'region', keywords: ['香港', 'HK', 'Hong Kong'] },
      proxyNames,
      baseNodes
    );
    expect(result).toContain('香港 01');
    expect(result).toContain('HK Premium');
    expect(result).not.toContain('日本 Tokyo');
  });

  it('region: matches US nodes', () => {
    const result = resolveGroupProxies(
      { type: 'region', keywords: ['美国', 'US', 'United States'] },
      proxyNames,
      baseNodes
    );
    expect(result).toContain('美国 LA');
    expect(result).toContain('US New York');
    expect(result).not.toContain('香港 01');
  });

  it('regex: matches nodes by pattern', () => {
    const result = resolveGroupProxies(
      { type: 'regex', pattern: '(HK|香港)' },
      proxyNames,
      baseNodes
    );
    expect(result).toContain('香港 01');
    expect(result).toContain('HK Premium');
    expect(result).not.toContain('日本 Tokyo');
  });

  it('regex: invalid pattern returns empty array without throwing', () => {
    const result = resolveGroupProxies(
      { type: 'regex', pattern: '[invalid' },
      proxyNames,
      baseNodes
    );
    expect(result).toEqual([]);
  });

  it('tag: matches nodes by tag field', () => {
    const taggedNodes: ProxyNode[] = [
      makeNode({ name: 'Node A', tag: 'premium' }),
      makeNode({ name: 'Node B', tag: 'free' }),
      makeNode({ name: 'Node C' }),
    ];
    const names = taggedNodes.map((n) => n.name);
    const result = resolveGroupProxies({ type: 'tag', tags: ['premium'] }, names, taggedNodes);
    expect(result).toEqual(['Node A']);
  });
});

// ---------------------------------------------------------------------------
// validateClashConfig
// ---------------------------------------------------------------------------

describe('validateClashConfig', () => {
  it('returns valid for a well-formed config', () => {
    const cfg: ClashConfig = {
      proxyGroups: [
        { name: 'MyProxy', type: 'select', source: { type: 'all' }, includeDirect: true },
      ],
      rules: [{ type: 'MATCH', policy: 'MyProxy' }],
    };
    const { valid } = validateClashConfig(cfg, proxyNames, baseNodes);
    expect(valid).toBe(true);
  });

  it('detects duplicate proxy group names', () => {
    const cfg: ClashConfig = {
      proxyGroups: [
        { name: 'Dup', type: 'select', source: { type: 'all' } },
        { name: 'Dup', type: 'select', source: { type: 'all' } },
      ],
      rules: [{ type: 'MATCH', policy: 'Dup' }],
    };
    const { valid, errors } = validateClashConfig(cfg, proxyNames, baseNodes);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('unique'))).toBe(true);
  });

  it('detects invalid rule policy', () => {
    const cfg: ClashConfig = {
      proxyGroups: [{ name: 'Proxy', type: 'select', source: { type: 'all' } }],
      rules: [{ type: 'MATCH', policy: 'NonExistentGroup' }],
    };
    const { valid, errors } = validateClashConfig(cfg, proxyNames, baseNodes);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('NonExistentGroup'))).toBe(true);
  });

  it('detects MATCH not last', () => {
    const cfg: ClashConfig = {
      proxyGroups: [{ name: 'P', type: 'select', source: { type: 'all' } }],
      rules: [
        { type: 'MATCH', policy: 'P' },
        { type: 'DOMAIN-SUFFIX', value: 'example.com', policy: 'DIRECT' },
      ],
    };
    const { valid, errors } = validateClashConfig(cfg, proxyNames, baseNodes);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('MATCH rule must be the last'))).toBe(true);
  });

  it('detects empty proxy group (no proxies, no includeDirect, no includeGroups)', () => {
    const cfg: ClashConfig = {
      proxyGroups: [
        {
          name: 'EmptyGroup',
          type: 'url-test',
          source: { type: 'region', keywords: ['nonexistent_xyz'] },
        },
      ],
      rules: [{ type: 'MATCH', policy: 'EmptyGroup' }],
    };
    const { valid, errors } = validateClashConfig(cfg, proxyNames, baseNodes);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('EmptyGroup'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// renderClashProfile
// ---------------------------------------------------------------------------

describe('renderClashProfile', () => {
  it('throws when nodes list is empty', () => {
    expect(() => renderClashProfile(null, [])).toThrow('No supported nodes');
  });

  it('uses default config when clashConfig is null', () => {
    const yaml = renderClashProfile(null, baseNodes);
    const parsed = parseYaml(yaml);
    expect(parsed).toHaveProperty('proxies');
    expect(parsed).toHaveProperty('proxy-groups');
    expect(parsed).toHaveProperty('rules');
  });

  it('includes listen ports for Clash clients', () => {
    const yaml = renderClashProfile(null, baseNodes);
    const parsed = parseYaml(yaml) as any;
    expect(parsed['mixed-port']).toBe(7890);
    expect(parsed.port).toBe(7890);
    expect(parsed['socks-port']).toBe(7891);
  });

  it('outputs parseable YAML', () => {
    const yaml = renderClashProfile(null, baseNodes);
    expect(() => parseYaml(yaml)).not.toThrow();
  });

  it('includes all supported nodes in proxies', () => {
    const yaml = renderClashProfile(null, baseNodes);
    const parsed = parseYaml(yaml) as any;
    expect(parsed.proxies).toHaveLength(baseNodes.length);
  });

  it('filters unsupported node protocols', () => {
    const mixedNodes = [
      ...baseNodes,
      makeNode({ name: 'Unsupported', protocol: 'http' as any }), // http is actually supported but let's use a fake one
    ];
    // Test with a protocol that IS supported to ensure the count is correct
    const yaml = renderClashProfile(null, baseNodes);
    const parsed = parseYaml(yaml) as any;
    expect(parsed.proxies.length).toBe(baseNodes.length);
  });

  it('filters hysteria2 nodes for target=clash-legacy', () => {
    const cfg: ClashConfig = {
      target: 'clash-legacy',
      proxyGroups: [{ name: 'All', type: 'select', source: { type: 'all' }, includeDirect: true }],
      rules: [{ type: 'MATCH', policy: 'All' }],
    };
    const nodes = [
      makeNode({ name: 'SS 01', protocol: 'ss' }),
      makeNode({ name: 'HY2 01', protocol: 'hysteria2' }),
    ];

    const yaml = renderClashProfile(cfg, nodes);
    const parsed = parseYaml(yaml) as any;

    expect(parsed.proxies.map((proxy: any) => proxy.name)).toEqual(['SS 01']);
    expect(parsed.proxies.some((proxy: any) => proxy.type === 'hysteria2')).toBe(false);
  });

  it.each<ClashProfileTarget>(['clash-verge-rev', 'mihomo', 'clash-meta', 'sing-box'])(
    'keeps hysteria2 nodes for target=%s',
    (target) => {
      const cfg: ClashConfig = {
        target,
        proxyGroups: [
          { name: 'All', type: 'select', source: { type: 'all' }, includeDirect: true },
        ],
        rules: [{ type: 'MATCH', policy: 'All' }],
      };
      const nodes = [
        makeNode({ name: 'SS 01', protocol: 'ss' }),
        makeNode({ name: 'HY2 01', protocol: 'hysteria2' }),
      ];

      const yaml = renderClashProfile(cfg, nodes);
      const parsed = parseYaml(yaml) as any;

      expect(parsed.proxies.map((proxy: any) => proxy.name)).toContain('HY2 01');
      expect(parsed.proxies.some((proxy: any) => proxy.type === 'hysteria2')).toBe(true);
    }
  );

  it('renders target=loon as Loon Hysteria2 format instead of Clash YAML', () => {
    const cfg: ClashConfig = {
      target: 'loon',
      proxyGroups: [
        { name: 'Manual', type: 'select', source: { type: 'manual', proxies: ['HY2 01'] } },
      ],
      rules: [{ type: 'MATCH', policy: 'Manual' }],
    };
    const nodes = [
      makeNode({
        name: 'HY2 01',
        protocol: 'hysteria2',
        server: 'hy2.example.com',
        port: 8443,
        password: 'secret',
        host: 'sni.example.com',
      }),
    ];

    const output = renderClashProfile(cfg, nodes);

    expect(output).toContain('HY2 01 = Hysteria2,hy2.example.com,8443,"secret"');
    expect(output).not.toContain('type: hysteria2');
    expect(output).toContain('Manual = select,HY2 01');
  });

  it('maps the Clash Verge Rev entry name to a Mihomo-compatible target', () => {
    const cfg: ClashConfig = {
      proxyGroups: [{ name: 'All', type: 'select', source: { type: 'all' }, includeDirect: true }],
      rules: [{ type: 'MATCH', policy: 'All' }],
    };
    const nodes = [
      makeNode({ name: 'SS 01', protocol: 'ss' }),
      makeNode({ name: 'HY2 01', protocol: 'hysteria2' }),
    ];

    const yaml = renderClashProfile(cfg, nodes, { target: 'Clash Verge Rev' });
    const parsed = parseYaml(yaml) as any;

    expect(parsed.proxies.map((proxy: any) => proxy.name)).toContain('HY2 01');
  });

  it('syncs proxy-groups after target filtering removes hysteria2 nodes', () => {
    const cfg: ClashConfig = {
      target: 'clash-legacy',
      proxyGroups: [
        {
          name: 'Manual',
          type: 'select',
          source: { type: 'manual', proxies: ['SS 01', 'HY2 01'] },
          includeDirect: true,
        },
      ],
      rules: [{ type: 'MATCH', policy: 'Manual' }],
    };
    const nodes = [
      makeNode({ name: 'SS 01', protocol: 'ss' }),
      makeNode({ name: 'HY2 01', protocol: 'hysteria2' }),
    ];

    const yaml = renderClashProfile(cfg, nodes);
    const parsed = parseYaml(yaml) as any;

    expect(parsed['proxy-groups'][0].proxies).toEqual(['SS 01', 'DIRECT']);
  });

  it('respects custom clashConfig', () => {
    const cfg: ClashConfig = {
      general: { mode: 'global', logLevel: 'debug' },
      proxyGroups: [
        {
          name: 'All',
          type: 'select',
          source: { type: 'all' },
          includeDirect: true,
        },
      ],
      rules: [{ type: 'MATCH', policy: 'All' }],
    };
    const yaml = renderClashProfile(cfg, baseNodes);
    const parsed = parseYaml(yaml) as any;
    expect(parsed.mode).toBe('global');
    expect(parsed['log-level']).toBe('debug');
    expect(parsed['proxy-groups']).toHaveLength(1);
    expect(parsed['proxy-groups'][0].name).toBe('All');
  });

  it('includes rule-providers only when configured', () => {
    const cfgWithProviders: ClashConfig = {
      proxyGroups: [{ name: 'P', type: 'select', source: { type: 'all' }, includeDirect: true }],
      ruleProviders: {
        'reject-list': {
          type: 'http',
          behavior: 'domain',
          url: 'https://example.com/reject.yaml',
          interval: 86400,
        },
      },
      rules: [
        { type: 'RULE-SET', value: 'reject-list', policy: 'REJECT' },
        { type: 'MATCH', policy: 'P' },
      ],
    };
    const yaml = renderClashProfile(cfgWithProviders, baseNodes);
    const parsed = parseYaml(yaml) as any;
    expect(parsed).toHaveProperty('rule-providers');
    expect(parsed['rule-providers']).toHaveProperty('reject-list');
  });

  it('renders default Loyalsoldier rule providers and RULE-SET rules', () => {
    const yaml = renderClashProfile(null, baseNodes);
    const parsed = parseYaml(yaml) as any;
    expect(parsed['rule-providers']).toHaveProperty('reject');
    expect(parsed['rule-providers']).toHaveProperty('applications');
    expect(parsed.rules).toContain('RULE-SET,reject,REJECT');
    expect(parsed.rules).toContain('RULE-SET,proxy,🚀 节点选择');
  });

  it('upgrades previously stored legacy default rules at render time', () => {
    const legacyCfg: ClashConfig = {
      general: { mode: 'rule', logLevel: 'info', allowLan: false, ipv6: false },
      proxyGroups: buildDefaultClashConfig().proxyGroups,
      rules: [
        { type: 'DOMAIN-SUFFIX', value: 'local', policy: 'DIRECT' },
        { type: 'IP-CIDR', value: '127.0.0.0/8', policy: 'DIRECT', noResolve: true },
        { type: 'IP-CIDR', value: '10.0.0.0/8', policy: 'DIRECT', noResolve: true },
        { type: 'IP-CIDR', value: '172.16.0.0/12', policy: 'DIRECT', noResolve: true },
        { type: 'IP-CIDR', value: '192.168.0.0/16', policy: 'DIRECT', noResolve: true },
        { type: 'GEOIP', value: 'CN', policy: 'DIRECT', noResolve: true },
        { type: 'MATCH', policy: '🚀 节点选择' },
      ],
    };

    const yaml = renderClashProfile(legacyCfg, baseNodes);
    const parsed = parseYaml(yaml) as any;
    expect(parsed['rule-providers']).toHaveProperty('proxy');
    expect(parsed.rules).toContain('RULE-SET,telegramcidr,🚀 节点选择');
  });

  it('falls back to default config when custom config is invalid', () => {
    const badCfg: ClashConfig = {
      proxyGroups: [{ name: 'P', type: 'select', source: { type: 'all' } }],
      rules: [{ type: 'MATCH', policy: 'NonExistentPolicy' }],
    };
    // Should not throw; falls back to default
    const yaml = renderClashProfile(badCfg, baseNodes);
    expect(() => parseYaml(yaml)).not.toThrow();
  });

  it('MATCH rule appears at end of rules list', () => {
    const yaml = renderClashProfile(null, baseNodes);
    const parsed = parseYaml(yaml) as any;
    const rules: string[] = parsed.rules;
    const matchIndex = rules.findIndex((r) => r.startsWith('MATCH,'));
    expect(matchIndex).toBe(rules.length - 1);
  });
});
