export type NodeProtocol = 'vmess' | 'vless' | 'trojan' | 'ss' | 'ssr' | 'hysteria' | 'tuic' | 'unknown';

export interface NodeItem {
  id: string;
  name: string;
  provider_id: string;
  provider_name?: string;
  protocol: NodeProtocol;
  server: string;
  port: number;
  region?: string;
  enabled: boolean;
  last_seen_at?: string;
  updated_at?: string;
}
