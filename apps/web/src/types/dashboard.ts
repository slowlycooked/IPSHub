import type { AccessLog, RefreshJobLog } from '@/types/logs';
import type { Profile } from '@/types/profile';

export interface DashboardStats {
  totalProviders: number;
  enabledProviders: number;
  totalNodes: number;
  enabledNodes: number;
  totalProfiles: number;
  totalRefreshJobs: number;
  latestRefreshAt?: number;
}

export interface DashboardData {
  stats: DashboardStats;
  recentRefreshes: RefreshJobLog[];
  recentAccessLogs: AccessLog[];
  topProfiles: Pick<Profile, 'id' | 'name' | 'access_count' | 'last_accessed_at'>[];
}
