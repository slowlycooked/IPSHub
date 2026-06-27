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
    // If TCP succeeds but both sing-box probes fail, the problem is at the protocol
    // handshake layer — the provider node itself is unavailable, not a conversion issue.
    if (tcpOk === true) {
      return {
        code: 'PROVIDER_NODE_UNAVAILABLE',
        explanation: 'TCP reachable, but both raw and IPSHub sing-box probes failed. The provider node is likely down or experiencing a protocol-level outage.',
        criticalDiffs,
      };
    }
    return {
      code: 'SING_BOX_CONFIRMED_FAILING',
      explanation: 'Sing-box confirmed the node is unreachable for both raw and IPSHub configs.',
      criticalDiffs,
    };
  }
  if (rawProbeStatus === 'ok' && ipshubProbeStatus === 'failed') {
    if (criticalDiffs.length > 0) {
      return {
        code: 'LIKELY_IPSHUB_CONVERSION_ISSUE',
        explanation: 'Sing-box connected with raw config but failed with IPSHub config, and critical config differences were detected. A conversion issue is highly likely.',
        criticalDiffs,
      };
    }
    // Configs are identical but probes diverged — not a conversion issue.
    return {
      code: 'SING_BOX_PROBE_INCONSISTENCY',
      explanation: 'Sing-box succeeded with raw config but failed with IPSHub config, yet no config differences were found. This is likely a transient node failure or flaky network condition rather than a conversion bug.',
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
  SING_BOX_PROBE_INCONSISTENCY: 'Sing-Box: Probe Inconsistency (Transient)',
  PROVIDER_NODE_UNAVAILABLE: 'Provider Node Unavailable',
  INFO_NODE_NOT_TESTABLE: 'Subscription Info Node (Not Testable)',
  UNKNOWN_NEEDS_MANUAL_REVIEW: 'Unknown – Manual Review Needed',
};
