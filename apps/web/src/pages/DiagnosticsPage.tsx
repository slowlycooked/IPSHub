import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '@/api/queryClient';
import { providersApi } from '@/api/providers';
import { diagnosticsApi } from '@/api/diagnostics';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import type { DiagRun, CreateRunPayload } from '@/types/diagnostics';
import { DiagnosticConfigForm } from '@/components/diagnostics/DiagnosticConfigForm';
import { DiagnosticProgress } from '@/components/diagnostics/DiagnosticProgress';
import { DiagnosticSummaryCards } from '@/components/diagnostics/DiagnosticSummaryCards';
import { DiagnosticResultTable } from '@/components/diagnostics/DiagnosticResultTable';

type PageState = 'idle' | 'running' | 'done';

export function DiagnosticsPage() {
  const { pushToast } = useToast();
  const [pageState, setPageState] = useState<PageState>('idle');
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [completedRun, setCompletedRun] = useState<DiagRun | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Providers list for the config form
  const { data: providersData } = useQuery({
    queryKey: ['providers'],
    queryFn: () => providersApi.list(),
  });

  // Results for the completed run
  const { data: resultsData } = useQuery({
    queryKey: ['diag-results', completedRun?.id],
    queryFn: () => diagnosticsApi.getResults(completedRun!.id),
    enabled: !!completedRun?.id,
  });

  // History of recent runs
  const { data: runsData, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['diag-runs'],
    queryFn: () => diagnosticsApi.listRuns(),
    enabled: showHistory,
  });

  const createRunMutation = useMutation({
    mutationFn: (payload: CreateRunPayload) => diagnosticsApi.createRun(payload),
    onSuccess: (data) => {
      setActiveRunId(data.runId);
      setPageState('running');
      setCompletedRun(null);
      queryClient.invalidateQueries({ queryKey: ['diag-runs'] });
    },
    onError: () => {
      pushToast('Failed to start diagnostic run.', 'error');
    },
  });

  const providers = providersData?.providers ?? [];

  const handleFormSubmit = (cfg: {
    providerIds: string[];
    timeoutMs: number;
    concurrency: number;
    testUrls: string[];
  }) => {
    createRunMutation.mutate({
      mode: 'compare',
      clientFormats: ['clash', 'loon'],
      scope: 'provider',
      providerIds: cfg.providerIds,
      testUrls: cfg.testUrls,
      timeoutMs: cfg.timeoutMs,
      concurrency: cfg.concurrency,
    });
  };

  const handleRunCompleted = (run: DiagRun) => {
    setCompletedRun(run);
    setPageState('done');
    queryClient.invalidateQueries({ queryKey: ['diag-runs'] });
    if (run.status === 'completed') {
      pushToast(`Diagnostics complete. ${run.success_nodes} healthy, ${run.failed_nodes} issues found.`, 'info');
    } else {
      pushToast('Diagnostic run failed.', 'error');
    }
  };

  const handleReset = () => {
    setPageState('idle');
    setActiveRunId(null);
    setCompletedRun(null);
  };

  const recentRuns = runsData?.runs ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Latency Diagnostics"
        description="Detect why nodes fail in your client by comparing raw subscription data with IPSHub-processed configs."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory((v) => !v)}
            >
              {showHistory ? 'Hide History' : 'Recent Runs'}
            </Button>
            {pageState !== 'idle' && (
              <Button variant="secondary" size="sm" onClick={handleReset}>
                New Run
              </Button>
            )}
          </div>
        }
      />

      {/* How it works banner */}
      {pageState === 'idle' && (
        <div className="rounded-md border border-primary/20 bg-primary/5 p-4 text-sm text-text-muted">
          <strong className="text-primary">How Compare Mode works:</strong>{' '}
          IPSHub fetches the raw subscription from your provider, parses all nodes, then compares them field-by-field
          against what's stored in the DB. A TCP probe checks connectivity. If sing-box is installed, a full
          protocol handshake confirms actual reachability.
        </div>
      )}

      {/* Run history */}
      {showHistory && (
        <div className="rounded-md border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="font-semibold text-primary text-sm">Recent Runs</h2>
          </div>
          <div className="divide-y divide-line">
            {isLoadingHistory && (
              <p className="px-5 py-4 text-sm text-text-muted">Loading…</p>
            )}
            {recentRuns.length === 0 && !isLoadingHistory && (
              <p className="px-5 py-4 text-sm text-text-muted">No runs yet.</p>
            )}
            {recentRuns.map((run) => (
              <div key={run.id} className="flex items-center justify-between px-5 py-3 hover:bg-surface-1/50">
                <div>
                  <span className="font-mono text-xs text-text-muted">{run.id.slice(0, 8)}…</span>
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                    run.status === 'completed' ? 'bg-success/10 text-success' :
                    run.status === 'running' ? 'bg-primary/10 text-primary' :
                    'bg-danger/10 text-danger'
                  }`}>
                    {run.status}
                  </span>
                  <span className="ml-3 text-xs text-text-muted">
                    {run.success_nodes}/{run.total_nodes} healthy
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">
                    {new Date(run.created_at).toLocaleString()}
                  </span>
                  {(run.status === 'completed' || run.status === 'failed') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setCompletedRun(run);
                        setPageState('done');
                      }}
                    >
                      View
                    </Button>
                  )}
                  <a
                    href={diagnosticsApi.getDebugPackageUrl(run.id)}
                    download
                    className="rounded px-2 py-1 text-xs text-text-muted hover:text-text hover:bg-primary/5 transition-colors"
                  >
                    Debug
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Config form */}
      {pageState === 'idle' && (
        <DiagnosticConfigForm
          providers={providers}
          isLoading={createRunMutation.isPending}
          onSubmit={handleFormSubmit}
        />
      )}

      {/* Progress */}
      {pageState === 'running' && activeRunId && (
        <DiagnosticProgress runId={activeRunId} onCompleted={handleRunCompleted} />
      )}

      {/* Results */}
      {pageState === 'done' && completedRun && (
        <div className="space-y-5">
          <DiagnosticSummaryCards run={completedRun} />

          {resultsData?.results && resultsData.results.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-semibold text-primary">Node Results</h2>
                <a
                  href={diagnosticsApi.getDebugPackageUrl(completedRun.id)}
                  download
                  className="text-xs text-text-muted hover:text-text underline underline-offset-2"
                >
                  Download Debug Package
                </a>
              </div>
              <DiagnosticResultTable
                runId={completedRun.id}
                results={resultsData.results}
              />
            </div>
          )}

          {(!resultsData || resultsData.results.length === 0) && (
            <div className="rounded-md border border-line bg-white p-8 text-center text-sm text-text-muted">
              {completedRun.status === 'completed'
                ? 'No node results were recorded for this run.'
                : 'Run did not complete successfully.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
