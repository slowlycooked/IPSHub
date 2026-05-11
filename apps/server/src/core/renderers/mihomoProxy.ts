import { ProxyNode } from '@/types/proxy';

export function nodeToMihomoProxy(node: ProxyNode): Record<string, unknown> | null {
  const proxy: Record<string, unknown> = {
    name: node.name,
    type: node.protocol,
    server: node.server,
    port: node.port,
  };

  switch (node.protocol) {
    case 'ss': {
      proxy.cipher = node.cipher || 'aes-256-gcm';
      proxy.password = node.password || '';
      proxy.udp = node.udpRelay ?? true;
      return proxy;
    }

    case 'vmess': {
      proxy.uuid = node.uuid || '';
      proxy.alterId = node.alterId || 0;
      proxy.cipher = node.cipher || 'auto';
      proxy.udp = node.udpRelay ?? true;
      appendTransportAndTls(proxy, node);
      return proxy;
    }

    case 'trojan': {
      proxy.password = node.password || '';
      proxy.udp = node.udpRelay ?? true;
      if (node.host) {
        proxy.sni = node.host;
      }
      if (node.allowInsecure || node.tlsInsecure) {
        proxy['skip-cert-verify'] = true;
      }
      // Trojan supports ws/grpc transports in mihomo
      appendTransportAndTls(proxy, node, { skipTls: true });
      return proxy;
    }

    case 'vless': {
      proxy.uuid = node.uuid || '';
      proxy.udp = node.udpRelay ?? true;
      // flow (e.g. xtls-rprx-vision) is only valid with a properly configured Reality setup
      if (node.flow && node.realityPublicKey) {
        proxy.flow = node.flow;
      }
      // client-fingerprint is valid for both Reality and regular TLS
      if (node.realityFingerprint) {
        proxy['client-fingerprint'] = node.realityFingerprint;
      }
      appendTransportAndTls(proxy, node);
      appendReality(proxy, node);
      return proxy;
    }

    case 'socks5':
    case 'http': {
      if (node.username) {
        proxy.username = node.username;
        proxy.password = node.password || '';
      }
      return proxy;
    }

    case 'hysteria2': {
      proxy.password = node.password || '';
      if (node.host) {
        proxy.sni = node.host;
      }
      if (node.tlsInsecure || node.allowInsecure) {
        proxy['skip-cert-verify'] = true;
      }
      const mport = node.extraData?.['mport'];
      if (mport) {
        proxy.ports = mport;
      }
      return proxy;
    }

    default:
      return null;
  }
}

interface TransportTlsOptions {
  /** Set true to skip writing tls/servername/skip-cert-verify (e.g. trojan where TLS is implicit) */
  skipTls?: boolean;
}

function appendTransportAndTls(
  proxy: Record<string, unknown>,
  node: ProxyNode,
  opts: TransportTlsOptions = {}
): void {
  const network = node.transport || 'tcp';

  if (network !== 'tcp') {
    proxy.network = network;
  }

  if (!opts.skipTls) {
    if (node.tls && node.tls !== 'none') {
      proxy.tls = true;
      if (node.host) {
        proxy.servername = node.host;
      }
      if (node.allowInsecure || node.tlsInsecure) {
        proxy['skip-cert-verify'] = true;
      }
    }
  }

  if (network === 'ws') {
    proxy['ws-opts'] = {
      path: node.path || '/',
      headers: node.host ? { Host: node.host } : {},
    };
  }

  if (network === 'grpc') {
    proxy['grpc-opts'] = {
      'grpc-service-name': node.serviceName || '',
    };
  }

  if (network === 'h2') {
    proxy['h2-opts'] = {
      ...(node.host ? { host: [node.host] } : {}),
      path: node.path || '/',
    };
  }
}

function appendReality(proxy: Record<string, unknown>, node: ProxyNode): void {
  // public-key is mandatory in mihomo; do not emit reality-opts without it
  if (!node.realityPublicKey) {
    return;
  }

  const opts: Record<string, string> = {
    'public-key': node.realityPublicKey,
  };
  if (node.realityShortId) {
    opts['short-id'] = node.realityShortId;
  }
  if (node.realityFingerprint) {
    opts['fingerprint'] = node.realityFingerprint;
  }

  proxy['reality-opts'] = opts;
}
