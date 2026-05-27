import type { ProxyNode } from '@/types/proxy';

export type DiffRisk = 'critical' | 'high' | 'medium' | 'low';

export interface ConfigDiffItem {
  field: string;
  rawValue: unknown;
  normalizedValue: unknown;
  risk: DiffRisk;
}

const FIELD_RISK: Array<{ field: keyof ProxyNode | string; risk: DiffRisk }> = [
  { field: 'server', risk: 'critical' },
  { field: 'port', risk: 'critical' },
  { field: 'uuid', risk: 'critical' },
  { field: 'password', risk: 'critical' },
  { field: 'flow', risk: 'critical' },
  { field: 'realityPublicKey', risk: 'critical' },
  { field: 'realityShortId', risk: 'critical' },
  { field: 'cipher', risk: 'high' },
  { field: 'tls', risk: 'high' },
  { field: 'host', risk: 'high' },
  { field: 'realityFingerprint', risk: 'medium' },
  { field: 'transport', risk: 'medium' },
  { field: 'path', risk: 'medium' },
  { field: 'serviceName', risk: 'medium' },
  { field: 'protocol', risk: 'low' },
  { field: 'name', risk: 'low' },
];

function normalize(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.toLowerCase().trim();
  return String(val).trim();
}

export function computeConfigDiff(raw: ProxyNode, ipshub: ProxyNode): ConfigDiffItem[] {
  const diffs: ConfigDiffItem[] = [];

  for (const { field, risk } of FIELD_RISK) {
    const rawVal = ((raw as unknown) as Record<string, unknown>)[field] ?? null;
    const hubVal = ((ipshub as unknown) as Record<string, unknown>)[field] ?? null;

    if (normalize(rawVal) !== normalize(hubVal)) {
      diffs.push({ field, rawValue: rawVal, normalizedValue: hubVal, risk });
    }
  }

  return diffs;
}

export function hasCriticalDiff(diffs: ConfigDiffItem[]): boolean {
  return diffs.some((d) => d.risk === 'critical');
}

export function hasHighDiff(diffs: ConfigDiffItem[]): boolean {
  return diffs.some((d) => d.risk === 'critical' || d.risk === 'high');
}
