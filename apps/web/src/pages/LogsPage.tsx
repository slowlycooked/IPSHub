import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { logsApi } from '@/api/logs';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
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

  return (
    <div>
      <PageHeader title="Logs" description="Inspect refresh jobs and access logs." />

      <div className="mb-4 flex items-center gap-2">
        <Button variant={tab === 'refresh' ? 'primary' : 'secondary'} onClick={() => setTab('refresh')}>
          Refresh Jobs
        </Button>
        <Button variant={tab === 'access' ? 'primary' : 'secondary'} onClick={() => setTab('access')}>
          Access Logs
        </Button>
      </div>

      <Card>
        {tab === 'refresh' ? (
          refreshJobs.length === 0 ? (
            <EmptyState title="No refresh logs" description="Refresh tasks will appear here." />
          ) : (
            <DataTable headers={['Provider', 'Status', 'Node Count', 'Duration', 'Updated At', 'Error']}>
              {refreshJobs.map((job) => (
                <tr key={job.id} className="border-b border-line/60 text-sm text-text-muted hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-text">{job.providerName}</td>
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
                  <td className="px-4 py-3">{job.nodeCount ?? '-'}</td>
                  <td className="px-4 py-3">{formatDuration(job.durationMs)}</td>
                  <td className="px-4 py-3">{formatDateTime(job.updatedAt)}</td>
                  <td className="max-w-[220px] px-4 py-3" title={job.errorMessage || ''}>
                    {job.errorMessage ? (
                      <button
                        type="button"
                        className="w-full truncate text-left text-danger"
                        onClick={() => setErrorDetail(job.errorMessage || '')}
                      >
                        {truncate(job.errorMessage, 32)}
                      </button>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          )
        ) : accessLogs.length === 0 ? (
          <EmptyState title="No access logs" description="Subscription request logs will appear here." />
        ) : (
          <DataTable headers={['Profile', 'Output Type', 'Client IP', 'User-Agent', 'Status Code', 'Created At']}>
            {accessLogs.map((log) => (
              <tr key={log.id} className="border-b border-line/60 text-sm text-text-muted hover:bg-white/[0.03]">
                <td className="px-4 py-3 text-text">{log.profileName}</td>
                <td className="px-4 py-3">{log.outputFormat}</td>
                <td className="px-4 py-3 font-mono text-xs">{log.ipAddress || '-'}</td>
                <td className="max-w-[260px] px-4 py-3" title={log.userAgent || ''}>
                  {truncate(log.userAgent, 40)}
                </td>
                <td className="px-4 py-3">{log.statusCode ?? '-'}</td>
                <td className="px-4 py-3">{formatDateTime(log.accessedAt)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <Modal
        open={Boolean(errorDetail)}
        title="Error Detail"
        onClose={() => setErrorDetail('')}
        widthClassName="max-w-xl"
      >
        <pre className="whitespace-pre-wrap rounded-2xl bg-black/20 p-3 text-xs text-text">{errorDetail}</pre>
      </Modal>
    </div>
  );
}
