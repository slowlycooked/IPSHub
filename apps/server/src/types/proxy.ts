// Proxy node types and utilities

export type ProxyProtocol = 'ss' | 'vmess' | 'trojan' | 'http' | 'socks5' | 'vless';

export interface ProxyNode {
  // Unique identifier based on protocol and config
  fingerprint: string;
  
  // Basic info
  name: string;
  protocol: ProxyProtocol;
  server: string;
  port: number;
  
  // Protocol-specific fields
  password?: string;
  cipher?: string;
  
  // Vmess/Vless
  uuid?: string;
  alterId?: number;
  tls?: string;
  tlsInsecure?: boolean;
  transport?: string;
  host?: string;
  path?: string;
  obfs?: string;
  obfsHost?: string;
  
  // Trojan
  allowInsecure?: boolean;
  
  // Socks5/HTTP
  username?: string;
  
  // Custom fields
  tag?: string;
  udpRelay?: boolean;
  enabled?: boolean;
  
  // Metadata
  providerId?: string;
  provider?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface ParseResult {
  nodes: ProxyNode[];
  errors: Array<{ raw: string; error: string }>;
}

export interface ProviderSnapshot {
  providerId: string;
  nodes: ProxyNode[];
  parsedAt: string;
  format: string;
  nodeCount: number;
}
