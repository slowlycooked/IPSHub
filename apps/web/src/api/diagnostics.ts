import { apiClient } from '@/api/client';
import type {
  DiagRun,
  DiagNodeResult,
  DiagLog,
  ConfigDiffItem,
  CreateRunPayload,
} from '@/types/diagnostics';

export const diagnosticsApi = {
  getCapabilities: () =>
    apiClient.get<{ singBoxAvailable: boolean }>('/api/diagnostics/capabilities'),

  createRun: (payload: CreateRunPayload) =>
    apiClient.post<{ runId: string; status: string }>('/api/diagnostics/latency-runs', payload),

  listRuns: () =>
    apiClient.get<{ runs: DiagRun[] }>('/api/diagnostics/latency-runs'),

  getRun: (runId: string) =>
    apiClient.get<{ run: DiagRun }>(`/api/diagnostics/latency-runs/${runId}`),

  getResults: (runId: string) =>
    apiClient.get<{ run: DiagRun; results: DiagNodeResult[] }>(
      `/api/diagnostics/latency-runs/${runId}/results`,
    ),

  getNodeLogs: (runId: string, nodeId: string) =>
    apiClient.get<{ logs: DiagLog[] }>(
      `/api/diagnostics/latency-runs/${runId}/nodes/${nodeId}/logs`,
    ),

  getNodeDiff: (runId: string, nodeId: string) =>
    apiClient.get<{ diff: ConfigDiffItem[] | null }>(
      `/api/diagnostics/latency-runs/${runId}/nodes/${nodeId}/diff`,
    ),

  getDebugPackageUrl: (runId: string) =>
    `/api/diagnostics/latency-runs/${runId}/debug-package`,
};
