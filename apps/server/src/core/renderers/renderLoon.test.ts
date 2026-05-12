import { describe, expect, it } from 'vitest';
import { parseUriList } from '@/core/parsers/parseUriList';
import { renderLoon } from './renderLoon';

const UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('renderLoon – VLESS', () => {
  it('renders VLESS TCP TLS', () => {
    const uri = `vless://${UUID}@server.example.com:443?security=tls&sni=server.example.com&type=tcp#VLESS-TCP-TLS`;
    const { nodes } = parseUriList(uri);
    expect(nodes).toHaveLength(1);

    const line = renderLoon(nodes);
    expect(line).toBe(
      `VLESS-TCP-TLS = VLESS,server.example.com,443,"${UUID}",transport=tcp,over-tls=true,sni=server.example.com,skip-cert-verify=false`,
    );
  });

  it('renders VLESS WS TLS', () => {
    const uri = `vless://${UUID}@server.example.com:443?security=tls&sni=server.example.com&type=ws&path=%2Fws#VLESS-WS-TLS`;
    const { nodes } = parseUriList(uri);
    expect(nodes).toHaveLength(1);

    const line = renderLoon(nodes);
    expect(line).toBe(
      `VLESS-WS-TLS = VLESS,server.example.com,443,"${UUID}",transport=ws,path=/ws,host=server.example.com,over-tls=true,sni=server.example.com,skip-cert-verify=false`,
    );
  });

  it('renders VLESS HTTP TLS', () => {
    const uri = `vless://${UUID}@server.example.com:443?security=tls&sni=server.example.com&type=http&path=%2Fapi#VLESS-HTTP-TLS`;
    const { nodes } = parseUriList(uri);
    expect(nodes).toHaveLength(1);

    const line = renderLoon(nodes);
    expect(line).toBe(
      `VLESS-HTTP-TLS = VLESS,server.example.com,443,"${UUID}",transport=http,path=/api,host=server.example.com,over-tls=true,sni=server.example.com,skip-cert-verify=false`,
    );
  });

  it('renders VLESS H2 TLS as transport=http', () => {
    const uri = `vless://${UUID}@server.example.com:443?security=tls&sni=server.example.com&type=h2&path=%2Fh2#VLESS-H2-TLS`;
    const { nodes } = parseUriList(uri);
    expect(nodes).toHaveLength(1);

    const line = renderLoon(nodes);
    expect(line).toBe(
      `VLESS-H2-TLS = VLESS,server.example.com,443,"${UUID}",transport=http,path=/h2,host=server.example.com,over-tls=true,sni=server.example.com,skip-cert-verify=false`,
    );
  });

  it('renders VLESS TCP REALITY with Vision flow', () => {
    const uri = `vless://${UUID}@server.example.com:443?security=reality&sni=microsoft.com&type=tcp&flow=xtls-rprx-vision&pbk=mypublickey&sid=myshortid#VLESS-REALITY`;
    const { nodes } = parseUriList(uri);
    expect(nodes).toHaveLength(1);

    const line = renderLoon(nodes);
    expect(line).toBe(
      `VLESS-REALITY = VLESS,server.example.com,443,"${UUID}",transport=tcp,flow=xtls-rprx-vision,public-key="mypublickey",short-id=myshortid,udp=true,over-tls=true,sni=microsoft.com,skip-cert-verify=true`,
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
      `VLESS-INSECURE = VLESS,server.example.com,443,"${UUID}",transport=tcp,over-tls=true,sni=server.example.com,skip-cert-verify=true`,
    );
  });
});
