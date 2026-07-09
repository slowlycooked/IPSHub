import { ProxyNode } from '@/types/proxy';
import type { ClashConfig, ProxyGroupConfig, ProxyGroupSource } from '@/types/clashConfig';

/**
 * Transports not supported by Loon's VLESS implementation.
 */
const UNSUPPORTED_VLESS_TRANSPORTS = new Set(['grpc', 'xhttp', 'splithttp', 'quic']);

/**
 * 将节点渲染为 Loon 格式
 * Loon 使用原生配置行格式，每行一个节点
 */
export function renderLoon(nodes: ProxyNode[], config?: ClashConfig | null): string {
  const renderedNodes = nodes
    .map((node) => ({ node, line: nodeToLoonLine(node) }))
    .filter((item): item is { node: ProxyNode; line: string } => item.line !== null);

  const proxyLines = renderedNodes.map((item) => item.line);
  const renderableNodes = renderedNodes.map((item) => item.node);
  const policyGroups = Array.isArray(config?.proxyGroups)
    ? renderLoonPolicyGroups(config.proxyGroups, renderableNodes)
    : [];

  if (policyGroups.length === 0) {
    return proxyLines.join('\n');
  }

  return ['[Proxy]', ...proxyLines, '', '[Proxy Group]', ...policyGroups].join('\n');
}

function nodeToLoonLine(node: ProxyNode): string | null {
  switch (node.protocol) {
    case 'ss': {
      const cipher = node.cipher || 'aes-256-gcm';
      const password = encodeURIComponent(node.password || '');
      return `ss://${cipher}:${password}@${node.server}:${node.port}#${encodeURIComponent(node.name)}`;
    }

    case 'vmess': {
      const cipher = node.cipher || 'aes-128-gcm';
      const transport = (node.transport || 'tcp').toLowerCase();
      const opts: string[] = [`transport=${transport}`];
      if (transport === 'ws' || transport === 'http') {
        if (node.path) opts.push(`path=${node.path}`);
        if (node.host) opts.push(`host=${node.host}`);
      }
      const hasTls = !!node.tls && node.tls !== 'none';
      if (hasTls) {
        opts.push('over-tls=true');
        if (node.host) opts.push(`sni=${node.host}`);
        opts.push(`skip-cert-verify=${node.tlsInsecure ? 'true' : 'false'}`);
      }
      return `${node.name} = VMess,${node.server},${node.port},${cipher},"${node.uuid || ''}",${opts.join(',')}`;
    }

    case 'trojan': {
      const password = node.password || '';
      const sni = node.host || node.server;
      const skipVerify = node.allowInsecure ?? node.tlsInsecure ?? false;
      const opts = [
        'over-tls=true',
        `sni=${sni}`,
        `skip-cert-verify=${skipVerify ? 'true' : 'false'}`,
      ];
      return `${node.name} = Trojan,${node.server},${node.port},"${password}",${opts.join(',')}`;
    }

    case 'vless':
      return vlessToLoon(node);

    case 'hysteria2': {
      const password = node.password || '';
      const opts: string[] = [
        `skip-cert-verify=${node.tlsInsecure || node.allowInsecure ? 'true' : 'false'}`,
      ];
      const sni = node.host || '';
      if (sni) opts.push(`sni=${sni}`);
      opts.push(`udp=${(node.udpRelay ?? true) ? 'true' : 'false'}`);
      const fastOpen = readOptionalBoolean(
        node.extraData?.['fast-open'] ?? node.extraData?.['tfo']
      );
      if (fastOpen !== undefined) {
        opts.push(`fast-open=${fastOpen ? 'true' : 'false'}`);
      }
      const obfsPassword =
        node.extraData?.['salamander-password'] ?? node.extraData?.['obfs-password'];
      if (typeof obfsPassword === 'string' && obfsPassword.length > 0) {
        opts.push(`salamander-password=${obfsPassword}`);
      }
      return `${node.name} = Hysteria2,${node.server},${node.port},${quoteLoonValue(password)},${opts.join(',')}`;
    }

    default:
      return null;
  }
}

function quoteLoonValue(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function readOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }
  return undefined;
}

function renderLoonPolicyGroups(groups: ProxyGroupConfig[], nodes: ProxyNode[]): string[] {
  const proxyNames = nodes.map((node) => node.name);

  return groups
    .map((group) => {
      const proxies = [...resolveLoonGroupProxies(group.source, proxyNames, nodes)];
      if (group.includeGroups) {
        proxies.push(...group.includeGroups);
      }
      if (group.includeDirect) {
        proxies.push('DIRECT');
      }
      if (group.includeReject) {
        proxies.push('REJECT');
      }
      return { group, proxies };
    })
    .filter(({ proxies }) => proxies.length > 0)
    .map(({ group, proxies }) => `${group.name} = ${group.type},${proxies.join(',')}`);
}

function resolveLoonGroupProxies(
  source: ProxyGroupSource,
  proxyNames: string[],
  nodes: ProxyNode[]
): string[] {
  switch (source.type) {
    case 'all':
      return [...proxyNames];
    case 'manual':
      return source.proxies.filter((proxy) => proxyNames.includes(proxy));
    case 'region': {
      const keywords = source.keywords.map((keyword) => keyword.toLowerCase());
      return proxyNames.filter((name) =>
        keywords.some((keyword) => name.toLowerCase().includes(keyword))
      );
    }
    case 'tag': {
      const tags = source.tags.map((tag) => tag.toLowerCase());
      const nodesByName = new Map(nodes.map((node) => [node.name, node]));
      return proxyNames.filter((name) => {
        const node = nodesByName.get(name);
        if (!node?.tag) return false;
        return tags.some((tag) => node.tag!.toLowerCase().includes(tag));
      });
    }
    case 'regex': {
      try {
        const re = new RegExp(source.pattern, 'i');
        return proxyNames.filter((name) => re.test(name));
      } catch {
        return [];
      }
    }
  }
}

/**
 * Renders a VLESS node as a Loon native proxy line.
 *
 * Loon format:
 *   Name = VLESS,server,port,"uuid",transport=tcp[,option=value,...]
 *
 * Unsupported transports (grpc, xhttp, splithttp, quic) are filtered out
 * by returning null.
 */
function vlessToLoon(node: ProxyNode): string | null {
  const rawTransport = (node.transport || 'tcp').toLowerCase();

  if (UNSUPPORTED_VLESS_TRANSPORTS.has(rawTransport)) return null;

  const isReality = node.tls === 'reality';
  // Loon uses "http" for both HTTP and H2 transports
  const transport = rawTransport === 'h2' ? 'http' : rawTransport;

  const opts: string[] = [`transport=${transport}`];

  if (isReality) {
    if (node.flow) opts.push(`flow=${node.flow}`);
    if (node.realityPublicKey) opts.push(`public-key="${node.realityPublicKey}"`);
    if (node.realityShortId !== undefined && node.realityShortId !== '') {
      opts.push(`short-id=${node.realityShortId}`);
    }
    opts.push('udp=true', 'over-tls=true');
    if (node.host) opts.push(`sni=${node.host}`);
    opts.push('skip-cert-verify=true');
  } else {
    if (transport === 'ws' || transport === 'http') {
      if (node.path) opts.push(`path=${node.path}`);
      if (node.host) opts.push(`host=${node.host}`);
    }

    const hasTls = !!node.tls && node.tls !== 'none';
    if (hasTls) {
      opts.push('over-tls=true');
      if (node.host) opts.push(`sni=${node.host}`);
      opts.push(`skip-cert-verify=${node.tlsInsecure ? 'true' : 'false'}`);
    }
  }

  return `${node.name} = VLESS,${node.server},${node.port},"${node.uuid || ''}",${opts.join(',')}`;
}
