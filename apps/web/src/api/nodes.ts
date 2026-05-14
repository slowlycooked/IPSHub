import { apiClient } from '@/api/client';
import type { NodeConnectivityResult, NodeItem } from '@/types/node';

export const nodesApi = {
  list: () => apiClient.get<{ nodes: NodeItem[] }>('/api/nodes'),
  get: (id: string) => apiClient.get<{ node: NodeItem }>(`/api/nodes/${id}`),
  update: (id: string, payload: Partial<NodeItem>) => apiClient.put<{ node: NodeItem }>(`/api/nodes/${id}`, payload),
  enable: (id: string) => apiClient.post<{ message: string }>(`/api/nodes/${id}/enable`),
  disable: (id: string) => apiClient.post<{ message: string }>(`/api/nodes/${id}/disable`),
  testLatency: (payload?: { timeoutMs?: number }) =>
    apiClient.post<{ results: NodeConnectivityResult[]; total: number; checkedAt: number }>(
      '/api/nodes/test-latency',
      payload
    ),
};
