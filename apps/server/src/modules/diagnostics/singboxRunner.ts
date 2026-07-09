import { execFileSync, spawn } from 'node:child_process';
import { accessSync, constants, existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createServer, Socket } from 'node:net';
import { delimiter, join } from 'node:path';
import type { ProxyNode } from '@/types/proxy';
import { createLogger } from '@/utils/logger';

const logger = createLogger('singbox-runner');

// ---------------------------------------------------------------------------
// Binary detection
// ---------------------------------------------------------------------------

const DEFAULT_FALLBACK_PATHS = [
  '/opt/homebrew/bin/sing-box',
  '/usr/local/bin/sing-box',
  '/usr/bin/sing-box',
] as const;

export type SingBoxBinarySource = 'env' | 'path' | 'fallback';

export interface SingBoxBinaryResolution {
  found: true;
  resolvedPath: string;
  version: string;
  source: SingBoxBinarySource;
  attemptedPaths: string[];
}

export interface SingBoxBinaryNotFound {
  found: false;
  errorCode: 'SING_BOX_NOT_FOUND';
  attemptedPaths: string[];
  pathEnv: string;
  explanation: string;
}

export type SingBoxBinaryLookupResult = SingBoxBinaryResolution | SingBoxBinaryNotFound;

interface Candidate {
  path: string;
  source: SingBoxBinarySource;
}

interface ResolveOptions {
  env?: NodeJS.ProcessEnv;
  fallbackPaths?: readonly string[];
}

let _singBoxResolution: SingBoxBinaryLookupResult | undefined = undefined;

function pathCandidates(pathEnv: string): Candidate[] {
  return pathEnv
    .split(delimiter)
    .filter(Boolean)
    .map((dir) => ({ path: join(dir, 'sing-box'), source: 'path' }));
}

function buildSingBoxCandidates(env: NodeJS.ProcessEnv, fallbackPaths: readonly string[]): Candidate[] {
  const candidates: Candidate[] = [];
  const envPath = env['SING_BOX_PATH']?.trim();
  if (envPath) candidates.push({ path: envPath, source: 'env' });
  candidates.push(...pathCandidates(env['PATH'] ?? ''));
  candidates.push(...fallbackPaths.map((path) => ({ path, source: 'fallback' as const })));
  return candidates;
}

function validateSingBoxCandidate(candidate: string): { ok: true; version: string } | { ok: false } {
  if (!existsSync(candidate)) return { ok: false };
  try {
    accessSync(candidate, constants.X_OK);
    const output = execFileSync(candidate, ['version'], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const version = output.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? 'unknown';
    return { ok: true, version };
  } catch {
    return { ok: false };
  }
}

export function resolveSingBoxBinary(options: ResolveOptions = {}): SingBoxBinaryLookupResult {
  const env = options.env ?? process.env;
  const fallbackPaths = options.fallbackPaths ?? DEFAULT_FALLBACK_PATHS;
  const pathEnv = env['PATH'] ?? '';
  const attemptedPaths: string[] = [];
  const seen = new Set<string>();

  for (const candidate of buildSingBoxCandidates(env, fallbackPaths)) {
    if (seen.has(candidate.path)) continue;
    seen.add(candidate.path);
    attemptedPaths.push(candidate.path);

    const validation = validateSingBoxCandidate(candidate.path);
    if (validation.ok) {
      const resolution = {
        found: true,
        resolvedPath: candidate.path,
        version: validation.version,
        source: candidate.source,
        attemptedPaths,
      } satisfies SingBoxBinaryResolution;
      logger.info(
        {
          resolvedPath: resolution.resolvedPath,
          version: resolution.version,
          source: resolution.source,
        },
        'Resolved sing-box binary',
      );
      return resolution;
    }
  }

  return {
    found: false,
    errorCode: 'SING_BOX_NOT_FOUND',
    attemptedPaths,
    pathEnv,
    explanation:
      `sing-box was not found or did not pass validation. Current PATH: ${pathEnv || '(empty)'}. ` +
      `Attempted paths: ${attemptedPaths.length > 0 ? attemptedPaths.join(', ') : '(none)'}. ` +
      'Set SING_BOX_PATH to the absolute path of a working sing-box binary.',
  };
}

export function resetSingBoxBinaryCacheForTests(): void {
  _singBoxResolution = undefined;
}

function getCachedSingBoxResolution(): SingBoxBinaryLookupResult {
  if (_singBoxResolution === undefined) {
    _singBoxResolution = resolveSingBoxBinary();
  }
  return _singBoxResolution;
}

export function findSingBoxBinary(): string | null {
  const resolution = getCachedSingBoxResolution();
  return resolution.found ? resolution.resolvedPath : null;
}

// ---------------------------------------------------------------------------
// Port allocation
// ---------------------------------------------------------------------------

const usedPorts = new Set<number>();

async function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => {
      srv.close(() => resolve(true));
    });
    srv.listen(port, '127.0.0.1');
  });
}

export async function allocateSocksPort(): Promise<number> {
  for (let port = 23000; port <= 23999; port++) {
    if (!usedPorts.has(port) && (await isPortFree(port))) {
      usedPorts.add(port);
      return port;
    }
  }
  throw new Error('No free port available in range 23000-23999');
}

export function releasePort(port: number): void {
  usedPorts.delete(port);
}

// ---------------------------------------------------------------------------
// sing-box config builder
// ---------------------------------------------------------------------------

export function buildSingBoxConfig(node: ProxyNode, socksPort: number): Record<string, unknown> {
  const outbound = buildOutbound(node);
  if (!outbound) return {};

  return {
    log: { level: 'warn', timestamp: false },
    inbounds: [
      {
        type: 'socks',
        tag: 'socks-in',
        listen: '127.0.0.1',
        listen_port: socksPort,
      },
    ],
    outbounds: [
      { ...outbound, tag: 'proxy' },
      { type: 'direct', tag: 'direct' },
    ],
    route: {
      rules: [],
      final: 'proxy',
    },
  };
}

export function buildOutbound(node: ProxyNode): Record<string, unknown> | null {
  const base = {
    server: node.server,
    server_port: node.port,
  };

  switch (node.protocol) {
    case 'vless': {
      const tls = buildTlsConfig(node);
      const transport = buildTransportConfig(node);
      return {
        type: 'vless',
        ...base,
        uuid: node.uuid,
        ...(node.flow ? { flow: node.flow } : {}),
        ...(tls ? { tls } : {}),
        ...(transport ? { transport } : {}),
      };
    }

    case 'vmess': {
      const tls = buildTlsConfig(node);
      const transport = buildTransportConfig(node);
      return {
        type: 'vmess',
        ...base,
        uuid: node.uuid,
        alter_id: 0,
        security: node.cipher || 'auto',
        ...(tls ? { tls } : {}),
        ...(transport ? { transport } : {}),
      };
    }

    case 'trojan': {
      const tls = buildTlsConfig(node) ?? { enabled: true };
      const transport = buildTransportConfig(node);
      return {
        type: 'trojan',
        ...base,
        password: node.password,
        tls,
        ...(transport ? { transport } : {}),
      };
    }

    case 'ss': {
      return {
        type: 'shadowsocks',
        ...base,
        method: node.cipher || 'aes-256-gcm',
        password: node.password,
      };
    }

    case 'hysteria2': {
      return {
        type: 'hysteria2',
        ...base,
        password: node.password || node.uuid,
        tls: {
          enabled: true,
          server_name: node.host || node.server,
          insecure: node.allowInsecure ?? node.tlsInsecure ?? false,
        },
      };
    }

    default:
      return null;
  }
}

function buildTlsConfig(node: ProxyNode): Record<string, unknown> | null {
  if (!node.tls) return null;

  const tlsCfg: Record<string, unknown> = {
    enabled: true,
    server_name: node.host || node.server,
    insecure: node.allowInsecure ?? node.tlsInsecure ?? false,
  };

  if (node.realityPublicKey) {
    tlsCfg['reality'] = {
      enabled: true,
      public_key: node.realityPublicKey,
      short_id: node.realityShortId ?? '',
    };
    tlsCfg['utls'] = {
      enabled: true,
      fingerprint: node.realityFingerprint || 'chrome',
    };
  }

  return tlsCfg;
}

function buildTransportConfig(node: ProxyNode): Record<string, unknown> | null {
  if (!node.transport) return null;

  switch (node.transport) {
    case 'ws':
    case 'websocket': {
      const headers: Record<string, string> = {};
      if (node.host) headers['Host'] = node.host;
      return {
        type: 'ws',
        path: node.path || '/',
        headers,
      };
    }

    case 'grpc': {
      return {
        type: 'grpc',
        service_name: node.serviceName || '',
      };
    }

    case 'h2':
    case 'http2': {
      return {
        type: 'http',
        host: [node.host || node.server],
        path: node.path || '/',
      };
    }

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Wait for SOCKS5 port to become available
// ---------------------------------------------------------------------------

async function waitForPort(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await new Promise<boolean>((resolve) => {
      const sock = new Socket();
      sock.setTimeout(300);
      sock.once('connect', () => {
        sock.destroy();
        resolve(true);
      });
      sock.once('error', () => resolve(false));
      sock.once('timeout', () => resolve(false));
      sock.connect(port, '127.0.0.1');
    });
    if (ready) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

// ---------------------------------------------------------------------------
// Probe HTTP via curl through SOCKS5
// ---------------------------------------------------------------------------

export interface CurlProbeResult {
  ok: boolean;
  latencyMs: number;
  httpCode?: number;
  error?: string;
}

async function probeCurl(
  socksPort: number,
  testUrl: string,
  timeoutMs: number,
): Promise<CurlProbeResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    const curl = spawn('curl', [
      '--socks5-hostname',
      `127.0.0.1:${socksPort}`,
      '-o', '/dev/null',
      '-s',
      '-w', '%{http_code}',
      '--max-time', String(Math.ceil(timeoutMs / 1000)),
      '--connect-timeout', String(Math.ceil(timeoutMs / 1000)),
      testUrl,
    ]);

    let stdout = '';
    let stderr = '';
    curl.stdout?.on('data', (d: Buffer) => (stdout += d.toString()));
    curl.stderr?.on('data', (d: Buffer) => (stderr += d.toString()));

    const timer = setTimeout(() => {
      curl.kill('SIGKILL');
      resolve({ ok: false, latencyMs: Date.now() - start, error: 'curl timeout' });
    }, timeoutMs + 1000);

    curl.on('close', (code) => {
      clearTimeout(timer);
      const latencyMs = Date.now() - start;
      const httpCode = parseInt(stdout.trim(), 10);
      if (code === 0 && httpCode >= 200 && httpCode < 400) {
        resolve({ ok: true, latencyMs, httpCode });
      } else {
        resolve({
          ok: false,
          latencyMs,
          httpCode: isNaN(httpCode) ? undefined : httpCode,
          error: stderr.trim() || `curl exit ${code}`,
        });
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Main probe API
// ---------------------------------------------------------------------------

export interface SingBoxProbeResult {
  status: 'ok' | 'failed' | 'skipped' | 'unsupported_protocol';
  latencyMs: number | null;
  httpCode?: number;
  errorCode?: string;
  error?: string;
  resolvedPath?: string;
  version?: string;
  source?: SingBoxBinarySource;
  attemptedPaths?: string[];
}

export async function probeThroughSingBox(
  node: ProxyNode,
  runId: string,
  nodeId: string,
  label: string,
  testUrls: string[],
  timeoutMs: number,
): Promise<SingBoxProbeResult> {
  const binaryResolution = getCachedSingBoxResolution();
  if (!binaryResolution.found) {
    return {
      status: 'skipped',
      latencyMs: null,
      errorCode: binaryResolution.errorCode,
      error: binaryResolution.explanation,
      attemptedPaths: binaryResolution.attemptedPaths,
    };
  }

  const outbound = buildOutbound(node);
  if (!outbound) {
    return {
      status: 'unsupported_protocol',
      latencyMs: null,
      errorCode: 'UNSUPPORTED_PROTOCOL',
      resolvedPath: binaryResolution.resolvedPath,
      version: binaryResolution.version,
      source: binaryResolution.source,
    };
  }

  let socksPort: number;
  try {
    socksPort = await allocateSocksPort();
  } catch (err) {
    return {
      status: 'failed',
      latencyMs: null,
      error: 'No free port available',
      errorCode: 'NO_FREE_PORT',
      resolvedPath: binaryResolution.resolvedPath,
      version: binaryResolution.version,
      source: binaryResolution.source,
    };
  }

  const configDir = `/tmp/ipshub/diagnostics/${runId}`;
  const configPath = join(configDir, `${nodeId}-${label}.json`);
  let sbProcess: ReturnType<typeof spawn> | null = null;

  try {
    mkdirSync(configDir, { recursive: true });
    const cfg = buildSingBoxConfig(node, socksPort);
    writeFileSync(configPath, JSON.stringify(cfg, null, 2));

    sbProcess = spawn(binaryResolution.resolvedPath, ['run', '-c', configPath], {
      stdio: 'pipe',
    });

    const ready = await waitForPort(socksPort, Math.min(timeoutMs, 5000));
    if (!ready) {
      return {
        status: 'failed',
        latencyMs: null,
        error: 'sing-box SOCKS5 port did not become ready',
        errorCode: 'SOCKS5_NOT_READY',
        resolvedPath: binaryResolution.resolvedPath,
        version: binaryResolution.version,
        source: binaryResolution.source,
      };
    }

    const urlToProbe = testUrls.find((u) => u.startsWith('http')) ?? 'http://www.gstatic.com/generate_204';
    const start = Date.now();
    const curlResult = await probeCurl(socksPort, urlToProbe, timeoutMs);
    const latencyMs = Date.now() - start;

    if (curlResult.ok) {
      return {
        status: 'ok',
        latencyMs,
        httpCode: curlResult.httpCode,
        resolvedPath: binaryResolution.resolvedPath,
        version: binaryResolution.version,
        source: binaryResolution.source,
      };
    }
    return {
      status: 'failed',
      latencyMs: curlResult.latencyMs,
      httpCode: curlResult.httpCode,
      error: curlResult.error,
      resolvedPath: binaryResolution.resolvedPath,
      version: binaryResolution.version,
      source: binaryResolution.source,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, nodeId, label }, 'sing-box probe failed');
    return {
      status: 'failed',
      latencyMs: null,
      errorCode: 'PROBE_EXCEPTION',
      error: msg,
      resolvedPath: binaryResolution.resolvedPath,
      version: binaryResolution.version,
      source: binaryResolution.source,
    };
  } finally {
    if (sbProcess) {
      try {
        sbProcess.kill('SIGKILL');
      } catch {
        // already dead
      }
    }
    releasePort(socksPort);
    try {
      rmSync(configPath, { force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}
