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
import { formatDateTime, truncate } from '@/utils/format';

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
        return { jobs: [] };
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

  const refreshJobs = refreshQuery.data?.jobs || [];
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
            <DataTable headers={['Provider', 'Status', 'Node Count', 'Started At', 'Finished At', 'Error']}>
              {refreshJobs.map((job) => (
                <tr key={job.id} className="border-b border-slate-100 text-sm hover:bg-slate-50">
                  <td className="px-4 py-3">{job.provider_name}</td>
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
                  <td className="px-4 py-3">{job.node_count ?? '-'}</td>
                  <td className="px-4 py-3">{formatDateTime(job.started_at)}</td>
                  <td className="px-4 py-3">{formatDateTime(job.finished_at)}</td>
                  <td className="max-w-[220px] px-4 py-3" title={job.error || ''}>
                    {job.error ? (
                      <button
                        type="button"
                        className="w-full truncate text-left text-danger"
                        onClick={() => setErrorDetail(job.error || '')}
                      >
                        {truncate(job.error, 32)}
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
              <tr key={log.id} className="border-b border-slate-100 text-sm hover:bg-slate-50">
                <td className="px-4 py-3">{log.profile_name}</td>
                <td className="px-4 py-3">{log.output_type}</td>
                <td className="px-4 py-3 font-mono text-xs">{log.client_ip}</td>
                <td className="max-w-[260px] px-4 py-3" title={log.user_agent}>
                  {truncate(log.user_agent, 40)}
                </td>
                <td className="px-4 py-3">{log.status_code}</td>
                <td className="px-4 py-3">{formatDateTime(log.created_at)}</td>
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
        <pre className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-700">{errorDetail}</pre>
      </Modal>
    </div>
  );
}
