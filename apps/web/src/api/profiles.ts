import { apiClient } from '@/api/client';
import type { ClashConfig, Profile } from '@/types/profile';

export type ProfilePayload = {
  name: string;
  description?: string;
  output_format: string;
  include_protocols?: string[];
  exclude_keywords?: string[];
  clash_config?: ClashConfig | null;
};

export const profilesApi = {
  list: () => apiClient.get<{ profiles: Profile[] }>('/api/profiles'),
  get: (id: string) => apiClient.get<{ profile: Profile }>(`/api/profiles/${id}`),
  create: (payload: ProfilePayload) => apiClient.post<{ profile: Profile }>('/api/profiles', payload),
  update: (id: string, payload: Partial<ProfilePayload>) => apiClient.put<{ profile: Profile }>(`/api/profiles/${id}`, payload),
  delete: (id: string) => apiClient.delete<{ message: string }>(`/api/profiles/${id}`),
  regenerateToken: (id: string) => apiClient.post<{ profile: Profile }>(`/api/profiles/${id}/regenerate-token`),
};
