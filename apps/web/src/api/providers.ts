import { apiClient } from '@/api/client';
import type { Provider, ProviderInput } from '@/types/provider';

export const providersApi = {
  list: () => apiClient.get<{ providers: Provider[] }>('/api/providers'),
  get: (id: string) => apiClient.get<{ provider: Provider }>(`/api/providers/${id}`),
  create: (payload: ProviderInput) => apiClient.post<{ provider: Provider }>('/api/providers', payload),
  update: (id: string, payload: Partial<ProviderInput>) =>
    apiClient.put<{ provider: Provider }>(`/api/providers/${id}`, payload),
  delete: (id: string) => apiClient.delete<{ message: string }>(`/api/providers/${id}`),
  refreshNow: (id: string) => apiClient.post<{ message: string }>(`/api/providers/${id}/refresh`),
};
