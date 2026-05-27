import { randomUUID } from 'node:crypto';
import { getDatabase } from '@/db/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiagRunConfig {
  userId: string;
  mode: 'compare';
  clientFormats: string[];
  scope: 'provider' | 'node';
  providerIds: string[];
  nodeIds: string[];
  testUrls: string[];
  timeoutMs: number;
  concurrency: number;
}

export interface DiagRunRow {
  id: string;
  user_id: string;
  mode: string;
  client_formats: string;
  scope: string;
  provider_ids: string;
  node_ids: string;
  test_urls: string;
  timeout_ms: number;
  concurrency: number;
  status: string;
  total_nodes: number;
  completed_nodes: number;
  success_nodes: number;
  failed_nodes: number;
  summary_json: string | null;
  runtime_precheck_json: string | null;
  run_error: string | null;
  started_at: number | null;
  finished_at: number | null;
  created_at: number;
}

export interface NodeResultInput {
  runId: string;
  nodeId: string | null;
  providerId: string | null;
  nodeName: string | null;
  protocol: string | null;
  server: string | null;
  port: number | null;
  rawStatus: string | null;
  rawLatencyMs: number | null;
  ipshubStatus: string | null;
  ipshubLatencyMs: number | null;
  tcpStatus: string | null;
  tcpLatencyMs: number | null;
  clashConfigStatus: string | null;
  loonConfigStatus: string | null;
  failedStage: string | null;
  errorReason: string | null;
  diagnosis: string | null;
  resultJson: string | null;
}

export interface DiagLogInput {
  runId: string;
  nodeId: string | null;
  stage: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  detailJson: string | null;
  durationMs: number | null;
}

// ---------------------------------------------------------------------------
// Run CRUD
// ---------------------------------------------------------------------------

export function createDiagRun(cfg: DiagRunConfig): string {
  const db = getDatabase();
  const id = randomUUID();
  const now = Date.now();
  db.prepare(`
    INSERT INTO diagnostic_runs
      (id, user_id, mode, client_formats, scope, provider_ids, node_ids, test_urls,
       timeout_ms, concurrency, status, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,'pending',?)
  `).run(
    id,
    cfg.userId,
    cfg.mode,
    JSON.stringify(cfg.clientFormats),
    cfg.scope,
    JSON.stringify(cfg.providerIds),
    JSON.stringify(cfg.nodeIds),
    JSON.stringify(cfg.testUrls),
    cfg.timeoutMs,
    cfg.concurrency,
    now,
  );
  return id;
}

export function updateRunStatus(
  runId: string,
  status: 'running' | 'completed' | 'failed',
  extra?: {
    totalNodes?: number;
    runError?: string;
    startedAt?: number;
    finishedAt?: number;
    summaryJson?: string;
    runtimePrecheckJson?: string;
  },
): void {
  const db = getDatabase();
  let sql = 'UPDATE diagnostic_runs SET status=?';
  const params: unknown[] = [status];

  if (extra?.totalNodes !== undefined) {
    sql += ', total_nodes=?';
    params.push(extra.totalNodes);
  }
  if (extra?.runError !== undefined) {
    sql += ', run_error=?';
    params.push(extra.runError);
  }
  if (extra?.startedAt !== undefined) {
    sql += ', started_at=?';
    params.push(extra.startedAt);
  }
  if (extra?.finishedAt !== undefined) {
    sql += ', finished_at=?';
    params.push(extra.finishedAt);
  }
  if (extra?.summaryJson !== undefined) {
    sql += ', summary_json=?';
    params.push(extra.summaryJson);
  }
  if (extra?.runtimePrecheckJson !== undefined) {
    sql += ', runtime_precheck_json=?';
    params.push(extra.runtimePrecheckJson);
  }
  sql += ' WHERE id=?';
  params.push(runId);
  db.prepare(sql).run(...params);
}

export function incrementNodeCounts(runId: string, outcome: 'success' | 'failed'): void {
  const db = getDatabase();
  if (outcome === 'success') {
    db.prepare(
      'UPDATE diagnostic_runs SET completed_nodes=completed_nodes+1, success_nodes=success_nodes+1 WHERE id=?',
    ).run(runId);
  } else {
    db.prepare(
      'UPDATE diagnostic_runs SET completed_nodes=completed_nodes+1, failed_nodes=failed_nodes+1 WHERE id=?',
    ).run(runId);
  }
}

export function getRunById(runId: string, userId: string): DiagRunRow | null {
  const db = getDatabase();
  return (
    (db
      .prepare('SELECT * FROM diagnostic_runs WHERE id=? AND user_id=?')
      .get(runId, userId) as DiagRunRow | undefined) ?? null
  );
}

export function getRunByIdAdmin(runId: string): DiagRunRow | null {
  const db = getDatabase();
  return (
    (db
      .prepare('SELECT * FROM diagnostic_runs WHERE id=?')
      .get(runId) as DiagRunRow | undefined) ?? null
  );
}

export function getRecentRuns(userId: string, limit = 20): DiagRunRow[] {
  const db = getDatabase();
  return db
    .prepare(
      'SELECT * FROM diagnostic_runs WHERE user_id=? ORDER BY created_at DESC LIMIT ?',
    )
    .all(userId, limit) as DiagRunRow[];
}

// ---------------------------------------------------------------------------
// Node results
// ---------------------------------------------------------------------------

export function saveNodeResult(result: NodeResultInput): string {
  const db = getDatabase();
  const id = randomUUID();
  db.prepare(`
    INSERT INTO diagnostic_node_results
      (id, run_id, node_id, provider_id, node_name, protocol, server, port,
       raw_status, raw_latency_ms, ipshub_status, ipshub_latency_ms,
       tcp_status, tcp_latency_ms, clash_config_status, loon_config_status,
       failed_stage, error_reason, diagnosis, result_json, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, result.runId, result.nodeId, result.providerId, result.nodeName,
    result.protocol, result.server, result.port,
    result.rawStatus, result.rawLatencyMs,
    result.ipshubStatus, result.ipshubLatencyMs,
    result.tcpStatus, result.tcpLatencyMs,
    result.clashConfigStatus, result.loonConfigStatus,
    result.failedStage, result.errorReason, result.diagnosis, result.resultJson,
    Date.now(),
  );
  return id;
}

export function getRunResults(runId: string): unknown[] {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM diagnostic_node_results WHERE run_id=? ORDER BY created_at ASC')
    .all(runId);
}

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

export function saveLog(log: DiagLogInput): void {
  const db = getDatabase();
  const id = randomUUID();
  db.prepare(`
    INSERT INTO diagnostic_logs
      (id, run_id, node_id, stage, level, message, detail_json, duration_ms, created_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(
    id, log.runId, log.nodeId, log.stage, log.level,
    log.message, log.detailJson, log.durationMs, Date.now(),
  );
}

export function getNodeLogs(runId: string, nodeId: string): unknown[] {
  const db = getDatabase();
  return db
    .prepare(
      'SELECT * FROM diagnostic_logs WHERE run_id=? AND node_id=? ORDER BY created_at ASC',
    )
    .all(runId, nodeId);
}

export function getRunLogs(runId: string): unknown[] {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM diagnostic_logs WHERE run_id=? ORDER BY created_at ASC')
    .all(runId);
}

// ---------------------------------------------------------------------------
// Config diffs
// ---------------------------------------------------------------------------

export function saveConfigDiff(runId: string, nodeId: string, diffJson: string): void {
  const db = getDatabase();
  const id = randomUUID();
  db.prepare(`
    INSERT INTO diagnostic_config_diffs (id, run_id, node_id, diff_json, created_at)
    VALUES (?,?,?,?,?)
  `).run(id, runId, nodeId, diffJson, Date.now());
}

export function getNodeDiff(runId: string, nodeId: string): unknown | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT * FROM diagnostic_config_diffs WHERE run_id=? AND node_id=?')
    .get(runId, nodeId) as { diff_json: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.diff_json);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Debug package (all data for a run)
// ---------------------------------------------------------------------------

export function getRunAllData(runId: string): {
  run: DiagRunRow | null;
  results: unknown[];
  logs: unknown[];
  diffs: unknown[];
} {
  const db = getDatabase();
  const run = (db
    .prepare('SELECT * FROM diagnostic_runs WHERE id=?')
    .get(runId) as DiagRunRow | undefined) ?? null;
  const results = db
    .prepare('SELECT * FROM diagnostic_node_results WHERE run_id=? ORDER BY created_at ASC')
    .all(runId);
  const logs = db
    .prepare('SELECT * FROM diagnostic_logs WHERE run_id=? ORDER BY created_at ASC')
    .all(runId);
  const diffs = db
    .prepare('SELECT * FROM diagnostic_config_diffs WHERE run_id=? ORDER BY created_at ASC')
    .all(runId);
  return { run, results, logs, diffs };
}
