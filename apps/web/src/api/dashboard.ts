import { apiClient } from '@/api/client';
import type { DashboardData } from '@/types/dashboard';
import { providersApi } from '@/api/providers';

function fallbackDashboardData(): DashboardData {
  return {
    stats: {
      totalProviders: 0,
      enabledProviders: 0,
      totalNodes: 0,
      enabledNodes: 0,
      totalProfiles: 0,
      totalRefreshJobs: 0,
    },
    recentRefreshes: [],
    recentAccessLogs: [],
    topProfiles: [],
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
          totalProviders: providers.length,
          enabledProviders: providers.filter((provider) => provider.enabled).length,
          totalNodes: 0,
          enabledNodes: 0,
          totalProfiles: 0,
          totalRefreshJobs: 0,
          latestRefreshAt:
            providers
              .map((provider) => provider.last_refresh_at)
              .filter((value): value is number => typeof value === 'number')
              .sort((left, right) => left - right)
              .slice(-1)[0],
        },
        recentRefreshes: [],
        recentAccessLogs: [],
        topProfiles: [],
      };
    } catch {
      return fallbackDashboardData();
    }
  }
}
