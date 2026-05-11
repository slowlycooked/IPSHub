export type ProviderType = 'auto' | 'clash' | 'base64-uri' | 'uri-list';

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  subscription_url?: string;
  maskedUrl?: string;
  enabled: boolean;
  refresh_interval_minutes: number;
  timeout_seconds: number;
  user_agent?: string;
  request_headers_json?: string;
  provider_prefix?: string;
  last_refresh_at?: string;
  last_success_at?: string;
  last_error?: string;
  last_node_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProviderInput {
  name: string;
  type: ProviderType;
  subscription_url?: string;
  enabled: boolean;
  refresh_interval_minutes: number;
  timeout_seconds: number;
  user_agent?: string;
  request_headers_json?: string;
  provider_prefix?: string;
}
