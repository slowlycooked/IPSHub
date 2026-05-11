/**
 * 获取服务器公开配置（APP_BASE_URL 等）。
 * 用于反向代理场景：管理员通过内网 IP 访问，但订阅链接需要指向公网地址。
 */
export async function fetchServerConfig(): Promise<{ baseUrl: string }> {
  const res = await fetch('/api/config', { credentials: 'include' });
  if (!res.ok) return { baseUrl: '' };
  try {
    return (await res.json()) as { baseUrl: string };
  } catch {
    return { baseUrl: '' };
  }
}
