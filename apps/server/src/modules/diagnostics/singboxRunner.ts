import { execFileSync, spawn } from 'node:child_process';
import { accessSync, constants, existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createServer, Socket } from 'node:net';
import { delimiter, join } from 'node:path';
import type { ProxyNode } from '@/types/proxy';
import { createLogger } from '@/utils/logger';
import { sanitizeJson, sanitizeUrl } from '@/utils/sanitize';

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

type SingBoxInboundType = 'socks' | 'http';

const DEFAULT_INBOUND_TYPE: SingBoxInboundType = 'socks';

export function buildSingBoxConfig(
  node: ProxyNode,
  listenPort: number,
  inboundType: SingBoxInboundType = DEFAULT_INBOUND_TYPE,
): Record<string, unknown> {
  const outbound = buildOutbound(node);
  if (!outbound) return {};

  return {
    log: { level: 'warn', timestamp: false },
    inbounds: [
      {
        type: inboundType,
        tag: `${inboundType}-in`,
        listen: '127.0.0.1',
        listen_port: listenPort,
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
// Wait for local inbound port to become available
// ---------------------------------------------------------------------------

export interface PortReadyCheckResult {
  host: string;
  port: number;
  ready: boolean;
  attempts: number;
  timeoutMs: number;
  intervalMs: number;
  latencyMs: number;
  stoppedBecause?: 'process_exited';
}

async function checkPort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new Socket();
    sock.setTimeout(80);
    sock.once('connect', () => {
      sock.destroy();
      resolve(true);
    });
    sock.once('error', () => resolve(false));
    sock.once('timeout', () => {
      sock.destroy();
      resolve(false);
    });
    sock.connect(port, host);
  });
}

async function waitForPort(
  port: number,
  timeoutMs: number,
  intervalMs: number,
  isProcessExited: () => boolean,
): Promise<PortReadyCheckResult> {
  const host = '127.0.0.1';
  const start = Date.now();
  let attempts = 0;

  while (Date.now() - start < timeoutMs) {
    if (isProcessExited()) {
      return {
        host,
        port,
        ready: false,
        attempts,
        timeoutMs,
        intervalMs,
        latencyMs: Date.now() - start,
        stoppedBecause: 'process_exited',
      };
    }

    attempts += 1;
    if (await checkPort(host, port)) {
      return {
        host,
        port,
        ready: true,
        attempts,
        timeoutMs,
        intervalMs,
        latencyMs: Date.now() - start,
      };
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return {
    host,
    port,
    ready: false,
    attempts,
    timeoutMs,
    intervalMs,
    latencyMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// Probe HTTP via curl through the selected local inbound
// ---------------------------------------------------------------------------

export interface CurlProbeResult {
  ok: boolean;
  latencyMs: number;
  httpCode?: number;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  command: string[];
  redactedCommand: string;
  error?: string;
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:=@%+-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function commandToString(command: string[]): string {
  return command.map(shellQuote).join(' ');
}

function redactCurlCommandArgs(command: string[]): string[] {
  return command.map((arg) => {
    if (arg.startsWith('http://') || arg.startsWith('https://')) {
      return sanitizeUrl(arg) ?? arg;
    }
    return arg;
  });
}

export function buildCurlCommand(
  inboundType: SingBoxInboundType,
  listenPort: number,
  testUrl: string,
): string[] {
  const proxy = `127.0.0.1:${listenPort}`;
  if (inboundType === 'socks') {
    return [
      'curl',
      '-v',
      '--socks5-hostname',
      proxy,
      testUrl,
      '--connect-timeout',
      '5',
      '--max-time',
      '10',
    ];
  }

  return [
    'curl',
    '-v',
    '-x',
    `http://${proxy}`,
    testUrl,
    '--connect-timeout',
    '5',
    '--max-time',
    '10',
  ];
}

function parseHttpCode(stderr: string): number | undefined {
  const matches = [...stderr.matchAll(/< HTTP\/\S+\s+(\d{3})/g)];
  if (matches.length === 0) return undefined;
  return Number(matches[matches.length - 1][1]);
}

async function probeCurl(
  inboundType: SingBoxInboundType,
  listenPort: number,
  testUrl: string,
  timeoutMs: number,
): Promise<CurlProbeResult> {
  const start = Date.now();
  const command = buildCurlCommand(inboundType, listenPort, testUrl);
  const [cmd, ...args] = command;

  return new Promise((resolve) => {
    const curl = spawn(cmd, args);
    let settled = false;
    let stdout = '';
    let stderr = '';

    function finish(
      result: Omit<CurlProbeResult, 'latencyMs' | 'command' | 'redactedCommand' | 'stdout' | 'stderr'>,
    ): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const redactedCommandArgs = redactCurlCommandArgs(command);
      resolve({
        ...result,
        latencyMs: Date.now() - start,
        command: redactedCommandArgs,
        redactedCommand: commandToString(redactedCommandArgs),
        stdout,
        stderr,
      });
    }

    curl.stdout?.on('data', (d: Buffer) => (stdout += d.toString()));
    curl.stderr?.on('data', (d: Buffer) => (stderr += d.toString()));
    curl.once('error', (err) => {
      stderr += err.message;
      finish({
        ok: false,
        exitCode: null,
        signal: null,
        error: err.message,
      });
    });

    const timer = setTimeout(() => {
      curl.kill('SIGKILL');
      finish({
        ok: false,
        exitCode: null,
        signal: 'SIGKILL',
        error: 'curl timeout',
      });
    }, Math.max(timeoutMs + 1000, 11_000));

    curl.once('close', (code, signal) => {
      const httpCode = parseHttpCode(stderr);
      if (code === 0) {
        finish({
          ok: true,
          httpCode,
          exitCode: code,
          signal,
        });
        return;
      }

      finish({
        ok: false,
        httpCode,
        exitCode: code,
        signal,
        error: stderr.trim() || stdout.trim() || `curl exit ${code}`,
      });
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
  tempConfigPath?: string;
  generatedSingBoxConfig?: unknown;
  selectedInboundType?: SingBoxInboundType;
  selectedListenPort?: number;
  portReadyCheck?: PortReadyCheckResult;
  curl?: CurlProbeResult;
  curlExitCode?: number | null;
  curlStdout?: string;
  curlStderr?: string;
  curlCommand?: string;
  singBoxStdout?: string;
  singBoxStderr?: string;
  singBoxExitCode?: number | null;
  singBoxSignal?: NodeJS.Signals | null;
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

  let listenPort: number;
  try {
    listenPort = await allocateSocksPort();
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
  const selectedInboundType = DEFAULT_INBOUND_TYPE;
  let sbProcess: ReturnType<typeof spawn> | null = null;
  let sbStdout = '';
  let sbStderr = '';
  let sbExited = false;
  let sbExitCode: number | null = null;
  let sbSignal: NodeJS.Signals | null = null;

  try {
    mkdirSync(configDir, { recursive: true });
    const cfg = buildSingBoxConfig(node, listenPort, selectedInboundType);
    const generatedSingBoxConfig = sanitizeJson(cfg);
    writeFileSync(configPath, JSON.stringify(cfg, null, 2));

    sbProcess = spawn(binaryResolution.resolvedPath, ['run', '-c', configPath], {
      stdio: 'pipe',
    });
    sbProcess.stdout?.on('data', (d: Buffer) => (sbStdout += d.toString()));
    sbProcess.stderr?.on('data', (d: Buffer) => (sbStderr += d.toString()));
    sbProcess.once('close', (code, signal) => {
      sbExited = true;
      sbExitCode = code;
      sbSignal = signal;
    });

    const portReadyCheck = await waitForPort(listenPort, 3000, 100, () => sbExited);
    if (!portReadyCheck.ready) {
      const processExited = portReadyCheck.stoppedBecause === 'process_exited' || sbExited;
      return {
        status: 'failed',
        latencyMs: null,
        error: processExited
          ? 'sing-box process exited before the local inbound became ready'
          : 'sing-box inbound did not become ready',
        errorCode: processExited ? 'SING_BOX_PROCESS_EXITED' : 'SING_BOX_INBOUND_NOT_READY',
        resolvedPath: binaryResolution.resolvedPath,
        version: binaryResolution.version,
        source: binaryResolution.source,
        tempConfigPath: configPath,
        generatedSingBoxConfig,
        selectedInboundType,
        selectedListenPort: listenPort,
        portReadyCheck,
        singBoxStdout: sbStdout,
        singBoxStderr: sbStderr,
        singBoxExitCode: sbExitCode,
        singBoxSignal: sbSignal,
      };
    }

    if (sbExited) {
      return {
        status: 'failed',
        latencyMs: null,
        error: 'sing-box process exited after the local inbound became ready but before curl probe',
        errorCode: 'SING_BOX_PROCESS_EXITED',
        resolvedPath: binaryResolution.resolvedPath,
        version: binaryResolution.version,
        source: binaryResolution.source,
        tempConfigPath: configPath,
        generatedSingBoxConfig,
        selectedInboundType,
        selectedListenPort: listenPort,
        portReadyCheck,
        singBoxStdout: sbStdout,
        singBoxStderr: sbStderr,
        singBoxExitCode: sbExitCode,
        singBoxSignal: sbSignal,
      };
    }

    const urlToProbe =
      testUrls.find((u) => u.startsWith('https://')) ??
      testUrls.find((u) => u.startsWith('http://')) ??
      'https://www.gstatic.com/generate_204';
    const start = Date.now();
    const curlResult = await probeCurl(selectedInboundType, listenPort, urlToProbe, timeoutMs);
    const latencyMs = Date.now() - start;

    if (curlResult.ok) {
      return {
        status: 'ok',
        latencyMs,
        httpCode: curlResult.httpCode,
        resolvedPath: binaryResolution.resolvedPath,
        version: binaryResolution.version,
        source: binaryResolution.source,
        tempConfigPath: configPath,
        generatedSingBoxConfig,
        selectedInboundType,
        selectedListenPort: listenPort,
        portReadyCheck,
        curl: curlResult,
        curlExitCode: curlResult.exitCode,
        curlStdout: curlResult.stdout,
        curlStderr: curlResult.stderr,
        curlCommand: curlResult.redactedCommand,
        singBoxStdout: sbStdout,
        singBoxStderr: sbStderr,
        singBoxExitCode: sbExitCode,
        singBoxSignal: sbSignal,
      };
    }
    return {
      status: 'failed',
      latencyMs: curlResult.latencyMs,
      httpCode: curlResult.httpCode,
      error: curlResult.error,
      errorCode: curlResult.exitCode === 97 ? 'CURL_PROXY_HANDSHAKE_FAILED' : 'CURL_FAILED',
      resolvedPath: binaryResolution.resolvedPath,
      version: binaryResolution.version,
      source: binaryResolution.source,
      tempConfigPath: configPath,
      generatedSingBoxConfig,
      selectedInboundType,
      selectedListenPort: listenPort,
      portReadyCheck,
      curl: curlResult,
      curlExitCode: curlResult.exitCode,
      curlStdout: curlResult.stdout,
      curlStderr: curlResult.stderr,
      curlCommand: curlResult.redactedCommand,
      singBoxStdout: sbStdout,
      singBoxStderr: sbStderr,
      singBoxExitCode: sbExitCode,
      singBoxSignal: sbSignal,
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
      tempConfigPath: configPath,
      selectedInboundType,
      selectedListenPort: listenPort,
      singBoxStdout: sbStdout,
      singBoxStderr: sbStderr,
      singBoxExitCode: sbExitCode,
      singBoxSignal: sbSignal,
    };
  } finally {
    if (sbProcess) {
      try {
        sbProcess.kill('SIGKILL');
      } catch {
        // already dead
      }
    }
    releasePort(listenPort);
    try {
      rmSync(configPath, { force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}
