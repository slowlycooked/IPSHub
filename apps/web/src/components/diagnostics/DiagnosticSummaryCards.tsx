import type { DiagRun, DiagRunSummary, RuntimePrecheck, PrecheckItem } from '@/types/diagnostics';

interface Props {
  run: DiagRun;
}

function StatCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'success' | 'danger' | 'warning';
}) {
  const colorMap: Record<string, string> = {
    neutral: 'text-primary',
    success: 'text-success',
    danger: 'text-danger',
    warning: 'text-warning',
  };
  return (
    <div className="rounded-md border border-line bg-white p-4">
      <div className={`text-2xl font-semibold ${colorMap[tone]}`}>{value}</div>
      <div className="mt-0.5 text-xs text-text-muted">{label}</div>
    </div>
  );
}

export function DiagnosticSummaryCards({ run }: Props) {
  const summary: DiagRunSummary | null = run.summary_json
    ? (() => {
        try { return JSON.parse(run.summary_json) as DiagRunSummary; } catch { return null; }
      })()
    : null;

  const precheck: RuntimePrecheck | null = run.runtime_precheck_json
    ? (() => {
        try { return JSON.parse(run.runtime_precheck_json) as RuntimePrecheck; } catch { return null; }
      })()
    : null;

  const durationSec =
    run.started_at && run.finished_at
      ? Math.round((run.finished_at - run.started_at) / 1000)
      : null;

  const issueRate =
    run.total_nodes > 0
      ? Math.round((run.failed_nodes / run.total_nodes) * 100)
      : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Nodes" value={run.total_nodes} />
        <StatCard label="Healthy" value={run.success_nodes} tone="success" />
        <StatCard
          label="Issues Found"
          value={run.failed_nodes}
          tone={run.failed_nodes > 0 ? 'danger' : 'success'}
        />
        <StatCard
          label="Issue Rate"
          value={`${issueRate}%`}
          tone={issueRate > 50 ? 'danger' : issueRate > 0 ? 'warning' : 'success'}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {durationSec !== null && (
          <StatCard label="Duration" value={`${durationSec}s`} />
        )}
        {precheck && (
          <StatCard
            label="Server Network"
            value={precheck.healthy ? 'Reachable' : 'Unreachable'}
            tone={precheck.healthy ? 'success' : 'danger'}
          />
        )}
        {summary && (
          <StatCard
            label="Run Status"
            value={run.status === 'completed' ? 'Complete' : run.status}
            tone={run.status === 'completed' ? 'success' : 'danger'}
          />
        )}
      </div>

      {precheck && !precheck.healthy && (
        <div className="rounded-md border border-danger/40 bg-danger/5 p-3 text-sm text-danger">
          <strong>Warning:</strong> The IPSHub server cannot reach the internet. All connectivity results are suspect.
          Network precheck failed for all {precheck.checks.filter((c: PrecheckItem) => !c.ok).length} test URL(s).
        </div>
      )}

      {summary && summary.singBoxAvailable === false && (
        <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm text-warning">
          <strong>Note:</strong> The <code>sing-box</code> binary was not found on this server.
          Protocol handshake probes (Layer 5) were skipped — results reflect TCP and config-level checks only.
          Install sing-box and restart IPSHub to enable deep protocol testing.
        </div>
      )}

      {run.run_error && (
        <div className="rounded-md border border-danger/40 bg-danger/5 p-3 text-sm text-danger">
          <strong>Run Error:</strong> {run.run_error}
        </div>
      )}
    </div>
  );
}
