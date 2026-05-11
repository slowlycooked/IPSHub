export type JobStatus = 'success' | 'failed' | 'running' | 'queued';

export interface RefreshJobLog {
  id: string;
  provider_name: string;
  status: JobStatus;
  node_count?: number;
  started_at?: string;
  finished_at?: string;
  error?: string;
}

export interface AccessLog {
  id: string;
  profile_name: string;
  output_type: string;
  client_ip: string;
  user_agent: string;
  status_code: number;
  created_at: string;
}
