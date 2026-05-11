export type JobStatus = 'success' | 'failed' | 'running' | 'pending';

export interface RefreshJobLog {
  id: string;
  providerId: string;
  providerName: string;
  status: JobStatus;
  nodeCount?: number;
  durationMs?: number;
  createdAt?: number;
  updatedAt?: number;
  errorMessage?: string;
}

export interface AccessLog {
  id: string;
  profileId: string;
  profileName: string;
  outputFormat: string;
  ipAddress?: string;
  userAgent?: string;
  statusCode?: number;
  responseSize?: number;
  durationMs?: number;
  accessedAt: number;
}
