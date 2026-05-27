import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { DiagNodeResult, DiagnosisCode } from '@/types/diagnostics';
import { DIAGNOSIS_LABELS, DIAGNOSIS_TONES } from '@/types/diagnostics';
import { DiagnosticLogsModal } from './DiagnosticLogsModal';
import { ConfigDiffModal } from './ConfigDiffModal';

interface Props {
  runId: string;
  results: DiagNodeResult[];
}

const TONE_CLASSES: Record<string, string> = {
  success: 'bg-success/10 text-success border-success/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  danger: 'bg-danger/10 text-danger border-danger/30',
  neutral: 'bg-surface-1 text-text-muted border-line',
};

function DiagBadge({ code }: { code: DiagnosisCode | null }) {
  if (!code) return <span className="text-text-muted text-xs">—</span>;
  const tone = DIAGNOSIS_TONES[code] ?? 'neutral';
  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}>
      {DIAGNOSIS_LABELS[code] ?? code}
    </span>
  );
}

function ProbeCell({
  status,
  latencyMs,
  naLabel,
}: {
  status: string | null;
  latencyMs: number | null;
  naLabel?: string;
}) {
  if (!status) return <span className="text-text-muted text-xs">—</span>;
  if (status === 'ok') {
    return <span className="text-success text-xs">{latencyMs !== null ? `${latencyMs}ms` : 'ok'}</span>;
  }
  if (status === 'skipped') {
    return <span className="text-text-muted text-xs" title={naLabel}>{naLabel ?? 'skipped'}</span>;
  }
  return <span className="text-danger text-xs">failed</span>;
}

export function DiagnosticResultTable({ runId, results }: Props) {
  const [logsNode, setLogsNode] = useState<DiagNodeResult | null>(null);
  const [diffNode, setDiffNode] = useState<DiagNodeResult | null>(null);
  const [diagFilter, setDiagFilter] = useState<string>('all');

  // Strip info/local nodes that may have slipped through (belt-and-suspenders)
  const INFO_PATTERNS = [
    /剩余流量/, /流量[：:]/, /套餐到期/, /到期时间/, /距离下次重置/, /重置剩余/,
    /已用流量/, /总流量/, /剩余/, /expire/i, /traffic/i,
    /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
    /^\d{4}-\d{2}-\d{2}$/,
  ];
  const isInfoName = (name: string | null) =>
    !!name && INFO_PATTERNS.some((p) => p.test(name));
  const isLoopbackServer = (server: string | null) =>
    !!server && (/^127\./.test(server) || server === 'localhost' || server === '::1');

  const proxyResults = results.filter(
    (r) => !isInfoName(r.node_name) && !isLoopbackServer(r.server),
  );
  const hiddenCount = results.length - proxyResults.length;

  const diagnoses = Array.from(new Set(proxyResults.map((r) => r.diagnosis ?? 'null')));

  const filtered = diagFilter === 'all'
    ? proxyResults
    : proxyResults.filter((r) => (r.diagnosis ?? 'null') === diagFilter);

  return (
    <div className="space-y-3">
      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-text-muted">Filter:</span>
        {['all', ...diagnoses].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDiagFilter(d)}
            className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
              diagFilter === d
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'border-line text-text-muted hover:border-primary/40'
            }`}
          >
            {d === 'all' ? 'All' : DIAGNOSIS_LABELS[d as DiagnosisCode] ?? d}
            {d !== 'all' && (
              <span className="ml-1 opacity-60">
                ({proxyResults.filter((r) => (r.diagnosis ?? 'null') === d).length})
              </span>
            )}
          </button>
        ))}
        {hiddenCount > 0 && (
          <span className="ml-2 text-xs text-text-muted italic">
            ({hiddenCount} info/local {hiddenCount === 1 ? 'node' : 'nodes'} hidden)
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border border-line">
        <table className="min-w-full text-sm">
          <thead className="border-b border-line bg-surface-1">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Node</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Protocol</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">TCP</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">SingBox</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Clash</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Diagnosis</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-text-muted">
                  No results match the current filter.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="hover:bg-surface-1/50 transition-colors">
                  <td className="px-4 py-2.5 max-w-[200px]">
                    <div className="truncate font-medium text-text" title={r.node_name ?? ''}>
                      {r.node_name ?? '—'}
                    </div>
                    {r.server && (
                      <div className="text-xs text-text-muted truncate">{r.server}:{r.port}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded bg-surface-1 px-1.5 py-0.5 text-xs uppercase tracking-wide text-text-muted">
                      {r.protocol ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <ProbeCell
                      status={r.tcp_status}
                      latencyMs={r.tcp_latency_ms}
                      naLabel={r.tcp_status === 'skipped' ? 'N/A (UDP)' : undefined}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <ProbeCell status={r.raw_status} latencyMs={r.raw_latency_ms} />
                  </td>
                  <td className="px-4 py-2.5">
                    {r.clash_config_status === 'ok' ? (
                      <span className="text-success text-xs">valid</span>
                    ) : r.clash_config_status ? (
                      <span className="text-danger text-xs">invalid</span>
                    ) : (
                      <span className="text-text-muted text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <DiagBadge code={r.diagnosis} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setLogsNode(r)}
                      >
                        Logs
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDiffNode(r)}
                      >
                        Diff
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {logsNode && (
        <DiagnosticLogsModal
          runId={runId}
          nodeId={logsNode.node_id ?? logsNode.id}
          nodeName={logsNode.node_name ?? 'Node'}
          onClose={() => setLogsNode(null)}
        />
      )}

      {diffNode && (
        <ConfigDiffModal
          runId={runId}
          nodeId={diffNode.node_id ?? diffNode.id}
          nodeName={diffNode.node_name ?? 'Node'}
          onClose={() => setDiffNode(null)}
        />
      )}
    </div>
  );
}
