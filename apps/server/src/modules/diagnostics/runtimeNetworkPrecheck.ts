import { safeFetch } from '@/core/fetcher/ssrfGuard';

const PRECHECK_URLS = [
  'http://www.gstatic.com/generate_204',
  'http://cp.cloudflare.com/generate_204',
  'https://www.apple.com/library/test/success.html',
];

export interface PrecheckResult {
  healthy: boolean;
  checks: Array<{ url: string; ok: boolean; latencyMs: number; error?: string }>;
  checkedAt: string;
}

export async function runRuntimePrecheck(timeoutMs = 5000): Promise<PrecheckResult> {
  const checks = await Promise.all(
    PRECHECK_URLS.map(async (url) => {
      const start = Date.now();
      try {
        await safeFetch(url, { timeout: timeoutMs, allowPrivate: false });
        return { url, ok: true, latencyMs: Date.now() - start };
      } catch (err) {
        return {
          url,
          ok: false,
          latencyMs: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  const healthy = checks.some((c) => c.ok);
  return { healthy, checks, checkedAt: new Date().toISOString() };
}
