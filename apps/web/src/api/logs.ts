import { apiClient } from '@/api/client';
import type { AccessLog, RefreshJobLog } from '@/types/logs';

export const logsApi = {
  refreshJobs: () => apiClient.get<{ jobs: RefreshJobLog[] }>('/api/logs/refresh'),
  accessLogs: () => apiClient.get<{ logs: AccessLog[] }>('/api/logs/access'),
};
