export type OutputType = 'clash' | 'clash_provider' | 'loon' | 'raw';

export interface Profile {
  id: string;
  name: string;
  description?: string;
  output_format: OutputType;
  include_protocols?: string[];
  exclude_keywords?: string[];
  access_count: number;
  last_accessed_at?: number;
  token?: string;
  updated_at: number;
  created_at: number;
}

export interface ProfileUrls {
  clash: string;
  loon: string;
  raw: string;
  provider: string;
}
