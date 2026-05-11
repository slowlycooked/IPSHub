export type NodeProtocol = 'vmess' | 'vless' | 'trojan' | 'ss' | 'socks5' | 'http';

export interface NodeItem {
  id: string;
  name: string;
  providerId: string;
  protocol: NodeProtocol;
  server: string;
  port: number;
  tag?: string;
  enabled: boolean;
  createdAt?: number;
  updatedAt?: number;
}
