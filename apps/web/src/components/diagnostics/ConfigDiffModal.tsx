import { useQuery } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { diagnosticsApi } from '@/api/diagnostics';
import type { ConfigDiffItem } from '@/types/diagnostics';

interface Props {
  runId: string;
  nodeId: string;
  nodeName: string;
  onClose: () => void;
}

const RISK_CLASSES: Record<string, string> = {
  critical: 'bg-danger/10 text-danger border-danger/30',
  high: 'bg-warning/10 text-warning border-warning/30',
  medium: 'bg-primary/5 text-primary border-primary/20',
  low: 'bg-surface-1 text-text-muted border-line',
};

const RISK_LABELS: Record<string, string> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
};

function redact(val: unknown): string {
  if (val === null || val === undefined) return '(empty)';
  const s = String(val);
  if (s.length > 60) return s.slice(0, 30) + '…' + s.slice(-10);
  return s;
}

export function ConfigDiffModal({ runId, nodeId, nodeName, onClose }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['diag-node-diff', runId, nodeId],
    queryFn: () => diagnosticsApi.getNodeDiff(runId, nodeId),
  });

  const diffs = (Array.isArray(data?.diff) ? data.diff : []) as ConfigDiffItem[];

  return (
    <Modal
      open
      title={`Config Diff — ${nodeName}`}
      onClose={onClose}
      widthClassName="max-w-2xl"
    >
      {isLoading && (
        <div className="py-8 text-center text-sm text-text-muted">Loading diff…</div>
      )}
      {isError && (
        <div className="py-4 text-sm text-danger">Failed to load config diff.</div>
      )}
      {!isLoading && !isError && diffs.length === 0 && (
        <div className="py-8 text-center text-sm text-text-muted">
          No field differences found between raw and IPSHub config for this node.
        </div>
      )}
      {diffs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-text-muted mb-3">
            {diffs.length} field(s) differ between the raw subscription value and the IPSHub-stored value.
          </p>
          {diffs.map((diff, idx) => (
            <div
              key={idx}
              className={`rounded border px-3 py-2.5 ${RISK_CLASSES[diff.risk] ?? RISK_CLASSES['low']}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-sm font-semibold">{diff.field}</span>
                <span
                  className={`rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${RISK_CLASSES[diff.risk]}`}
                >
                  {RISK_LABELS[diff.risk] ?? diff.risk}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-text-muted mb-0.5">Raw (provider)</div>
                  <code className="block break-all">{redact(diff.rawValue)}</code>
                </div>
                <div>
                  <div className="text-text-muted mb-0.5">IPSHub (stored)</div>
                  <code className="block break-all">{redact(diff.normalizedValue)}</code>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
