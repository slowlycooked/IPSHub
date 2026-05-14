import { ProxyNode } from '@/types/proxy';

/**
 * Transports not supported by Loon's VLESS implementation.
 */
const UNSUPPORTED_VLESS_TRANSPORTS = new Set(['grpc', 'xhttp', 'splithttp', 'quic']);

/**
 * 将节点渲染为 Loon 格式
 * Loon 使用原生配置行格式，每行一个节点
 */
export function renderLoon(nodes: ProxyNode[]): string {
  return nodes
    .map(nodeToLoonLine)
    .filter(Boolean)
    .join('\n');
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
      const opts = ['over-tls=true', `sni=${sni}`, `skip-cert-verify=${skipVerify ? 'true' : 'false'}`];
      return `${node.name} = Trojan,${node.server},${node.port},"${password}",${opts.join(',')}`;
    }

    case 'vless':
      return vlessToLoon(node);

    case 'hysteria2': {
      const password = node.password || '';
      const opts: string[] = [];
      const sni = node.host || '';
      if (sni) opts.push(`sni=${sni}`);
      const skipVerify = node.tlsInsecure || node.allowInsecure || false;
      opts.push(`skip-cert-verify=${skipVerify ? 'true' : 'false'}`);
      const mport = node.extraData?.['mport'];
      if (mport) opts.push(`download-bandwidth=0`, `upload-bandwidth=0`);
      return `${node.name} = Hysteria2,${node.server},${node.port},${password}${opts.length ? ',' + opts.join(',') : ''}`;
    }

    default:
      return null;
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
