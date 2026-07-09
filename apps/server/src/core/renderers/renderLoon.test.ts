import { describe, expect, it } from 'vitest';
import { parseUriList } from '@/core/parsers/parseUriList';
import type { ClashConfig } from '@/types/clashConfig';
import type { ProxyNode } from '@/types/proxy';
import { renderLoon } from './renderLoon';

const UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('renderLoon – VLESS', () => {
  it('renders VLESS TCP TLS', () => {
    const uri = `vless://${UUID}@server.example.com:443?security=tls&sni=server.example.com&type=tcp#VLESS-TCP-TLS`;
    const { nodes } = parseUriList(uri);
    expect(nodes).toHaveLength(1);

    const line = renderLoon(nodes);
    expect(line).toBe(
      `VLESS-TCP-TLS = VLESS,server.example.com,443,"${UUID}",transport=tcp,over-tls=true,sni=server.example.com,skip-cert-verify=false`
    );
  });

  it('renders VLESS WS TLS', () => {
    const uri = `vless://${UUID}@server.example.com:443?security=tls&sni=server.example.com&type=ws&path=%2Fws#VLESS-WS-TLS`;
    const { nodes } = parseUriList(uri);
    expect(nodes).toHaveLength(1);

    const line = renderLoon(nodes);
    expect(line).toBe(
      `VLESS-WS-TLS = VLESS,server.example.com,443,"${UUID}",transport=ws,path=/ws,host=server.example.com,over-tls=true,sni=server.example.com,skip-cert-verify=false`
    );
  });

  it('renders VLESS HTTP TLS', () => {
    const uri = `vless://${UUID}@server.example.com:443?security=tls&sni=server.example.com&type=http&path=%2Fapi#VLESS-HTTP-TLS`;
    const { nodes } = parseUriList(uri);
    expect(nodes).toHaveLength(1);

    const line = renderLoon(nodes);
    expect(line).toBe(
      `VLESS-HTTP-TLS = VLESS,server.example.com,443,"${UUID}",transport=http,path=/api,host=server.example.com,over-tls=true,sni=server.example.com,skip-cert-verify=false`
    );
  });

  it('renders VLESS H2 TLS as transport=http', () => {
    const uri = `vless://${UUID}@server.example.com:443?security=tls&sni=server.example.com&type=h2&path=%2Fh2#VLESS-H2-TLS`;
    const { nodes } = parseUriList(uri);
    expect(nodes).toHaveLength(1);

    const line = renderLoon(nodes);
    expect(line).toBe(
      `VLESS-H2-TLS = VLESS,server.example.com,443,"${UUID}",transport=http,path=/h2,host=server.example.com,over-tls=true,sni=server.example.com,skip-cert-verify=false`
    );
  });

  it('renders VLESS TCP REALITY with Vision flow', () => {
    const uri = `vless://${UUID}@server.example.com:443?security=reality&sni=microsoft.com&type=tcp&flow=xtls-rprx-vision&pbk=mypublickey&sid=myshortid#VLESS-REALITY`;
    const { nodes } = parseUriList(uri);
    expect(nodes).toHaveLength(1);

    const line = renderLoon(nodes);
    expect(line).toBe(
      `VLESS-REALITY = VLESS,server.example.com,443,"${UUID}",transport=tcp,flow=xtls-rprx-vision,public-key="mypublickey",short-id=myshortid,udp=true,over-tls=true,sni=microsoft.com,skip-cert-verify=true`
    );
  });

  it('skips unsupported VLESS gRPC transport', () => {
    const uri = `vless://${UUID}@server.example.com:443?security=tls&type=grpc&serviceName=myservice#VLESS-GRPC`;
    const { nodes } = parseUriList(uri);
    expect(nodes).toHaveLength(1);

    const line = renderLoon(nodes);
    expect(line).toBe('');
  });

  it('skips unsupported VLESS xhttp transport', () => {
    const uri = `vless://${UUID}@server.example.com:443?security=tls&type=xhttp#VLESS-XHTTP`;
    const { nodes } = parseUriList(uri);
    expect(nodes).toHaveLength(1);

    expect(renderLoon(nodes)).toBe('');
  });

  it('skips unsupported VLESS splithttp transport', () => {
    const uri = `vless://${UUID}@server.example.com:443?security=tls&type=splithttp#VLESS-SPLITHTTP`;
    const { nodes } = parseUriList(uri);
    expect(nodes).toHaveLength(1);

    expect(renderLoon(nodes)).toBe('');
  });

  it('skips unsupported VLESS REALITY + gRPC combination', () => {
    const uri = `vless://${UUID}@server.example.com:443?security=reality&type=grpc&pbk=mypublickey&sid=sid#VLESS-REALITY-GRPC`;
    const { nodes } = parseUriList(uri);
    expect(nodes).toHaveLength(1);

    expect(renderLoon(nodes)).toBe('');
  });

  it('renders VLESS skip-cert-verify=true when tlsInsecure is set', () => {
    const uri = `vless://${UUID}@server.example.com:443?security=tls&sni=server.example.com&type=tcp&allowInsecure=1#VLESS-INSECURE`;
    const { nodes } = parseUriList(uri);
    expect(nodes).toHaveLength(1);
    // Force tlsInsecure since parser may not map allowInsecure
    nodes[0].tlsInsecure = true;

    const line = renderLoon(nodes);
    expect(line).toBe(
      `VLESS-INSECURE = VLESS,server.example.com,443,"${UUID}",transport=tcp,over-tls=true,sni=server.example.com,skip-cert-verify=true`
    );
  });
});

describe('renderLoon – Trojan', () => {
  it('renders Trojan with SNI and TLS', () => {
    const uri = `trojan://mypassword@server.example.com:443?sni=server.example.com#Trojan-TLS`;
    const { nodes } = parseUriList(uri);
    expect(nodes).toHaveLength(1);

    const line = renderLoon(nodes);
    expect(line).toBe(
      `Trojan-TLS = Trojan,server.example.com,443,"mypassword",over-tls=true,sni=server.example.com,skip-cert-verify=false`
    );
  });

  it('renders Trojan with allowInsecure', () => {
    const uri = `trojan://mypassword@server.example.com:443?sni=server.example.com&allowInsecure=true#Trojan-Insecure`;
    const { nodes } = parseUriList(uri);
    expect(nodes).toHaveLength(1);

    const line = renderLoon(nodes);
    expect(line).toBe(
      `Trojan-Insecure = Trojan,server.example.com,443,"mypassword",over-tls=true,sni=server.example.com,skip-cert-verify=true`
    );
  });

  it('falls back to server as SNI when no sni param', () => {
    const uri = `trojan://mypassword@server.example.com:443#Trojan-NoSNI`;
    const { nodes } = parseUriList(uri);
    expect(nodes).toHaveLength(1);

    const line = renderLoon(nodes);
    expect(line).toBe(
      `Trojan-NoSNI = Trojan,server.example.com,443,"mypassword",over-tls=true,sni=server.example.com,skip-cert-verify=false`
    );
  });

  it('native format passes validator field-count check', () => {
    const uri = `trojan://mypassword@server.example.com:443?sni=server.example.com#Trojan-Valid`;
    const { nodes } = parseUriList(uri);
    const line = renderLoon(nodes);
    // Validator splits on first '=' and checks comma parts >= 3
    const rest = line.split('=', 2)[1]?.trim() ?? '';
    const parts = rest.split(',').map((s) => s.trim());
    expect(parts.length).toBeGreaterThanOrEqual(3);
  });
});

describe('renderLoon – VMess', () => {
  it('renders VMess TCP plain', () => {
    const uri = `vmess://${Buffer.from(JSON.stringify({ v: '2', ps: 'VMess-TCP', add: 'server.example.com', port: 443, id: UUID, aid: 0, net: 'tcp', type: 'none', host: '', path: '', tls: 'none' })).toString('base64')}`;
    const { nodes } = parseUriList(uri);
    expect(nodes).toHaveLength(1);

    const line = renderLoon(nodes);
    expect(line).toBe(
      `VMess-TCP = VMess,server.example.com,443,aes-128-gcm,"${UUID}",transport=tcp`
    );
  });

  it('renders VMess WS TLS', () => {
    const uri = `vmess://${Buffer.from(JSON.stringify({ v: '2', ps: 'VMess-WS-TLS', add: 'server.example.com', port: 443, id: UUID, aid: 0, net: 'ws', type: 'none', host: 'server.example.com', path: '/ws', tls: 'tls' })).toString('base64')}`;
    const { nodes } = parseUriList(uri);
    expect(nodes).toHaveLength(1);

    const line = renderLoon(nodes);
    expect(line).toBe(
      `VMess-WS-TLS = VMess,server.example.com,443,aes-128-gcm,"${UUID}",transport=ws,path=/ws,host=server.example.com,over-tls=true,sni=server.example.com,skip-cert-verify=false`
    );
  });
});

describe('renderLoon – Hysteria2', () => {
  it('renders Hysteria2 in Loon native format with udp enabled', () => {
    const node: ProxyNode = {
      fingerprint: 'hy2-1',
      name: 'HY2 01',
      protocol: 'hysteria2',
      server: 'hy2.example.com',
      port: 8443,
      password: 'secret',
      host: 'sni.example.com',
      tlsInsecure: true,
    };

    expect(renderLoon([node])).toBe(
      'HY2 01 = Hysteria2,hy2.example.com,8443,"secret",skip-cert-verify=true,sni=sni.example.com,udp=true'
    );
  });

  it('maps obfs-password to salamander-password', () => {
    const uri =
      'hysteria2://secret@hy2.example.com:8443/?sni=sni.example.com&obfs=salamander&obfs-password=obfsSecret#HY2%2001';
    const { nodes } = parseUriList(uri);

    expect(renderLoon(nodes)).toContain('salamander-password=obfsSecret');
  });

  it('parses base64 hy2 URI lists without filtering Hysteria2 nodes', () => {
    const uri = 'hy2://secret@hy2.example.com:8443/?sni=sni.example.com#HY2%2001';
    const { nodes } = parseUriList(Buffer.from(uri).toString('base64'));

    expect(nodes).toHaveLength(1);
    expect(nodes[0].protocol).toBe('hysteria2');
    expect(renderLoon(nodes)).toContain('HY2 01 = Hysteria2');
  });

  it('maps tfo and fast-open to fast-open', () => {
    const node: ProxyNode = {
      fingerprint: 'hy2-1',
      name: 'HY2 01',
      protocol: 'hysteria2',
      server: 'hy2.example.com',
      port: 8443,
      password: 'secret',
      extraData: {
        tfo: true,
      },
    };

    expect(renderLoon([node])).toContain('fast-open=true');
  });

  it('keeps Hysteria2 node references in Loon policy groups', () => {
    const nodes: ProxyNode[] = [
      {
        fingerprint: 'hy2-1',
        name: 'HY2 01',
        protocol: 'hysteria2',
        server: 'hy2.example.com',
        port: 8443,
        password: 'secret',
      },
    ];
    const config: ClashConfig = {
      target: 'loon',
      proxyGroups: [
        {
          name: 'Manual',
          type: 'select',
          source: { type: 'manual', proxies: ['HY2 01'] },
          includeDirect: true,
        },
      ],
      rules: [{ type: 'MATCH', policy: 'Manual' }],
    };

    const output = renderLoon(nodes, config);

    expect(output).toContain('[Proxy Group]');
    expect(output).toContain('Manual = select,HY2 01,DIRECT');
  });
});
