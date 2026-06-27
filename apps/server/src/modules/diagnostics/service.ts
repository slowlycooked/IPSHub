import net from 'node:net';

import { safeFetch } from '@/core/fetcher/ssrfGuard';
import { parseSubscription, SubscriptionFormat } from '@/core/parsers/detectType';
import { generateFingerprint, isInfoNode } from '@/core/merge/fingerprint';
import { getDecryptedSubscriptionUrl } from '@/modules/providers/service';
import { getProviderById } from '@/modules/providers/service';
import { getNodesByProviderId, type NodeDTO } from '@/modules/nodes/service';
import { parseRequestHeaders } from '@/modules/providers/request-headers';
import type { ProxyNode } from '@/types/proxy';
import { createLogger } from '@/utils/logger';

import {
  createDiagRun,
  updateRunStatus,
  incrementNodeCounts,
  saveNodeResult,
  saveLog,
  saveConfigDiff,
  getRunByIdAdmin,
  type DiagRunConfig,
} from './repository';
import { runRuntimePrecheck, type PrecheckResult } from './runtimeNetworkPrecheck';
import { computeConfigDiff, hasCriticalDiff } from './configDiffService';
import { validateClashConfig, validateLoonConfig } from './clientConfigValidator';
import { diagnoseNode } from './diagnosisEngine';
import { probeThroughSingBox, findSingBoxBinary, buildOutbound } from './singboxRunner';

const logger = createLogger('diagnostics-service');

// ---------------------------------------------------------------------------
// Active runs guard (prevent duplicate concurrency)
// ---------------------------------------------------------------------------

const activeRuns = new Set<string>();

// ---------------------------------------------------------------------------
// TCP probe (lightweight, reuse pattern from nodes/service.ts)
// ---------------------------------------------------------------------------

interface TcpProbeResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

function runTcpProbe(server: string, port: number, timeoutMs: number): Promise<TcpProbeResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();

    const cleanup = (ok: boolean, error?: string) => {
      socket.destroy();
      resolve({ ok, latencyMs: Date.now() - start, error });
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => cleanup(true));
    socket.once('timeout', () => cleanup(false, 'timeout'));
    socket.once('error', (err) => cleanup(false, err.message));

    try {
      socket.connect(port, server);
    } catch (err) {
      cleanup(false, err instanceof Error ? err.message : String(err));
    }
  });
}

// ---------------------------------------------------------------------------
// Concurrency helper
// ---------------------------------------------------------------------------

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function consume(): Promise<void> {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      results[idx] = await worker(items[idx]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => consume());
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Map provider type → SubscriptionFormat
// ---------------------------------------------------------------------------

function mapTypeToFormat(providerType: string): SubscriptionFormat | undefined {
  switch (providerType) {
    case 'clash': return SubscriptionFormat.CLASH_YAML;
    case 'base64-uri': return SubscriptionFormat.BASE64_URI;
    case 'uri-list': return SubscriptionFormat.URI_LIST;
    default: return undefined;
  }
}

// ---------------------------------------------------------------------------
// Fetch raw (un-processed) nodes from a provider's subscription URL
// ---------------------------------------------------------------------------

/** Returns true for loopback / link-local servers that can never be reached. */
function isUnroutableServer(server: string): boolean {
  if (!server) return false;
  // IPv4 loopback, link-local, and plain "localhost"
  if (server === 'localhost' || server === '::1') return true;
  if (/^127\./.test(server)) return true;
  if (/^169\.254\./.test(server)) return true;
  return false;
}

/** Returns true for nodes that should be excluded from diagnostics. */
function isDiagnosticSkippable(node: ProxyNode): boolean {
  if (isInfoNode(node.name)) return true;
  if (node.server && isUnroutableServer(node.server)) return true;
  return false;
}

interface RawFetchResult {
  success: boolean;
  rawNodes: ProxyNode[];
  skippedCount?: number;
  contentLength: number;
  durationMs: number;
  error?: string;
}

async function fetchRawNodes(
  providerId: string,
  providerType: string,
  timeoutMs: number,
  userAgent?: string | null,
  rawHeaders?: string | null,
): Promise<RawFetchResult> {
  const url = getDecryptedSubscriptionUrl(providerId);
  if (!url) {
    return { success: false, rawNodes: [], contentLength: 0, durationMs: 0, error: 'No subscription URL configured' };
  }

  const start = Date.now();
  try {
    const headers = parseRequestHeaders(rawHeaders ?? null);
    const content = await safeFetch(url, {
      timeout: timeoutMs,
      allowPrivate: process.env['NODE_ENV'] === 'development',
      ...(userAgent ? { userAgent } : {}),
      ...(headers ? { headers } : {}),
    });

    const parseResult = parseSubscription(content, providerId, mapTypeToFormat(providerType));
    const allNodes = parseResult.nodes;
    const rawNodes = allNodes.filter((n) => !isDiagnosticSkippable(n));
    const skippedCount = allNodes.length - rawNodes.length;
    return {
      success: true,
      rawNodes,
      skippedCount,
      contentLength: content.length,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      rawNodes: [],
      contentLength: 0,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Match raw nodes to IPSHub DB nodes by fingerprint
// ---------------------------------------------------------------------------

interface NodePair {
  fingerprint: string;
  raw: ProxyNode;
  ipshub: NodeDTO | null;
  providerId: string;
}

function matchNodes(rawNodes: ProxyNode[], ipshubNodes: NodeDTO[], providerId: string): NodePair[] {
  const ipshubByFp = new Map<string, NodeDTO>();
  for (const n of ipshubNodes) {
    const fp = generateFingerprint(n);
    ipshubByFp.set(fp, n);
  }

  return rawNodes.map((raw) => {
    const fp = generateFingerprint(raw);
    return {
      fingerprint: fp,
      raw,
      ipshub: ipshubByFp.get(fp) ?? null,
      providerId,
    };
  });
}

// ---------------------------------------------------------------------------
// Process a single node pair
// ---------------------------------------------------------------------------

async function processNodePair(
  pair: NodePair,
  runId: string,
  config: DiagRunConfig,
  runtimePrecheck: PrecheckResult,
): Promise<void> {
  const nodeId = pair.ipshub?.id ?? pair.fingerprint.slice(0, 16);
  const nodeName = pair.raw.name ?? pair.ipshub?.name ?? 'unknown';

  const log = (stage: string, level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, detail?: unknown) => {
    saveLog({
      runId,
      nodeId,
      stage,
      level,
      message,
      detailJson: detail !== undefined ? JSON.stringify(detail) : null,
      durationMs: null,
    });
  };

  log('init', 'INFO', `Starting diagnostic for node: ${nodeName}`);

  // Layer 2: Config diff
  let diffs = computeConfigDiff(pair.raw, pair.ipshub ?? pair.raw);
  if (pair.ipshub && diffs.length > 0) {
    saveConfigDiff(runId, nodeId, JSON.stringify(diffs));
    const criticalCount = diffs.filter((d) => d.risk === 'critical').length;
    const highCount = diffs.filter((d) => d.risk === 'high').length;
    // Only escalate log level when the diffs are actually significant
    const diffLevel: 'INFO' | 'WARN' | 'ERROR' =
      criticalCount > 0 ? 'ERROR' : highCount > 0 ? 'WARN' : 'INFO';
    log('config-diff', diffLevel, `${diffs.length} field(s) differ between raw and IPSHub config`, {
      criticalCount,
      highCount,
    });
  } else if (!pair.ipshub) {
    log('config-diff', 'WARN', 'Node not found in IPSHub DB — likely filtered or deduped');
    diffs = [];
  } else {
    log('config-diff', 'INFO', 'No field differences found between raw and IPSHub config');
  }

  // Layer 3: Client config validation
  const nodeForValidation = pair.ipshub ?? pair.raw;
  const clashResult = validateClashConfig([nodeForValidation]);
  const loonResult = validateLoonConfig([nodeForValidation]);
  if (!clashResult.valid) {
    log('clash-validate', 'WARN', `Clash config invalid: ${clashResult.errors.join('; ')}`);
  }
  if (!loonResult.valid) {
    log('loon-validate', 'WARN', `Loon config invalid: ${loonResult.errors.join('; ')}`);
  }

  // Layer 4: TCP probe
  // Hysteria2 uses UDP/QUIC — a TCP connect will always fail and is not a useful signal.
  let tcpResult: { ok: boolean | null; latencyMs: number | null; error?: string };
  if (pair.raw.protocol === 'hysteria2') {
    tcpResult = { ok: null, latencyMs: null };
    log('tcp-probe', 'INFO', 'TCP probe skipped — Hysteria2 uses UDP/QUIC, TCP is not applicable');
  } else {
    const rawTcp = await runTcpProbe(
      pair.raw.server,
      pair.raw.port,
      Math.min(config.timeoutMs, 5000),
    );
    tcpResult = rawTcp;
    log('tcp-probe', rawTcp.ok ? 'INFO' : 'WARN', `TCP ${rawTcp.ok ? 'OK' : 'FAILED'} (${rawTcp.latencyMs}ms)`, {
      server: pair.raw.server, port: pair.raw.port, error: rawTcp.error,
    });
  }

  // Layer 5: sing-box probe (raw + ipshub, if binary available)
  let rawProbeStatus: 'ok' | 'failed' | 'skipped' | null = null;
  let rawLatencyMs: number | null = null;
  let ipshubProbeStatus: 'ok' | 'failed' | 'skipped' | null = null;
  let ipshubLatencyMs: number | null = null;

  const rawProbe = await probeThroughSingBox(
    pair.raw, runId, nodeId, 'raw', config.testUrls, config.timeoutMs,
  );
  rawProbeStatus = rawProbe.status === 'unsupported_protocol' ? 'skipped' : rawProbe.status;
  rawLatencyMs = rawProbe.latencyMs;
  log('singbox-raw', rawProbe.status === 'ok' ? 'INFO' : rawProbe.status === 'skipped' ? 'DEBUG' : 'WARN',
    `Sing-box raw probe: ${rawProbe.status}`,
    { latencyMs: rawProbe.latencyMs, ...(rawProbe.errorCode ? { errorCode: rawProbe.errorCode } : {}), ...(rawProbe.error ? { error: rawProbe.error } : {}) },
  );

  if (pair.ipshub) {
    const ipshubProbe = await probeThroughSingBox(
      pair.ipshub, runId, nodeId, 'ipshub', config.testUrls, config.timeoutMs,
    );
    ipshubProbeStatus = ipshubProbe.status === 'unsupported_protocol' ? 'skipped' : ipshubProbe.status;
    ipshubLatencyMs = ipshubProbe.latencyMs;
    log('singbox-ipshub', ipshubProbe.status === 'ok' ? 'INFO' : ipshubProbe.status === 'skipped' ? 'DEBUG' : 'WARN',
      `Sing-box IPSHub probe: ${ipshubProbe.status}`,
      { latencyMs: ipshubProbe.latencyMs, ...(ipshubProbe.errorCode ? { errorCode: ipshubProbe.errorCode } : {}), ...(ipshubProbe.error ? { error: ipshubProbe.error } : {}) },
    );
  }

  // Diagnosis
  const diagnosis = diagnoseNode({
    server: pair.raw.server,
    tcpOk: tcpResult.ok,
    tcpLatencyMs: tcpResult.latencyMs,
    configDiffs: diffs,
    clashValidation: clashResult,
    loonValidation: loonResult,
    runtimePrecheck,
    rawProbeStatus,
    ipshubProbeStatus,
  });

  log('diagnosis', 'INFO', `Diagnosis: ${diagnosis.code}`, { explanation: diagnosis.explanation });

  // P0: When a conversion issue is detected, log a full field-level breakdown to assist debugging.
  if (diagnosis.code === 'LIKELY_IPSHUB_CONVERSION_ISSUE' && pair.ipshub) {
    const rawOutbound = buildOutbound(pair.raw);
    const ipshubOutbound = buildOutbound(pair.ipshub);
    const fieldDiffs = diffs.map((d) => ({
      field: d.field,
      raw: d.rawValue,
      ipshub: d.normalizedValue,
      risk: d.risk,
    }));
    log('conversion-debug', 'ERROR', 'Conversion issue detected — raw vs IPSHub outbound comparison', {
      rawOutbound,
      ipshubOutbound,
      fieldDiffs,
    });
  }
  // P1: When probes diverge but configs are identical, log for visibility at WARN level.
  if (diagnosis.code === 'SING_BOX_PROBE_INCONSISTENCY' && pair.ipshub) {
    const rawOutbound = buildOutbound(pair.raw);
    const ipshubOutbound = buildOutbound(pair.ipshub);
    log('conversion-debug', 'WARN', 'Probe inconsistency — raw succeeded, IPSHub failed, but outbounds are identical (likely transient)', {
      rawOutbound,
      ipshubOutbound,
      fieldDiffs: [],
    });
  }

  const isSuccess = [
    'NODE_AND_IPSHUB_LOOK_HEALTHY',
    'SING_BOX_CONFIRMED_WORKING',
  ].includes(diagnosis.code);

  // Save result
  saveNodeResult({
    runId,
    nodeId: pair.ipshub?.id ?? null,
    providerId: pair.providerId,
    nodeName,
    protocol: pair.raw.protocol,
    server: pair.raw.server,
    port: pair.raw.port,
    rawStatus: rawProbeStatus,
    rawLatencyMs,
    ipshubStatus: ipshubProbeStatus,
    ipshubLatencyMs,
    tcpStatus: tcpResult.ok === null ? 'skipped' : tcpResult.ok ? 'ok' : 'failed',
    tcpLatencyMs: tcpResult.latencyMs,
    clashConfigStatus: clashResult.valid ? 'ok' : 'invalid',
    loonConfigStatus: loonResult.valid ? 'ok' : 'invalid',
    failedStage: isSuccess ? null : diagnosis.code,
    errorReason: isSuccess ? null : diagnosis.explanation,
    diagnosis: diagnosis.code,
    resultJson: JSON.stringify({
      tcpResult,
      diffCount: diffs.length,
      hasCriticalDiff: hasCriticalDiff(diffs),
      clashErrors: clashResult.errors,
      loonErrors: loonResult.errors,
    }),
  });

  incrementNodeCounts(runId, isSuccess ? 'success' : 'failed');
}

// ---------------------------------------------------------------------------
// Main execution
// ---------------------------------------------------------------------------

async function executeDiagnosticRun(runId: string, config: DiagRunConfig): Promise<void> {
  logger.info({ runId }, 'Starting diagnostic run');
  updateRunStatus(runId, 'running', { startedAt: Date.now() });

  let runtimePrecheck: PrecheckResult;
  try {
    runtimePrecheck = await runRuntimePrecheck(config.timeoutMs);
    updateRunStatus(runId, 'running', { runtimePrecheckJson: JSON.stringify(runtimePrecheck) });

    if (!runtimePrecheck.healthy) {
      logger.warn({ runId }, 'Runtime precheck failed — internet may be unreachable from IPSHub');
    }
  } catch (err) {
    logger.error({ err, runId }, 'Runtime precheck threw');
    runtimePrecheck = { healthy: false, checks: [], checkedAt: new Date().toISOString() };
  }

  const allPairs: NodePair[] = [];

  for (const providerId of config.providerIds) {
    const provider = getProviderById(providerId, config.userId);
    if (!provider) {
      logger.warn({ runId, providerId }, 'Provider not found or access denied, skipping');
      continue;
    }

    saveLog({
      runId,
      nodeId: null,
      stage: 'fetch-subscription',
      level: 'INFO',
      message: `Fetching raw subscription for provider: ${provider.name}`,
      detailJson: null,
      durationMs: null,
    });

    const rawResult = await fetchRawNodes(
      providerId,
      provider.type,
      config.timeoutMs,
      provider.user_agent,
      provider.request_headers_json,
    );

    if (!rawResult.success) {
      saveLog({
        runId,
        nodeId: null,
        stage: 'fetch-subscription',
        level: 'ERROR',
        message: `Subscription fetch failed: ${rawResult.error}`,
        detailJson: JSON.stringify({ providerId, durationMs: rawResult.durationMs }),
        durationMs: rawResult.durationMs,
      });
      continue;
    }

    saveLog({
      runId,
      nodeId: null,
      stage: 'fetch-subscription',
      level: 'INFO',
      message: `Fetched ${rawResult.rawNodes.length} raw nodes (${rawResult.contentLength} bytes, ${rawResult.durationMs}ms)${rawResult.skippedCount ? `, skipped ${rawResult.skippedCount} info/local nodes` : ''}`,
      detailJson: null,
      durationMs: rawResult.durationMs,
    });

    const ipshubNodes = getNodesByProviderId(providerId);
    const pairs = matchNodes(rawResult.rawNodes, ipshubNodes, providerId);
    allPairs.push(...pairs);
  }

  updateRunStatus(runId, 'running', { totalNodes: allPairs.length });

  if (allPairs.length === 0) {
    updateRunStatus(runId, 'completed', {
      finishedAt: Date.now(),
      summaryJson: JSON.stringify({ message: 'No nodes to test' }),
    });
    return;
  }

  await runWithConcurrency(
    allPairs,
    Math.min(config.concurrency, 5),
    (pair) => processNodePair(pair, runId, config, runtimePrecheck),
  );

  const run = getRunByIdAdmin(runId);
  const summary = {
    total: run?.total_nodes ?? allPairs.length,
    completed: run?.completed_nodes ?? 0,
    success: run?.success_nodes ?? 0,
    failed: run?.failed_nodes ?? 0,
    runtimeHealthy: runtimePrecheck.healthy,
    singBoxAvailable: findSingBoxBinary() !== null,
    finishedAt: new Date().toISOString(),
  };

  updateRunStatus(runId, 'completed', {
    finishedAt: Date.now(),
    summaryJson: JSON.stringify(summary),
  });

  logger.info({ runId, summary }, 'Diagnostic run completed');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface EnqueueResult {
  runId: string;
  status: 'pending';
}

export function enqueueLatencyRun(cfg: DiagRunConfig): EnqueueResult {
  const runId = createDiagRun(cfg);

  if (activeRuns.has(runId)) {
    return { runId, status: 'pending' };
  }

  activeRuns.add(runId);
  void executeDiagnosticRun(runId, cfg).finally(() => {
    activeRuns.delete(runId);
  });

  return { runId, status: 'pending' };
}
