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
  const hasErrors = data.recentRefreshes?.some(job => job.status === 'failed');

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="System health overview and recent subscription aggregation activities."
      />

      {/* System Status Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard 
          label="System Health" 
          value={hasErrors ? 'Warning' : 'Healthy'} 
          status={hasErrors ? 'warning' : 'success'}
          hint={`${stats.enabledProviders} / ${stats.totalProviders} providers active`}
        />
        <StatCard 
          label="Providers" 
          value={stats.totalProviders} 
          hint={`${stats.enabledProviders} enabled`}
          status="primary"
          onClick={() => navigate('/providers')} 
        />
        <StatCard 
          label="Nodes" 
          value={stats.totalNodes} 
          hint={`${stats.enabledNodes} enabled`}
          status="primary"
          onClick={() => navigate('/nodes')} 
        />
        <StatCard 
          label="Profiles" 
          value={stats.totalProfiles} 
          hint="Active profiles"
          status="primary"
          onClick={() => navigate('/profiles')} 
        />
        <StatCard 
          label="Last Refresh" 
          value={stats.latestRefreshAt ? new Date(stats.latestRefreshAt).toLocaleTimeString() : 'Never'} 
          hint={stats.latestRefreshAt ? formatDateTime(stats.latestRefreshAt).split(' at ')[0] : 'No refresh yet'}
          status="neutral"
        />
      </div>

      {/* Subscription Pipeline */}
      <Card className="mt-8 p-6">
        <h3 className="font-display text-lg font-semibold text-primary mb-6">Subscription Pipeline</h3>
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-4">
          {[
            { label: 'Providers', icon: '📥' },
            { label: 'Fetch', icon: '⬇️' },
            { label: 'Parse', icon: '🔍' },
            { label: 'Merge', icon: '🔀' },
            { label: 'Render', icon: '📄' },
            { label: 'Client Access', icon: '✅' },
          ].map((stage, idx) => (
            <div key={idx} className="flex flex-col items-center gap-2 whitespace-nowrap">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-primary to-primary-dark text-lg">
                {stage.icon}
              </div>
              <p className="text-xs font-medium text-text-muted">{stage.label}</p>
              {idx < 5 && (
                <div className="absolute left-[calc(50%+2rem)] w-8 h-0.5 bg-gradient-to-r from-primary/50 to-transparent"></div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Main Content Grid */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Refresh Jobs */}
        <Card>
          <div className="border-b border-line px-6 py-4">
            <h3 className="font-display text-base font-semibold text-primary">Recent Refresh Jobs</h3>
          </div>
          <div className="overflow-hidden">
            {data.recentRefreshes.length === 0 ? (
              <div className="p-6">
                <EmptyState 
                  title="No refresh jobs" 
                  description="Refresh providers to generate job history."
                  action={{ label: 'Go to Providers', onClick: () => navigate('/providers') }}
                />
              </div>
            ) : (
              <DataTable headers={['Provider', 'Status', 'Nodes', 'Time', 'Message']}>
                {data.recentRefreshes.map((job) => (
                  <tr key={job.id} className="border-b border-line text-sm text-text-muted hover:bg-surface-1">
                    <td className="px-4 py-3 text-text font-medium">{job.providerName}</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={job.status === 'success' ? 'success' : job.status === 'failed' ? 'danger' : 'warning'}>
                        {job.status}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">{job.nodeCount ?? '-'}</td>
                    <td className="px-4 py-3 text-xs">{formatDateTime(job.updatedAt)}</td>
                    <td className="px-4 py-3 text-xs" title={job.errorMessage}>{truncate(job.errorMessage, 30)}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </div>
        </Card>

        {/* Recent Access Logs */}
        <Card>
          <div className="border-b border-line px-6 py-4">
            <h3 className="font-display text-base font-semibold text-primary">Recent Access Logs</h3>
          </div>
          <div className="overflow-hidden">
            {data.recentAccessLogs.length === 0 ? (
              <div className="p-6">
                <EmptyState 
                  title="No access logs" 
                  description="Subscription accesses will show up here."
                />
              </div>
            ) : (
              <DataTable headers={['Profile', 'Format', 'Client IP', 'Code', 'Time']}>
                {data.recentAccessLogs.map((log) => (
                  <tr key={log.id} className="border-b border-line text-sm text-text-muted hover:bg-surface-1">
                    <td className="px-4 py-3 text-text font-medium">{log.profileName}</td>
                    <td className="px-4 py-3 text-xs">{log.outputFormat}</td>
                    <td className="px-4 py-3 font-mono text-xs text-primary">{log.ipAddress || '-'}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`font-medium ${log.statusCode === 200 ? 'text-success' : 'text-warning'}`}>
                        {log.statusCode ?? '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{formatDateTime(log.accessedAt)}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </div>
        </Card>
      </div>

      {/* Top Profiles */}
      <Card className="mt-6">
        <div className="border-b border-line px-6 py-4">
          <h3 className="font-display text-base font-semibold text-primary">Top Profiles by Access</h3>
        </div>
        <div className="overflow-hidden">
          {data.topProfiles.length === 0 ? (
            <div className="p-6">
              <EmptyState 
                title="No profile usage yet" 
                description="Profile access activity will appear after subscriptions are consumed."
                action={{ label: 'Create Profile', onClick: () => navigate('/profiles') }}
              />
            </div>
          ) : (
            <DataTable headers={['Profile', 'Access Count', 'Last Accessed']}>
              {data.topProfiles.map((profile) => (
                <tr key={profile.id} className="border-b border-line text-sm text-text-muted hover:bg-surface-1">
                  <td className="px-4 py-3 text-text font-medium">{profile.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold">
                      {profile.access_count} hits
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">{formatDateTime(profile.last_accessed_at)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </div>
      </Card>

      {/* Recent Errors (if any) */}
      {hasErrors && (
        <Card className="mt-6 border-danger/40 bg-danger/5">
          <div className="border-b border-danger/40 px-6 py-4">
            <h3 className="text-base font-semibold text-red-200">Recent Errors</h3>
          </div>
          <div className="px-6 py-4">
            <div className="space-y-2">
              {data.recentRefreshes
                .filter(job => job.status === 'failed' && job.errorMessage)
                .map((job, idx) => (
                  <div key={idx} className="flex gap-3 text-sm">
                    <span className="flex-shrink-0 text-danger">⚠️</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-text-muted"><strong>{job.providerName}</strong> refresh failed</p>
                      <p className="text-xs text-text-dim mt-1 truncate">{job.errorMessage}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
