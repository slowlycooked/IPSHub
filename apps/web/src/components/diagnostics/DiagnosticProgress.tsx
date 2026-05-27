import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { diagnosticsApi } from '@/api/diagnostics';
import type { DiagRun } from '@/types/diagnostics';

interface Props {
  runId: string;
  onCompleted: (run: DiagRun) => void;
}

function Progress({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-text-muted">
        <span>{value} / {max} nodes</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-surface-1 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function DiagnosticProgress({ runId, onCompleted }: Props) {
  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;

  const { data, error } = useQuery({
    queryKey: ['diag-run', runId],
    queryFn: () => diagnosticsApi.getRun(runId),
    refetchInterval: (query) => {
      const status = query.state.data?.run.status;
      if (status === 'completed' || status === 'failed') return false;
      return 1000;
    },
  });

  const run = data?.run;

  useEffect(() => {
    if (run?.status === 'completed' || run?.status === 'failed') {
      onCompletedRef.current(run);
    }
  }, [run?.status]);

  if (error) {
    return (
      <div className="rounded-md border border-danger/40 bg-danger/5 p-4 text-sm text-danger">
        Failed to load run status.
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-muted py-4">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span>Loading run status…</span>
      </div>
    );
  }

  const elapsed = run.started_at
    ? Math.round((Date.now() - run.started_at) / 1000)
    : null;

  return (
    <div className="rounded-md border border-line bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-primary">Running Diagnostics…</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            run.status === 'running'
              ? 'bg-primary/10 text-primary'
              : run.status === 'completed'
              ? 'bg-success/10 text-success'
              : 'bg-danger/10 text-danger'
          }`}
        >
          {run.status.toUpperCase()}
        </span>
      </div>

      <Progress value={run.completed_nodes} max={run.total_nodes} />

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded bg-surface-1 py-2">
          <div className="text-xl font-semibold text-primary">{run.completed_nodes}</div>
          <div className="text-xs text-text-muted">Completed</div>
        </div>
        <div className="rounded bg-success/5 py-2">
          <div className="text-xl font-semibold text-success">{run.success_nodes}</div>
          <div className="text-xs text-text-muted">Healthy</div>
        </div>
        <div className="rounded bg-danger/5 py-2">
          <div className="text-xl font-semibold text-danger">{run.failed_nodes}</div>
          <div className="text-xs text-text-muted">Issues Found</div>
        </div>
      </div>

      {elapsed !== null && (
        <p className="text-xs text-text-muted">Elapsed: {elapsed}s</p>
      )}

      {run.status === 'running' && (
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Probing nodes…</span>
        </div>
      )}
    </div>
  );
}
