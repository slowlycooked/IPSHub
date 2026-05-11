export type OutputType = 'clash' | 'mihomo' | 'loon' | 'raw';

export interface ProfileFilter {
  includeProviders: string[];
  excludeProviders: string[];
  includeNameRegex: string[];
  excludeNameRegex: string[];
  includeProtocols: string[];
  excludeProtocols: string[];
  onlyEnabled: boolean;
}

export interface Profile {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  output_type: OutputType;
  rename_template?: string;
  filter_json?: string;
  token?: string;
  updated_at: string;
  created_at: string;
}

export interface ProfileUrls {
  clash: string;
  loon: string;
  raw: string;
  provider: string;
}
