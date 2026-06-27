export type DiagnosisCode =
  | 'LIKELY_PROVIDER_OR_NETWORK_ISSUE'
  | 'LIKELY_IPSHUB_CONVERSION_ISSUE'
  | 'LIKELY_CLIENT_CONFIG_GENERATION_ISSUE'
  | 'NODE_AND_IPSHUB_LOOK_HEALTHY'
  | 'LIKELY_IPSHUB_RUNTIME_NETWORK_ISSUE'
  | 'SING_BOX_CONFIRMED_WORKING'
  | 'SING_BOX_CONFIRMED_FAILING'
  | 'SING_BOX_PROBE_INCONSISTENCY'
  | 'PROVIDER_NODE_UNAVAILABLE'
  | 'INFO_NODE_NOT_TESTABLE'
  | 'UNKNOWN_NEEDS_MANUAL_REVIEW';

export interface DiagRun {
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
  status: 'pending' | 'running' | 'completed' | 'failed';
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

export interface DiagNodeResult {
  id: string;
  run_id: string;
  node_id: string | null;
  provider_id: string | null;
  node_name: string | null;
  protocol: string | null;
  server: string | null;
  port: number | null;
  raw_status: string | null;
  raw_latency_ms: number | null;
  ipshub_status: string | null;
  ipshub_latency_ms: number | null;
  tcp_status: string | null;
  tcp_latency_ms: number | null;
  clash_config_status: string | null;
  loon_config_status: string | null;
  failed_stage: string | null;
  error_reason: string | null;
  diagnosis: DiagnosisCode | null;
  result_json: string | null;
  created_at: number;
}

export interface DiagLog {
  id: string;
  run_id: string;
  node_id: string | null;
  stage: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  detail_json: string | null;
  duration_ms: number | null;
  created_at: number;
}

export interface ConfigDiffItem {
  field: string;
  rawValue: unknown;
  normalizedValue: unknown;
  risk: 'critical' | 'high' | 'medium' | 'low';
}

export interface DiagRunSummary {
  total: number;
  completed: number;
  success: number;
  failed: number;
  runtimeHealthy: boolean;
  singBoxAvailable: boolean;
  finishedAt: string;
}

export interface PrecheckItem {
  url: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export interface RuntimePrecheck {
  healthy: boolean;
  checks: PrecheckItem[];
  checkedAt: string;
}

export interface CreateRunPayload {
  mode: 'compare';
  clientFormats: ('clash' | 'loon')[];
  scope: 'provider';
  providerIds: string[];
  testUrls: string[];
  timeoutMs: number;
  concurrency: number;
}

export const DIAGNOSIS_LABELS: Record<DiagnosisCode, string> = {
  LIKELY_PROVIDER_OR_NETWORK_ISSUE: 'Provider / Network Issue',
  LIKELY_IPSHUB_CONVERSION_ISSUE: 'IPSHub Conversion Issue',
  LIKELY_CLIENT_CONFIG_GENERATION_ISSUE: 'Client Config Generation Issue',
  NODE_AND_IPSHUB_LOOK_HEALTHY: 'Looks Healthy',
  LIKELY_IPSHUB_RUNTIME_NETWORK_ISSUE: 'IPSHub Runtime Network Issue',
  SING_BOX_CONFIRMED_WORKING: 'Sing-Box: Confirmed Working',
  SING_BOX_CONFIRMED_FAILING: 'Sing-Box: Confirmed Failing',
  SING_BOX_PROBE_INCONSISTENCY: 'Sing-Box: Probe Inconsistency (Transient)',
  PROVIDER_NODE_UNAVAILABLE: 'Provider Node Unavailable',
  INFO_NODE_NOT_TESTABLE: 'Subscription Info Node',
  UNKNOWN_NEEDS_MANUAL_REVIEW: 'Unknown – Manual Review',
};

export const DIAGNOSIS_TONES: Record<DiagnosisCode, 'success' | 'warning' | 'danger' | 'neutral'> = {
  NODE_AND_IPSHUB_LOOK_HEALTHY: 'success',
  SING_BOX_CONFIRMED_WORKING: 'success',
  LIKELY_PROVIDER_OR_NETWORK_ISSUE: 'danger',
  SING_BOX_CONFIRMED_FAILING: 'danger',
  SING_BOX_PROBE_INCONSISTENCY: 'warning',
  PROVIDER_NODE_UNAVAILABLE: 'danger',
  LIKELY_IPSHUB_CONVERSION_ISSUE: 'warning',
  LIKELY_CLIENT_CONFIG_GENERATION_ISSUE: 'warning',
  LIKELY_IPSHUB_RUNTIME_NETWORK_ISSUE: 'danger',
  INFO_NODE_NOT_TESTABLE: 'neutral',
  UNKNOWN_NEEDS_MANUAL_REVIEW: 'neutral',
};
