import type { ApiResponse } from '@/types/api';
import { HttpError } from '@/types/api';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

function emitApiError(message: string): void {
  window.dispatchEvent(new CustomEvent('ipshub:api-error', { detail: { message } }));
}

async function request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = null;
  }

  if (response.status === 401 && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }

  if (!response.ok || !payload?.success) {
    const message = payload?.error?.message || `Request failed with status ${response.status}`;
    const code = payload?.error?.code;
    emitApiError(message);
    throw new HttpError(message, response.status, code);
  }

  return payload.data as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
