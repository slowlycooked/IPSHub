import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getDashboardData } from '@/api/dashboard';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDateTime, truncate } from '@/utils/format';

export function DashboardPage() {
  const navigate = useNavigate();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardData,
  });

  if (isLoading) {
    return <LoadingState label="Loading dashboard..." />;
  }

  if (isError || !data) {
    return <ErrorState message="Failed to load dashboard." onRetry={() => refetch()} />;
  }

  const stats = data.stats;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of providers, nodes, profiles, and recent system activities."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Providers"
          value={stats.providersTotal}
          hint="Total providers"
          onClick={() => navigate('/providers')}
        />
        <StatCard
          label="Enabled Providers"
          value={stats.providersEnabled}
          hint="Currently active"
          status="success"
          onClick={() => navigate('/providers')}
        />
        <StatCard
          label="Nodes"
          value={stats.nodesTotal}
          hint="Aggregated nodes"
          onClick={() => navigate('/nodes')}
        />
        <StatCard
          label="Profiles"
          value={stats.profilesTotal}
          hint={stats.latestRefreshAt ? `Last refresh ${formatDateTime(stats.latestRefreshAt)}` : 'No refresh yet'}
          onClick={() => navigate('/profiles')}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-base font-semibold text-text">Recent Refresh Jobs</h3>
          {data.recentRefreshJobs.length === 0 ? (
            <EmptyState title="No refresh jobs" description="Refresh providers to generate job history." />
          ) : (
            <DataTable headers={['Provider', 'Status', 'Node Count', 'Finished At', 'Error']}>
              {data.recentRefreshJobs.map((job) => (
                <tr key={job.id} className="border-b border-slate-100 text-sm hover:bg-slate-50">
                  <td className="px-4 py-3">{job.provider_name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      tone={
                        job.status === 'success'
                          ? 'success'
                          : job.status === 'failed'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {job.status}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3">{job.node_count ?? '-'}</td>
                  <td className="px-4 py-3">{formatDateTime(job.finished_at)}</td>
                  <td className="px-4 py-3" title={job.error}>{truncate(job.error, 42)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-base font-semibold text-text">Recent Access Logs</h3>
          {data.recentAccessLogs.length === 0 ? (
            <EmptyState title="No access logs" description="Subscription accesses will show up here." />
          ) : (
            <DataTable headers={['Profile', 'Output Type', 'Client IP', 'Status', 'Created At']}>
              {data.recentAccessLogs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100 text-sm hover:bg-slate-50">
                  <td className="px-4 py-3">{log.profile_name}</td>
                  <td className="px-4 py-3">{log.output_type}</td>
                  <td className="px-4 py-3 font-mono text-xs">{log.client_ip}</td>
                  <td className="px-4 py-3">{log.status_code}</td>
                  <td className="px-4 py-3">{formatDateTime(log.created_at)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>
    </div>
  );
}
