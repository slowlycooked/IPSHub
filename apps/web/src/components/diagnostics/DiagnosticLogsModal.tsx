import { useQuery } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { diagnosticsApi } from '@/api/diagnostics';
import type { DiagLog } from '@/types/diagnostics';

interface Props {
  runId: string;
  nodeId: string;
  nodeName: string;
  onClose: () => void;
}

const LEVEL_CLASSES: Record<string, string> = {
  DEBUG: 'text-text-muted',
  INFO: 'text-primary',
  WARN: 'text-warning font-medium',
  ERROR: 'text-danger font-medium',
};

function LogRow({ log }: { log: DiagLog }) {
  const ts = new Date(log.created_at).toISOString().replace('T', ' ').slice(11, 23);
  return (
    <div className="border-b border-line/50 py-2 text-xs font-mono">
      <div className="flex items-start gap-2">
        <span className="shrink-0 text-text-muted">{ts}</span>
        <span className={`shrink-0 w-10 uppercase ${LEVEL_CLASSES[log.level] ?? ''}`}>{log.level}</span>
        <span className="shrink-0 text-text-dim w-24 truncate">[{log.stage}]</span>
        <span className="text-text">{log.message}</span>
        {log.duration_ms !== null && (
          <span className="ml-auto shrink-0 text-text-muted">{log.duration_ms}ms</span>
        )}
      </div>
      {log.detail_json && (() => {
        try {
          const parsed = JSON.parse(log.detail_json);
          return (
            <pre className="mt-1 ml-[calc(0.5rem+10rem+6rem)] text-[10px] text-text-muted whitespace-pre-wrap break-all">
              {JSON.stringify(parsed, null, 2)}
            </pre>
          );
        } catch {
          return null;
        }
      })()}
    </div>
  );
}

export function DiagnosticLogsModal({ runId, nodeId, nodeName, onClose }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['diag-node-logs', runId, nodeId],
    queryFn: () => diagnosticsApi.getNodeLogs(runId, nodeId),
  });

  const logs = data?.logs ?? [];

  return (
    <Modal
      open
      title={`Diagnostic Logs — ${nodeName}`}
      onClose={onClose}
      widthClassName="max-w-4xl"
    >
      {isLoading && (
        <div className="py-8 text-center text-sm text-text-muted">Loading logs…</div>
      )}
      {isError && (
        <div className="py-4 text-sm text-danger">Failed to load logs.</div>
      )}
      {!isLoading && !isError && logs.length === 0 && (
        <div className="py-8 text-center text-sm text-text-muted">No logs recorded for this node.</div>
      )}
      {logs.length > 0 && (
        <div className="divide-y divide-line/30">
          {(logs as DiagLog[]).map((log) => (
            <LogRow key={log.id} log={log} />
          ))}
        </div>
      )}
    </Modal>
  );
}
