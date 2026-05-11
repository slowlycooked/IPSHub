import { apiClient } from '@/api/client';
import type { DashboardData } from '@/types/dashboard';
import { providersApi } from '@/api/providers';

function fallbackDashboardData(): DashboardData {
  return {
    stats: {
      providersTotal: 0,
      providersEnabled: 0,
      nodesTotal: 0,
      profilesTotal: 0,
    },
    recentRefreshJobs: [],
    recentAccessLogs: [],
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  try {
    return await apiClient.get<DashboardData>('/api/dashboard');
  } catch {
    try {
      const providerData = await providersApi.list();
      const providers = providerData.providers || [];
      return {
        stats: {
          providersTotal: providers.length,
          providersEnabled: providers.filter((provider) => provider.enabled).length,
          nodesTotal: 0,
          profilesTotal: 0,
          latestRefreshAt:
            providers
              .map((provider) => provider.last_refresh_at)
              .filter((value): value is string => Boolean(value))
              .sort()
              .slice(-1)[0] || undefined,
        },
        recentRefreshJobs: [],
        recentAccessLogs: [],
      };
    } catch {
      return fallbackDashboardData();
    }
  }
}
