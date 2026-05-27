import { parse as parseYaml } from 'yaml';
import { renderClash } from '@/core/renderers/renderClash';
import { renderLoon } from '@/core/renderers/renderLoon';
import type { ProxyNode } from '@/types/proxy';

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateClashConfig(nodes: ProxyNode[]): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (nodes.length === 0) {
    return { valid: false, errors: ['No nodes to validate'], warnings };
  }

  let parsed: Record<string, unknown>;
  let yaml: string;
  try {
    yaml = renderClash(nodes);
    parsed = parseYaml(yaml) as Record<string, unknown>;
  } catch (err) {
    return {
      valid: false,
      errors: [`Clash YAML render/parse failed: ${err instanceof Error ? err.message : String(err)}`],
      warnings,
    };
  }

  const proxies = parsed['proxies'];
  if (!Array.isArray(proxies) || proxies.length === 0) {
    errors.push('No proxies array in generated Clash config');
  } else {
    for (const proxy of proxies as Record<string, unknown>[]) {
      if (!proxy['name']) errors.push(`A proxy is missing a name field`);
      if (!proxy['server']) errors.push(`Proxy "${proxy['name']}" is missing server`);
      if (!proxy['port']) errors.push(`Proxy "${proxy['name']}" is missing port`);
      if (!proxy['type']) errors.push(`Proxy "${proxy['name']}" is missing type`);
    }

    const proxyNames = new Set(
      (proxies as Record<string, unknown>[]).map((p) => p['name'] as string),
    );
    const proxyGroups = parsed['proxy-groups'];
    if (Array.isArray(proxyGroups)) {
      for (const group of proxyGroups as Record<string, unknown>[]) {
        const refs = group['proxies'];
        if (Array.isArray(refs)) {
          for (const ref of refs as string[]) {
            if (ref !== 'DIRECT' && ref !== 'REJECT' && !proxyNames.has(ref)) {
              warnings.push(`Proxy group "${group['name']}" references unknown proxy: "${ref}"`);
            }
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateLoonConfig(nodes: ProxyNode[]): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (nodes.length === 0) {
    return { valid: false, errors: ['No nodes to validate'], warnings };
  }

  let lines: string[];
  try {
    const output = renderLoon(nodes);
    lines = output
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));
  } catch (err) {
    return {
      valid: false,
      errors: [`Loon render failed: ${err instanceof Error ? err.message : String(err)}`],
      warnings,
    };
  }

  if (lines.length === 0) {
    errors.push('Loon config produced no proxy lines');
  } else {
    for (const line of lines) {
      // Format: Name = TYPE,server,port,[uuid/pass],options...
      if (!line.includes('=')) {
        warnings.push(`Unexpected Loon line format: ${line.slice(0, 60)}`);
        continue;
      }
      const [, rest] = line.split('=', 2).map((s) => s.trim());
      if (!rest) {
        errors.push(`Loon line has empty value: ${line.slice(0, 60)}`);
        continue;
      }
      const parts = rest.split(',').map((s) => s.trim());
      if (parts.length < 3) {
        errors.push(`Loon proxy line has too few fields: ${line.slice(0, 80)}`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
