import { describe, expect, it } from 'vitest';
import { diagnoseNode } from './diagnosisEngine';

const baseInput = {
  server: 'example.com',
  tcpOk: null,
  tcpLatencyMs: null,
  configDiffs: [],
  clashValidation: { valid: true, errors: [] },
  loonValidation: { valid: true, errors: [] },
  runtimePrecheck: { healthy: true, checks: [], checkedAt: '2026-07-09T00:00:00.000Z' },
};

describe('diagnoseNode sing-box probe classification', () => {
  it('classifies dual curl exit 97 as curl proxy handshake failure', () => {
    const diagnosis = diagnoseNode({
      ...baseInput,
      rawProbeStatus: 'failed',
      ipshubProbeStatus: 'failed',
      rawCurlExitCode: 97,
      ipshubCurlExitCode: 97,
    });

    expect(diagnosis.code).toBe('CURL_PROXY_HANDSHAKE_FAILED');
    expect(diagnosis.explanation).toContain('curl');
    expect(diagnosis.explanation).toContain('sing-box');
  });

  it('classifies raw success with IPSHub failure as conversion failure', () => {
    const diagnosis = diagnoseNode({
      ...baseInput,
      rawProbeStatus: 'ok',
      ipshubProbeStatus: 'failed',
      ipshubCurlExitCode: 28,
    });

    expect(diagnosis.code).toBe('IPSHUB_CONFIG_CONVERSION_FAILED');
  });

  it('classifies raw failure with IPSHub success as IPSHub repaired raw config', () => {
    const diagnosis = diagnoseNode({
      ...baseInput,
      rawProbeStatus: 'failed',
      ipshubProbeStatus: 'ok',
      rawCurlExitCode: 28,
    });

    expect(diagnosis.code).toBe('RAW_CONFIG_INVALID_BUT_IPSHUB_FIXED');
  });

  it('only confirms failing Hysteria2 nodes when sing-box logs show outbound failure evidence', () => {
    const diagnosis = diagnoseNode({
      ...baseInput,
      rawProbeStatus: 'failed',
      ipshubProbeStatus: 'failed',
      rawCurlExitCode: 28,
      ipshubCurlExitCode: 28,
      rawSingBoxOutput: 'hysteria2 outbound dial timeout',
      ipshubSingBoxOutput: 'hysteria2 handshake failed',
    });

    expect(diagnosis.code).toBe('SING_BOX_CONFIRMED_FAILING');
  });

  it('classifies early sing-box process exit as a sing-box runtime error', () => {
    const diagnosis = diagnoseNode({
      ...baseInput,
      rawProbeStatus: 'failed',
      ipshubProbeStatus: 'failed',
      rawProbeErrorCode: 'SING_BOX_PROCESS_EXITED',
      ipshubProbeErrorCode: 'SING_BOX_INBOUND_NOT_READY',
    });

    expect(diagnosis.code).toBe('SING_BOX_PROCESS_EXITED');
  });

  it('classifies dual inbound readiness failures separately from node reachability', () => {
    const diagnosis = diagnoseNode({
      ...baseInput,
      rawProbeStatus: 'failed',
      ipshubProbeStatus: 'failed',
      rawProbeErrorCode: 'SING_BOX_INBOUND_NOT_READY',
      ipshubProbeErrorCode: 'SING_BOX_INBOUND_NOT_READY',
    });

    expect(diagnosis.code).toBe('SING_BOX_INBOUND_NOT_READY');
  });

  it('keeps dual failed probes inconclusive without outbound-level evidence', () => {
    const diagnosis = diagnoseNode({
      ...baseInput,
      rawProbeStatus: 'failed',
      ipshubProbeStatus: 'failed',
      rawCurlExitCode: 28,
      ipshubCurlExitCode: 28,
      rawSingBoxOutput: '',
      ipshubSingBoxOutput: '',
    });

    expect(diagnosis.code).toBe('UNKNOWN_NEEDS_MANUAL_REVIEW');
  });
});
