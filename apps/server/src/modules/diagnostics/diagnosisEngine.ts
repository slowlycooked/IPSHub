import type { PrecheckResult } from './runtimeNetworkPrecheck';
import type { ConfigDiffItem } from './configDiffService';
import type { ConfigValidationResult } from './clientConfigValidator';

export type DiagnosisCode =
  | 'LIKELY_PROVIDER_OR_NETWORK_ISSUE'
  | 'LIKELY_IPSHUB_CONVERSION_ISSUE'
  | 'LIKELY_CLIENT_CONFIG_GENERATION_ISSUE'
  | 'NODE_AND_IPSHUB_LOOK_HEALTHY'
  | 'LIKELY_IPSHUB_RUNTIME_NETWORK_ISSUE'
  | 'SING_BOX_CONFIRMED_WORKING'
  | 'SING_BOX_CONFIRMED_FAILING'
  | 'SING_BOX_PROCESS_EXITED'
  | 'SING_BOX_INBOUND_NOT_READY'
  | 'CURL_PROXY_HANDSHAKE_FAILED'
  | 'IPSHUB_CONFIG_CONVERSION_FAILED'
  | 'RAW_CONFIG_INVALID_BUT_IPSHUB_FIXED'
  | 'SING_BOX_PROBE_INCONSISTENCY'
  | 'PROVIDER_NODE_UNAVAILABLE'
  | 'INFO_NODE_NOT_TESTABLE'
  | 'UNKNOWN_NEEDS_MANUAL_REVIEW';

const LOOPBACK_SERVERS = new Set(['127.0.0.1', '::1', 'localhost', '0.0.0.0']);

export interface DiagnosisInput {
  server?: string;
  tcpOk: boolean | null;
  tcpLatencyMs: number | null;
  configDiffs: ConfigDiffItem[];
  clashValidation: ConfigValidationResult | null;
  loonValidation: ConfigValidationResult | null;
  runtimePrecheck: PrecheckResult | null;
  rawProbeStatus: 'ok' | 'failed' | 'skipped' | null;
  ipshubProbeStatus: 'ok' | 'failed' | 'skipped' | null;
  rawCurlExitCode?: number | null;
  ipshubCurlExitCode?: number | null;
  rawProbeErrorCode?: string | null;
  ipshubProbeErrorCode?: string | null;
  rawSingBoxOutput?: string | null;
  ipshubSingBoxOutput?: string | null;
}

export interface DiagnosisResult {
  code: DiagnosisCode;
  explanation: string;
  criticalDiffs: ConfigDiffItem[];
}

export function diagnoseNode(input: DiagnosisInput): DiagnosisResult {
  const {
    server,
    tcpOk,
    configDiffs,
    clashValidation,
    loonValidation,
    runtimePrecheck,
    rawProbeStatus,
    ipshubProbeStatus,
    rawCurlExitCode,
    ipshubCurlExitCode,
    rawProbeErrorCode,
    ipshubProbeErrorCode,
    rawSingBoxOutput,
    ipshubSingBoxOutput,
  } = input;

  // Loopback/reserved address — subscription metadata node, not a real proxy
  if (server && LOOPBACK_SERVERS.has(server)) {
    return {
      code: 'INFO_NODE_NOT_TESTABLE',
      explanation: 'This node has a loopback/reserved server address (e.g. 127.0.0.1). It is a subscription metadata placeholder, not a real proxy node.',
      criticalDiffs: [],
    };
  }

  const criticalDiffs = configDiffs.filter(
    (d) => d.risk === 'critical' || d.risk === 'high',
  );

  // If sing-box has confirmed results, use them for definitive diagnosis
  if (rawProbeStatus === 'ok' && ipshubProbeStatus === 'ok') {
    return {
      code: 'SING_BOX_CONFIRMED_WORKING',
      explanation: 'Sing-box probed both raw and IPSHub nodes successfully. The node appears healthy.',
      criticalDiffs,
    };
  }
  if (rawProbeStatus === 'failed' && ipshubProbeStatus === 'failed') {
    if (rawProbeErrorCode === 'SING_BOX_PROCESS_EXITED' || ipshubProbeErrorCode === 'SING_BOX_PROCESS_EXITED') {
      return {
        code: 'SING_BOX_PROCESS_EXITED',
        explanation: 'sing-box exited before the local inbound was ready or before curl could probe through it. Inspect sing-box stdout/stderr and the generated config in the debug package.',
        criticalDiffs,
      };
    }

    if (rawProbeErrorCode === 'SING_BOX_INBOUND_NOT_READY' && ipshubProbeErrorCode === 'SING_BOX_INBOUND_NOT_READY') {
      return {
        code: 'SING_BOX_INBOUND_NOT_READY',
        explanation: 'sing-box started but the local inbound port did not become ready within 3000ms. Inspect the port readiness check, sing-box stdout/stderr, and generated config in the debug package.',
        criticalDiffs,
      };
    }

    if (rawCurlExitCode === 97 && ipshubCurlExitCode === 97) {
      return {
        code: 'CURL_PROXY_HANDSHAKE_FAILED',
        explanation: 'curl failed to handshake with the local sing-box proxy. This can be caused by a proxy protocol mismatch, an inbound that was not fully ready, incorrect curl proxy arguments, or the sing-box outbound refusing the request.',
        criticalDiffs,
      };
    }

    if (
      rawCurlExitCode !== 97 &&
      ipshubCurlExitCode !== 97 &&
      hasHysteria2OutboundFailure(rawSingBoxOutput, ipshubSingBoxOutput)
    ) {
      return {
        code: 'SING_BOX_CONFIRMED_FAILING',
        explanation: 'sing-box reported Hysteria2 outbound handshake/dial/timeout failures for both raw and IPSHub configs. The node appears unreachable at the proxy protocol layer.',
        criticalDiffs,
      };
    }

    return {
      code: 'UNKNOWN_NEEDS_MANUAL_REVIEW',
      explanation: 'Both raw and IPSHub sing-box probes failed, but there is not enough outbound-level sing-box evidence to blame the provider node. Inspect curl and sing-box logs in the debug package.',
      criticalDiffs,
    };
  }
  if (rawProbeStatus === 'ok' && ipshubProbeStatus === 'failed') {
    return {
      code: 'IPSHUB_CONFIG_CONVERSION_FAILED',
      explanation: 'sing-box connected with the raw provider config but failed with the IPSHub config. IPSHub likely changed or generated a config field incorrectly.',
      criticalDiffs,
    };
  }
  if (rawProbeStatus === 'failed' && ipshubProbeStatus === 'ok') {
    return {
      code: 'RAW_CONFIG_INVALID_BUT_IPSHUB_FIXED',
      explanation: 'sing-box failed with the raw provider config but succeeded with the IPSHub config. IPSHub appears to have normalized or repaired an invalid raw config.',
      criticalDiffs,
    };
  }

  // No sing-box data — use TCP + diff + config validity
  if (runtimePrecheck && !runtimePrecheck.healthy) {
    return {
      code: 'LIKELY_IPSHUB_RUNTIME_NETWORK_ISSUE',
      explanation: 'The IPSHub server itself cannot reach the internet. All probes are suspect.',
      criticalDiffs,
    };
  }

  if (tcpOk === false) {
    return {
      code: 'LIKELY_PROVIDER_OR_NETWORK_ISSUE',
      explanation: 'TCP connection to the node failed. The provider server may be down or unreachable from IPSHub.',
      criticalDiffs,
    };
  }

  if (tcpOk === true) {
    if (criticalDiffs.length > 0) {
      return {
        code: 'LIKELY_IPSHUB_CONVERSION_ISSUE',
        explanation: `TCP succeeded but ${criticalDiffs.length} critical/high-risk field(s) differ between raw and IPSHub config (${criticalDiffs.map((d) => d.field).join(', ')}). IPSHub may have incorrectly transformed the node.`,
        criticalDiffs,
      };
    }

    const configInvalid =
      (clashValidation && !clashValidation.valid) ||
      (loonValidation && !loonValidation.valid);
    if (configInvalid) {
      return {
        code: 'LIKELY_CLIENT_CONFIG_GENERATION_ISSUE',
        explanation: 'TCP succeeded and no critical config diffs found, but Clash/Loon config generation has errors. The issue is likely in the renderer.',
        criticalDiffs,
      };
    }

    return {
      code: 'NODE_AND_IPSHUB_LOOK_HEALTHY',
      explanation: 'TCP succeeded, config diff is clean, and client configs are valid. The node appears healthy.',
      criticalDiffs,
    };
  }

  return {
    code: 'UNKNOWN_NEEDS_MANUAL_REVIEW',
    explanation: 'Not enough data to make a diagnosis. Download the debug package for manual inspection.',
    criticalDiffs,
  };
}

export const DIAGNOSIS_LABELS: Record<DiagnosisCode, string> = {
  LIKELY_PROVIDER_OR_NETWORK_ISSUE: 'Provider / Network Issue',
  LIKELY_IPSHUB_CONVERSION_ISSUE: 'IPSHub Conversion Issue',
  LIKELY_CLIENT_CONFIG_GENERATION_ISSUE: 'Client Config Generation Issue',
  NODE_AND_IPSHUB_LOOK_HEALTHY: 'Looks Healthy',
  LIKELY_IPSHUB_RUNTIME_NETWORK_ISSUE: 'IPSHub Runtime Network Issue',
  SING_BOX_CONFIRMED_WORKING: 'Sing-Box: Confirmed Working',
  SING_BOX_CONFIRMED_FAILING: 'Sing-Box: Confirmed Failing',
  SING_BOX_PROCESS_EXITED: 'Sing-Box Process Exited',
  SING_BOX_INBOUND_NOT_READY: 'Sing-Box Inbound Not Ready',
  CURL_PROXY_HANDSHAKE_FAILED: 'curl Proxy Handshake Failed',
  IPSHUB_CONFIG_CONVERSION_FAILED: 'IPSHub Config Conversion Failed',
  RAW_CONFIG_INVALID_BUT_IPSHUB_FIXED: 'Raw Config Invalid, IPSHub Fixed',
  SING_BOX_PROBE_INCONSISTENCY: 'Sing-Box: Probe Inconsistency (Transient)',
  PROVIDER_NODE_UNAVAILABLE: 'Provider Node Unavailable',
  INFO_NODE_NOT_TESTABLE: 'Subscription Info Node (Not Testable)',
  UNKNOWN_NEEDS_MANUAL_REVIEW: 'Unknown – Manual Review Needed',
};

function hasHysteria2OutboundFailure(...logs: Array<string | null | undefined>): boolean {
  return logs.some((log) => {
    const text = log?.toLowerCase() ?? '';
    return text.includes('hysteria2') &&
      (text.includes('handshake') || text.includes('dial') || text.includes('timeout'));
  });
}
