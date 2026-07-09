import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';
import type {
  ClashConfig,
  ClashGeneralConfig,
  ClashMode,
  ClashLogLevel,
  ClashProfileTarget,
  ProxyGroupConfig,
  ProxyGroupType,
  ProxyGroupSource,
  RuleConfig,
} from '@/types/profile';
import { Button } from '@/components/ui/Button';

// ---------------------------------------------------------------------------
// Default template (mirrors backend buildDefaultClashConfig)
// ---------------------------------------------------------------------------

const DEFAULT_PROXY_POLICY = '🚀 节点选择';
const DEFAULT_CLASH_PROFILE_TARGET: ClashProfileTarget = 'clash-verge-rev';
const LOYALSOLDIER_RULESET_BASE_URL =
  'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release';

const CLASH_PROFILE_TARGET_OPTIONS: Array<{ value: ClashProfileTarget; label: string }> = [
  { value: 'clash-verge-rev', label: 'Clash Verge Rev' },
  { value: 'mihomo', label: 'Mihomo' },
  { value: 'clash-meta', label: 'Clash Meta' },
  { value: 'sing-box', label: 'sing-box' },
  { value: 'clash-legacy', label: 'Clash legacy core' },
];

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

export function buildDefaultClashConfig(): ClashConfig {
  return {
    target: DEFAULT_CLASH_PROFILE_TARGET,
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sourceLabel(source: ProxyGroupSource): string {
  switch (source.type) {
    case 'all':
      return 'All nodes';
    case 'manual':
      return `Manual (${source.proxies.length})`;
    case 'region':
      return `Region: ${source.keywords.join(', ')}`;
    case 'tag':
      return `Tag: ${source.tags.join(', ')}`;
    case 'regex':
      return `Regex: ${source.pattern}`;
  }
}

function buildYamlPreview(config: ClashConfig): string {
  try {
    const general = config.general ?? {};
    const doc: Record<string, unknown> = {
      mode: general.mode ?? 'rule',
      'log-level': general.logLevel ?? 'info',
      ipv6: general.ipv6 ?? false,
      'allow-lan': general.allowLan ?? false,
      'proxy-groups': config.proxyGroups.map((g) => ({
        name: g.name,
        type: g.type,
        proxies: ['<resolved at serve time>'],
        ...(g.type !== 'select'
          ? { url: g.url ?? 'https://www.gstatic.com/generate_204', interval: g.interval ?? 300 }
          : {}),
      })),
      rules: config.rules.map((r) => {
        const parts = [r.type];
        if (r.value) parts.push(r.value);
        parts.push(r.policy);
        if (r.noResolve) parts.push('no-resolve');
        return parts.join(',');
      }),
    };
    if (config.ruleProviders && Object.keys(config.ruleProviders).length > 0) {
      doc['rule-providers'] = config.ruleProviders;
    }
    return stringifyYaml(doc, { lineWidth: 120 });
  } catch {
    return '# Error generating preview';
  }
}

// ---------------------------------------------------------------------------
// Convert ClashConfig ↔ raw YAML text for editing
// ---------------------------------------------------------------------------

/** Serialise ClashConfig to the editable YAML representation (our internal JSON structure). */
function configToEditYaml(config: ClashConfig): string {
  try {
    // We store/edit using the ClashConfig JSON structure as YAML for readability.
    return stringifyYaml(config, { lineWidth: 100 });
  } catch {
    return '';
  }
}

export interface ClashConfigValidationError {
  message: string;
}

/** Validate parsed ClashConfig structure; returns error list (empty = valid). */
export function validateClashConfigStructure(raw: unknown): ClashConfigValidationError[] {
  const errors: ClashConfigValidationError[] = [];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    errors.push({ message: 'Root must be an object' });
    return errors;
  }
  const obj = raw as Record<string, unknown>;

  if (obj.target !== undefined) {
    const validTargets = CLASH_PROFILE_TARGET_OPTIONS.map((option) => option.value);
    if (
      typeof obj.target !== 'string' ||
      !validTargets.includes(obj.target as ClashProfileTarget)
    ) {
      errors.push({ message: `target must be one of: ${validTargets.join(', ')}` });
    }
  }

  // proxyGroups
  if (!Array.isArray(obj.proxyGroups)) {
    errors.push({ message: '"proxyGroups" must be an array' });
  } else {
    const groupNames: string[] = [];
    obj.proxyGroups.forEach((g: unknown, i: number) => {
      if (typeof g !== 'object' || g === null) {
        errors.push({ message: `proxyGroups[${i}] must be an object` });
        return;
      }
      const gObj = g as Record<string, unknown>;
      if (!gObj.name || typeof gObj.name !== 'string') {
        errors.push({ message: `proxyGroups[${i}].name is required` });
      } else {
        if (groupNames.includes(gObj.name)) {
          errors.push({ message: `Duplicate proxy group name: "${gObj.name}"` });
        }
        groupNames.push(gObj.name as string);
      }
      const validTypes = ['select', 'url-test', 'fallback', 'load-balance'];
      if (!gObj.type || !validTypes.includes(gObj.type as string)) {
        errors.push({ message: `proxyGroups[${i}].type must be one of: ${validTypes.join(', ')}` });
      }
      if (!gObj.source || typeof gObj.source !== 'object') {
        errors.push({ message: `proxyGroups[${i}].source is required` });
      }
    });
  }

  // rules
  if (!Array.isArray(obj.rules)) {
    errors.push({ message: '"rules" must be an array' });
  } else {
    const rules = obj.rules as Array<unknown>;
    if (rules.length > 0) {
      const last = rules[rules.length - 1] as Record<string, unknown>;
      const matchIdx = rules.findIndex(
        (r) =>
          typeof r === 'object' && r !== null && (r as Record<string, unknown>).type === 'MATCH'
      );
      if (matchIdx !== -1 && matchIdx !== rules.length - 1) {
        errors.push({ message: 'MATCH rule must be the last rule' });
      }
      rules.forEach((r: unknown, i: number) => {
        if (typeof r !== 'object' || r === null) {
          errors.push({ message: `rules[${i}] must be an object` });
          return;
        }
        const rObj = r as Record<string, unknown>;
        if (!rObj.type || typeof rObj.type !== 'string') {
          errors.push({ message: `rules[${i}].type is required` });
        }
        if (!rObj.policy || typeof rObj.policy !== 'string') {
          errors.push({ message: `rules[${i}].policy is required` });
        }
      });
      void last; // suppress unused warning
    }
  }

  // general (optional but validated if present)
  if (obj.general !== undefined && obj.general !== null) {
    if (typeof obj.general !== 'object' || Array.isArray(obj.general)) {
      errors.push({ message: '"general" must be an object' });
    } else {
      const gen = obj.general as Record<string, unknown>;
      if (gen.mode !== undefined && !['rule', 'global', 'direct'].includes(gen.mode as string)) {
        errors.push({ message: 'general.mode must be rule | global | direct' });
      }
      const validLevels = ['silent', 'error', 'warning', 'info', 'debug'];
      if (gen.logLevel !== undefined && !validLevels.includes(gen.logLevel as string)) {
        errors.push({ message: `general.logLevel must be one of: ${validLevels.join(', ')}` });
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Sub-component: Group source editor
// ---------------------------------------------------------------------------

interface SourceEditorProps {
  source: ProxyGroupSource;
  onChange: (source: ProxyGroupSource) => void;
}

function SourceEditor({ source, onChange }: SourceEditorProps) {
  return (
    <div className="space-y-2">
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">Source Type</label>
        <select
          className="ip-input text-sm"
          value={source.type}
          onChange={(e) => {
            const t = e.target.value as ProxyGroupSource['type'];
            if (t === 'all') onChange({ type: 'all' });
            else if (t === 'manual') onChange({ type: 'manual', proxies: [] });
            else if (t === 'region') onChange({ type: 'region', keywords: [] });
            else if (t === 'tag') onChange({ type: 'tag', tags: [] });
            else onChange({ type: 'regex', pattern: '' });
          }}
        >
          <option value="all">All nodes</option>
          <option value="manual">Manual list</option>
          <option value="region">Region keywords</option>
          <option value="tag">Tag</option>
          <option value="regex">Regex</option>
        </select>
      </div>

      {source.type === 'manual' && (
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            Proxy names (comma-separated)
          </label>
          <input
            className="ip-input text-sm"
            value={source.proxies.join(', ')}
            onChange={(e) =>
              onChange({
                type: 'manual',
                proxies: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="Node A, Node B"
          />
        </div>
      )}

      {source.type === 'region' && (
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            Keywords (comma-separated)
          </label>
          <input
            className="ip-input text-sm"
            value={source.keywords.join(', ')}
            onChange={(e) =>
              onChange({
                type: 'region',
                keywords: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="香港, HK, Hong Kong"
          />
        </div>
      )}

      {source.type === 'tag' && (
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            Tags (comma-separated)
          </label>
          <input
            className="ip-input text-sm"
            value={source.tags.join(', ')}
            onChange={(e) =>
              onChange({
                type: 'tag',
                tags: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="premium, hk"
          />
        </div>
      )}

      {source.type === 'regex' && (
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">Regex pattern</label>
          <input
            className="ip-input text-sm font-mono"
            value={source.pattern}
            onChange={(e) => onChange({ type: 'regex', pattern: e.target.value })}
            placeholder="(香港|HK|Hong Kong)"
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Single proxy group editor row
// ---------------------------------------------------------------------------

interface GroupEditorProps {
  group: ProxyGroupConfig;
  index: number;
  totalGroups: number;
  onChange: (group: ProxyGroupConfig) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function GroupEditor({
  group,
  index,
  totalGroups,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: GroupEditorProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-line rounded-lg overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center gap-2 px-3 py-2 bg-surface-1 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-text-dim text-xs">{expanded ? '▼' : '▶'}</span>
        <span className="flex-1 font-medium text-sm text-text truncate">
          {group.name || '(unnamed group)'}
        </span>
        <span className="text-xs text-text-muted bg-surface-2 px-1.5 py-0.5 rounded">
          {group.type}
        </span>
        <span className="text-xs text-text-dim">{sourceLabel(group.source)}</span>
        <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
          <button
            className="p-1 rounded hover:bg-line disabled:opacity-30"
            disabled={index === 0}
            onClick={onMoveUp}
            title="Move up"
          >
            ↑
          </button>
          <button
            className="p-1 rounded hover:bg-line disabled:opacity-30"
            disabled={index === totalGroups - 1}
            onClick={onMoveDown}
            title="Move down"
          >
            ↓
          </button>
          <button
            className="p-1 rounded hover:bg-danger/20 text-danger text-xs"
            onClick={onDelete}
            title="Delete group"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="p-3 space-y-3 border-t border-line">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Group Name</label>
              <input
                className="ip-input text-sm"
                value={group.name}
                onChange={(e) => onChange({ ...group, name: e.target.value })}
                placeholder="🚀 My Group"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Type</label>
              <select
                className="ip-input text-sm"
                value={group.type}
                onChange={(e) => onChange({ ...group, type: e.target.value as ProxyGroupType })}
              >
                <option value="select">select</option>
                <option value="url-test">url-test</option>
                <option value="fallback">fallback</option>
                <option value="load-balance">load-balance</option>
              </select>
            </div>
          </div>

          <SourceEditor
            source={group.source}
            onChange={(source) => onChange({ ...group, source })}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`direct-${index}`}
                checked={group.includeDirect ?? false}
                onChange={(e) => onChange({ ...group, includeDirect: e.target.checked })}
              />
              <label htmlFor={`direct-${index}`} className="text-xs text-text-muted">
                Include DIRECT
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`reject-${index}`}
                checked={group.includeReject ?? false}
                onChange={(e) => onChange({ ...group, includeReject: e.target.checked })}
              />
              <label htmlFor={`reject-${index}`} className="text-xs text-text-muted">
                Include REJECT
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Include other groups (comma-separated names)
            </label>
            <input
              className="ip-input text-sm"
              value={(group.includeGroups ?? []).join(', ')}
              onChange={(e) =>
                onChange({
                  ...group,
                  includeGroups: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="♻️ 自动选择, 🇭🇰 香港自动"
            />
          </div>

          {group.type !== 'select' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Test URL</label>
                <input
                  className="ip-input text-sm"
                  value={group.url ?? ''}
                  onChange={(e) => onChange({ ...group, url: e.target.value || undefined })}
                  placeholder="https://www.gstatic.com/generate_204"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Interval (s)
                </label>
                <input
                  type="number"
                  className="ip-input text-sm"
                  value={group.interval ?? 300}
                  onChange={(e) =>
                    onChange({ ...group, interval: Number(e.target.value) || undefined })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Timeout (ms)
                </label>
                <input
                  type="number"
                  className="ip-input text-sm"
                  value={group.timeout ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...group,
                      timeout: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  placeholder="5000"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Rules table
// ---------------------------------------------------------------------------

interface RulesEditorProps {
  rules: RuleConfig[];
  onChange: (rules: RuleConfig[]) => void;
}

function RulesEditor({ rules, onChange }: RulesEditorProps) {
  const addRule = () => {
    onChange(
      [
        ...rules.slice(0, -1),
        { type: 'DOMAIN-SUFFIX', value: '', policy: 'DIRECT' },
        rules[rules.length - 1],
      ].filter(Boolean)
    );
  };

  const updateRule = (i: number, rule: RuleConfig) => {
    const next = [...rules];
    next[i] = rule;
    onChange(next);
  };

  const deleteRule = (i: number) => {
    onChange(rules.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-2">
      <div className="max-h-64 overflow-y-auto space-y-1.5">
        {rules.map((rule, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className="ip-input text-xs w-28 shrink-0 font-mono"
              value={rule.type}
              onChange={(e) => updateRule(i, { ...rule, type: e.target.value.toUpperCase() })}
              placeholder="DOMAIN-SUFFIX"
            />
            <input
              className="ip-input text-xs flex-1 font-mono"
              value={rule.value ?? ''}
              onChange={(e) => updateRule(i, { ...rule, value: e.target.value || undefined })}
              placeholder="value (optional for MATCH)"
              disabled={rule.type === 'MATCH'}
            />
            <input
              className="ip-input text-xs w-36 shrink-0"
              value={rule.policy}
              onChange={(e) => updateRule(i, { ...rule, policy: e.target.value })}
              placeholder="DIRECT / group name"
            />
            <div className="flex items-center gap-1 shrink-0">
              <input
                type="checkbox"
                id={`nr-${i}`}
                checked={rule.noResolve ?? false}
                onChange={(e) =>
                  updateRule(i, { ...rule, noResolve: e.target.checked || undefined })
                }
                title="no-resolve"
              />
              <label htmlFor={`nr-${i}`} className="text-xs text-text-dim">
                NR
              </label>
              <button
                className="p-1 text-danger hover:bg-danger/10 rounded text-xs"
                onClick={() => deleteRule(i)}
                title="Delete rule"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
      <Button variant="ghost" size="sm" onClick={addRule}>
        + Add Rule
      </Button>
      <p className="text-xs text-text-dim">NR = no-resolve. The MATCH rule must be kept last.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ClashConfigEditor component
// ---------------------------------------------------------------------------

interface ClashConfigEditorProps {
  value: ClashConfig | undefined;
  onChange: (config: ClashConfig) => void;
  /** Called whenever the validation state changes. Parent can use this to block saving. */
  onValidationChange?: (errors: ClashConfigValidationError[]) => void;
}

type EditorTab = 'general' | 'groups' | 'rules' | 'preview' | 'yaml';

export function ClashConfigEditor({ value, onChange, onValidationChange }: ClashConfigEditorProps) {
  const [activeTab, setActiveTab] = useState<EditorTab>('general');

  // ---- YAML edit state ----
  const [yamlText, setYamlText] = useState<string>('');
  const [yamlParseError, setYamlParseError] = useState<string>('');
  const [yamlStructErrors, setYamlStructErrors] = useState<ClashConfigValidationError[]>([]);
  // Track whether the YAML textarea is "dirty" (user is editing) vs. auto-synced from config
  const yamlDirtyRef = useRef(false);

  const config = value ?? buildDefaultClashConfig();

  // Sync yamlText when config changes externally (switching away and back, reset, etc.)
  // but do NOT overwrite if the user is actively editing in the YAML tab.
  useEffect(() => {
    if (!yamlDirtyRef.current) {
      setYamlText(configToEditYaml(config));
      setYamlParseError('');
      setYamlStructErrors([]);
    }
  }, [value]); // intentionally using `value`, not `config`

  // When entering the YAML tab, always sync from current config
  const handleTabChange = (tab: EditorTab) => {
    if (tab === 'yaml') {
      yamlDirtyRef.current = false;
      setYamlText(configToEditYaml(config));
      setYamlParseError('');
      setYamlStructErrors([]);
    }
    setActiveTab(tab);
  };

  // ---- YAML text editing ----
  const handleYamlChange = useCallback(
    (text: string) => {
      setYamlText(text);
      yamlDirtyRef.current = true;

      // Parse
      let parsed: unknown;
      try {
        parsed = parseYaml(text);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setYamlParseError(msg);
        setYamlStructErrors([]);
        onValidationChange?.([{ message: `YAML parse error: ${msg}` }]);
        return;
      }
      setYamlParseError('');

      // Structural validation
      const structErrors = validateClashConfigStructure(parsed);
      setYamlStructErrors(structErrors);
      onValidationChange?.(structErrors);

      if (structErrors.length === 0) {
        // Apply to config immediately so other tabs stay in sync
        onChange(parsed as ClashConfig);
        yamlDirtyRef.current = false;
      }
    },
    [onChange, onValidationChange]
  );

  // ---- Notify parent of validation state when user is in YAML tab ----
  useEffect(() => {
    if (activeTab !== 'yaml') {
      onValidationChange?.([]);
    }
  }, [activeTab, onValidationChange]);

  // ---- Structured editor callbacks ----
  const updateGeneral = useCallback(
    (patch: Partial<ClashGeneralConfig>) => {
      onChange({ ...config, general: { ...config.general, ...patch } });
    },
    [config, onChange]
  );

  const updateTarget = useCallback(
    (target: ClashProfileTarget) => {
      onChange({ ...config, target });
    },
    [config, onChange]
  );

  const updateGroups = useCallback(
    (groups: ProxyGroupConfig[]) => {
      onChange({ ...config, proxyGroups: groups });
    },
    [config, onChange]
  );

  const updateRules = useCallback(
    (rules: RuleConfig[]) => {
      onChange({ ...config, rules });
    },
    [config, onChange]
  );

  const resetToDefault = () => {
    yamlDirtyRef.current = false;
    onChange(buildDefaultClashConfig());
    onValidationChange?.([]);
  };

  const addGroup = () => {
    const newGroup: ProxyGroupConfig = {
      name: 'New Group',
      type: 'select',
      source: { type: 'all' },
      includeDirect: true,
    };
    updateGroups([...config.proxyGroups, newGroup]);
  };

  const yamlPreview = useMemo(() => buildYamlPreview(config), [config]);
  const general = config.general ?? {};

  const tabs: { key: EditorTab; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'groups', label: `Groups (${config.proxyGroups.length})` },
    { key: 'rules', label: `Rules (${config.rules.length})` },
    { key: 'preview', label: 'Preview' },
    { key: 'yaml', label: 'YAML Edit' },
  ];

  const hasYamlErrors = activeTab === 'yaml' && (!!yamlParseError || yamlStructErrors.length > 0);
  const target = config.target ?? DEFAULT_CLASH_PROFILE_TARGET;

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
              activeTab === t.key
                ? 'border-b-2 border-primary text-primary bg-surface-1'
                : t.key === 'yaml' && hasYamlErrors
                  ? 'text-danger hover:text-danger'
                  : 'text-text-muted hover:text-text'
            }`}
            onClick={() => handleTabChange(t.key)}
          >
            {t.label}
            {t.key === 'yaml' && hasYamlErrors && <span className="ml-1 text-danger">⚠</span>}
          </button>
        ))}
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={resetToDefault} className="mb-1 text-xs">
          Reset to Default
        </Button>
      </div>

      {/* General tab */}
      {activeTab === 'general' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Profile Target</label>
            <select
              className="ip-input text-sm"
              value={target}
              onChange={(e) => updateTarget(e.target.value as ClashProfileTarget)}
            >
              {CLASH_PROFILE_TARGET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {target === 'clash-legacy' && (
              <p className="mt-1 text-xs text-warning">
                当前 Clash legacy core 不支持 Hysteria2，已自动过滤。若要使用这些节点，请选择 Clash
                Verge Rev / Mihomo / sing-box。
              </p>
            )}
            {target === 'clash-verge-rev' && (
              <p className="mt-1 text-xs text-success">
                Clash Verge Rev 使用 Mihomo 内核，支持 Hysteria2。
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Mode</label>
              <select
                className="ip-input text-sm"
                value={general.mode ?? 'rule'}
                onChange={(e) => updateGeneral({ mode: e.target.value as ClashMode })}
              >
                <option value="rule">rule</option>
                <option value="global">global</option>
                <option value="direct">direct</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Log Level</label>
              <select
                className="ip-input text-sm"
                value={general.logLevel ?? 'info'}
                onChange={(e) => updateGeneral({ logLevel: e.target.value as ClashLogLevel })}
              >
                <option value="silent">silent</option>
                <option value="error">error</option>
                <option value="warning">warning</option>
                <option value="info">info</option>
                <option value="debug">debug</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-text-muted">
              <input
                type="checkbox"
                checked={general.allowLan ?? false}
                onChange={(e) => updateGeneral({ allowLan: e.target.checked })}
              />
              Allow LAN
            </label>
            <label className="flex items-center gap-2 text-sm text-text-muted">
              <input
                type="checkbox"
                checked={general.ipv6 ?? false}
                onChange={(e) => updateGeneral({ ipv6: e.target.checked })}
              />
              IPv6
            </label>
          </div>
        </div>
      )}

      {/* Groups tab */}
      {activeTab === 'groups' && (
        <div className="space-y-2">
          {config.proxyGroups.map((group, i) => (
            <GroupEditor
              key={i}
              group={group}
              index={i}
              totalGroups={config.proxyGroups.length}
              onChange={(updated) => {
                const next = [...config.proxyGroups];
                next[i] = updated;
                updateGroups(next);
              }}
              onDelete={() => updateGroups(config.proxyGroups.filter((_, idx) => idx !== i))}
              onMoveUp={() => {
                if (i === 0) return;
                const next = [...config.proxyGroups];
                [next[i - 1], next[i]] = [next[i], next[i - 1]];
                updateGroups(next);
              }}
              onMoveDown={() => {
                if (i === config.proxyGroups.length - 1) return;
                const next = [...config.proxyGroups];
                [next[i], next[i + 1]] = [next[i + 1], next[i]];
                updateGroups(next);
              }}
            />
          ))}
          <Button variant="ghost" size="sm" onClick={addGroup}>
            + Add Group
          </Button>
        </div>
      )}

      {/* Rules tab */}
      {activeTab === 'rules' && <RulesEditor rules={config.rules} onChange={updateRules} />}

      {/* Preview tab */}
      {activeTab === 'preview' && (
        <div>
          <p className="text-xs text-text-dim mb-2">
            Output YAML structure (proxy lists resolved at serve time).
          </p>
          <pre className="text-xs font-mono bg-surface-1 border border-line rounded p-3 overflow-auto max-h-96 whitespace-pre text-text">
            {yamlPreview}
          </pre>
        </div>
      )}

      {/* YAML Edit tab */}
      {activeTab === 'yaml' && (
        <div className="space-y-2">
          <p className="text-xs text-text-dim">
            Edit the ClashConfig directly as YAML. Changes are applied immediately when the YAML is
            valid. You can also copy-paste a config from another profile.
          </p>
          <textarea
            className={`w-full min-h-72 p-3 rounded border font-mono text-xs leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-primary/30 ${
              yamlParseError || yamlStructErrors.length > 0
                ? 'border-danger bg-danger/5 focus:border-danger'
                : 'border-line bg-surface-1 text-text focus:border-primary'
            }`}
            value={yamlText}
            onChange={(e) => handleYamlChange(e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />

          {/* Parse error */}
          {yamlParseError && (
            <div className="rounded border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-danger space-y-1">
              <p className="font-semibold">YAML parse error — cannot save until fixed</p>
              <p className="font-mono whitespace-pre-wrap break-all">{yamlParseError}</p>
            </div>
          )}

          {/* Structural validation errors */}
          {!yamlParseError && yamlStructErrors.length > 0 && (
            <div className="rounded border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-danger space-y-1">
              <p className="font-semibold">
                Validation errors ({yamlStructErrors.length}) — cannot save until fixed
              </p>
              <ul className="list-disc list-inside space-y-0.5">
                {yamlStructErrors.map((e, i) => (
                  <li key={i}>{e.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Success state */}
          {!yamlParseError && yamlStructErrors.length === 0 && yamlText.trim() && (
            <p className="text-xs text-success flex items-center gap-1">
              <span>✓</span> Valid — config applied
            </p>
          )}
        </div>
      )}
    </div>
  );
}
