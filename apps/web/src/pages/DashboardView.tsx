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

export function DashboardView() {
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
        <StatCard label="Providers" value={stats.totalProviders} hint="Total providers" onClick={() => navigate('/providers')} />
        <StatCard label="Enabled Providers" value={stats.enabledProviders} hint="Currently active" status="success" onClick={() => navigate('/providers')} />
        <StatCard label="Nodes" value={stats.totalNodes} hint={`${stats.enabledNodes} enabled nodes`} onClick={() => navigate('/nodes')} />
        <StatCard label="Profiles" value={stats.totalProfiles} hint={stats.latestRefreshAt ? `Last refresh ${formatDateTime(stats.latestRefreshAt)}` : 'No refresh yet'} onClick={() => navigate('/profiles')} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-base font-semibold text-text">Recent Refresh Jobs</h3>
          {data.recentRefreshes.length === 0 ? (
            <EmptyState title="No refresh jobs" description="Refresh providers to generate job history." />
          ) : (
            <DataTable headers={['Provider', 'Status', 'Node Count', 'Updated At', 'Error']}>
              {data.recentRefreshes.map((job) => (
                <tr key={job.id} className="border-b border-line/60 text-sm text-text-muted hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-text">{job.providerName}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={job.status === 'success' ? 'success' : job.status === 'failed' ? 'danger' : 'warning'}>
                      {job.status}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3">{job.nodeCount ?? '-'}</td>
                  <td className="px-4 py-3">{formatDateTime(job.updatedAt)}</td>
                  <td className="px-4 py-3" title={job.errorMessage}>{truncate(job.errorMessage, 42)}</td>
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
                <tr key={log.id} className="border-b border-line/60 text-sm text-text-muted hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-text">{log.profileName}</td>
                  <td className="px-4 py-3">{log.outputFormat}</td>
                  <td className="px-4 py-3 font-mono text-xs">{log.ipAddress || '-'}</td>
                  <td className="px-4 py-3">{log.statusCode ?? '-'}</td>
                  <td className="px-4 py-3">{formatDateTime(log.accessedAt)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card className="p-4">
          <h3 className="mb-3 text-base font-semibold text-text">Top Profiles</h3>
          {data.topProfiles.length === 0 ? (
            <EmptyState title="No profile usage yet" description="Profile access activity will appear after subscriptions are consumed." />
          ) : (
            <DataTable headers={['Profile', 'Access Count', 'Last Accessed']}>
              {data.topProfiles.map((profile) => (
                <tr key={profile.id} className="border-b border-line/60 text-sm text-text-muted hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-text">{profile.name}</td>
                  <td className="px-4 py-3">{profile.access_count}</td>
                  <td className="px-4 py-3">{formatDateTime(profile.last_accessed_at)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>
    </div>
  );
}
