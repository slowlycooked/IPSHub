import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { logsApi } from '@/api/logs';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDateTime, formatDuration, truncate } from '@/utils/format';

type Tab = 'refresh' | 'access';

export function LogsPage() {
  const [tab, setTab] = useState<Tab>('refresh');
  const [errorDetail, setErrorDetail] = useState('');

  const refreshQuery = useQuery({
    queryKey: ['logs', 'refresh'],
    queryFn: async () => {
      try {
        return await logsApi.refreshJobs();
      } catch {
        return { logs: [] };
      }
    },
  });

  const accessQuery = useQuery({
    queryKey: ['logs', 'access'],
    queryFn: async () => {
      try {
        return await logsApi.accessLogs();
      } catch {
        return { logs: [] };
      }
    },
  });

  if (refreshQuery.isLoading || accessQuery.isLoading) {
    return <LoadingState label="Loading logs..." />;
  }

  if (refreshQuery.isError || accessQuery.isError) {
    return (
      <ErrorState
        message="Failed to load logs."
        onRetry={() => {
          refreshQuery.refetch();
          accessQuery.refetch();
        }}
      />
    );
  }

  const refreshJobs = refreshQuery.data?.logs || [];
  const accessLogs = accessQuery.data?.logs || [];
  const failedJobs = refreshJobs.filter(j => j.status === 'failed');

  return (
    <div>
      <PageHeader 
        title="Logs" 
        description="Monitor subscription refresh tasks and access patterns."
      />

      {/* Tab Navigation */}
      <div className="mb-6 flex items-center gap-2 border-b border-line pb-4">
        <button
          onClick={() => setTab('refresh')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-4 ${
            tab === 'refresh'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          Refresh Jobs
          {failedJobs.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-danger/20 text-xs text-danger font-semibold">
              {failedJobs.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('access')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-4 ${
            tab === 'access'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          Access Logs
        </button>
      </div>

      {/* Refresh Jobs Tab */}
      {tab === 'refresh' && (
        <>
          {failedJobs.length > 0 && (
            <Card className="mb-6 border-danger/30 bg-danger/5 p-4">
              <h3 className="font-display text-sm font-semibold text-danger mb-3">Recent Errors</h3>
              <div className="space-y-2">
                {failedJobs.slice(0, 5).map(job => (
                  <div key={job.id} className="flex items-start gap-3 text-sm">
                    <span className="flex-shrink-0 text-danger">!</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-text-muted">
                        <strong>{job.providerName}</strong> failed to refresh
                      </p>
                      <button
                        type="button"
                        className="text-danger hover:underline text-xs mt-1"
                        onClick={() => setErrorDetail(job.errorMessage || '')}
                      >
                        {truncate(job.errorMessage || '', 60)}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            {refreshJobs.length === 0 ? (
              <div className="p-8">
                <EmptyState 
                  title="No refresh logs yet" 
                  description="Refresh tasks will appear here once providers are refreshed."
                />
              </div>
            ) : (
              <DataTable headers={['Provider', 'Status', 'Nodes', 'Duration', 'Time', 'Error']}>
                {refreshJobs.map((job) => (
                  <tr key={job.id} className="border-b border-line text-sm text-text-muted hover:bg-surface-1">
                    <td className="px-4 py-3 font-medium text-text">{job.providerName}</td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        tone={
                          job.status === 'failed'
                            ? 'danger'
                            : job.status === 'success'
                              ? 'success'
                              : 'warning'
                        }
                      >
                        {job.status}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{job.nodeCount ?? '-'}</td>
                    <td className="px-4 py-3 text-xs">{formatDuration(job.durationMs)}</td>
                    <td className="px-4 py-3 text-xs">{formatDateTime(job.updatedAt)}</td>
                    <td className="px-4 py-3 max-w-xs">
                      {job.errorMessage ? (
                        <button
                          type="button"
                          className="text-danger hover:underline text-xs"
                          onClick={() => setErrorDetail(job.errorMessage || '')}
                          title={job.errorMessage}
                        >
                          {truncate(job.errorMessage, 30)}
                        </button>
                      ) : (
                        <span className="text-text-dim">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Card>
        </>
      )}

      {/* Access Logs Tab */}
      {tab === 'access' && (
        <Card>
          {accessLogs.length === 0 ? (
            <div className="p-8">
              <EmptyState 
                title="No access logs yet" 
                description="Subscription endpoint requests will appear here."
              />
            </div>
          ) : (
            <DataTable headers={['Profile', 'Format', 'IP', 'User-Agent', 'Status', 'Time']}>
              {accessLogs.map((log) => (
                <tr key={log.id} className="border-b border-line text-sm text-text-muted hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-text">{log.profileName}</td>
                  <td className="px-4 py-3 text-xs">
                    <StatusBadge tone="primary">{log.outputFormat}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-primary">{log.ipAddress || '-'}</td>
                  <td className="px-4 py-3 text-xs max-w-xs truncate" title={log.userAgent || ''}>
                    {truncate(log.userAgent || 'unknown', 40)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${log.statusCode === 200 ? 'text-success' : 'text-warning'}`}>
                      {log.statusCode ?? '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">{formatDateTime(log.accessedAt)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      )}

      {/* Error Detail Modal */}
      <Modal
        open={Boolean(errorDetail)}
        title="Error Details"
        onClose={() => setErrorDetail('')}
        widthClassName="max-w-2xl"
      >
        <div className="bg-surface-1 border border-danger/30 rounded-md p-4 overflow-x-auto">
          <pre className="whitespace-pre-wrap font-mono text-xs text-text-muted">
            {errorDetail}
          </pre>
        </div>
      </Modal>
    </div>
  );
}
