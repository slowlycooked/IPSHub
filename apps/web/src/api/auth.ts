import { apiClient } from '@/api/client';
import type { User } from '@/types/api';

interface LoginPayload {
  username: string;
  password: string;
}

export const authApi = {
  login: (payload: LoginPayload) => apiClient.post<{ user: User }>('/api/auth/login', payload),
  logout: () => apiClient.post<{ message: string }>('/api/auth/logout'),
  me: () => apiClient.get<{ user: User }>('/api/auth/me'),
};
