import type { AccessLog, RefreshJobLog } from '@/types/logs';

export interface DashboardStats {
  providersTotal: number;
  providersEnabled: number;
  nodesTotal: number;
  profilesTotal: number;
  latestRefreshAt?: string;
}

export interface DashboardData {
  stats: DashboardStats;
  recentRefreshJobs: RefreshJobLog[];
  recentAccessLogs: AccessLog[];
}
