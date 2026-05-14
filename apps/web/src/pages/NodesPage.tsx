import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { nodesApi } from '@/api/nodes';
import { providersApi } from '@/api/providers';
import { queryClient } from '@/api/queryClient';
import type { NodeConnectivityProbeResult, NodeConnectivityResult, NodeItem } from '@/types/node';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime } from '@/utils/format';

export function NodesPage() {
  const { pushToast } = useToast();
  const [keyword, setKeyword] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [protocolFilter, setProtocolFilter] = useState('all');
  const [enabledFilter, setEnabledFilter] = useState('all');
  const [connectivityMap, setConnectivityMap] = useState<Record<string, NodeConnectivityResult>>({});

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['nodes'],
    queryFn: async () => {
      try {
        return await nodesApi.list();
      } catch {
        return { nodes: [] };
      }
    },
  });

  const { data: providerData } = useQuery({
    queryKey: ['providers', 'options'],
    queryFn: async () => {
      try {
        return await providersApi.list();
      } catch {
        return { providers: [] };
      }
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      enabled ? nodesApi.disable(id) : nodesApi.enable(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      pushToast('Node status updated', 'success');
    },
  });

  const testLatencyMutation = useMutation({
    mutationFn: () => nodesApi.testLatency(),
    onSuccess: (payload) => {
      const map = payload.results.reduce<Record<string, NodeConnectivityResult>>((acc, item) => {
        acc[item.nodeId] = item;
        return acc;
      }, {});
      setConnectivityMap(map);
      pushToast(`Latency test completed for ${payload.total} nodes`, 'success');
    },
    onError: () => {
      pushToast('Latency test failed', 'error');
    },
  });

  const providers = providerData?.providers || [];
  const nodes = (data?.nodes || []) as NodeItem[];
  const providerNameMap = new Map(providers.map((provider) => [provider.id, provider.name]));

  const filtered = useMemo(() => {
    return nodes.filter((node) => {
      const matchedKeyword = node.name.toLowerCase().includes(keyword.toLowerCase());
      const matchedProvider =
        providerFilter === 'all' || node.providerId === providerFilter;
      const matchedProtocol = protocolFilter === 'all' || node.protocol === protocolFilter;
      const matchedEnabled =
        enabledFilter === 'all' ||
        (enabledFilter === 'enabled' && node.enabled) ||
        (enabledFilter === 'disabled' && !node.enabled);

      return matchedKeyword && matchedProvider && matchedProtocol && matchedEnabled;
    });
  }, [nodes, keyword, providerFilter, protocolFilter, enabledFilter]);

  const protocols = useMemo(() => [...new Set(nodes.map((n) => n.protocol))], [nodes]);

  const stats = useMemo(() => ({
    total: nodes.length,
    enabled: nodes.filter(n => n.enabled).length,
    disabled: nodes.filter(n => !n.enabled).length,
    protocols: protocols.length,
  }), [nodes, protocols]);

  const renderProbe = (probe?: NodeConnectivityProbeResult) => {
    if (!probe) {
      return <span className="text-xs text-text-muted">-</span>;
    }

    if (probe.ok) {
      return (
        <StatusBadge tone="success">
          {probe.latencyMs !== null ? `${probe.latencyMs} ms` : 'OK'}
        </StatusBadge>
      );
    }

    return (
      <span title={probe.error || 'Probe failed'}>
        <StatusBadge tone="danger">Fail</StatusBadge>
      </span>
    );
  };

  if (isLoading) {
    return <LoadingState label="Loading nodes..." />;
  }

  if (isError) {
    return <ErrorState message="Failed to load nodes." onRetry={() => refetch()} />;
  }

  return (
    <div>
      <PageHeader 
        title="Nodes" 
        description="View and manage proxy nodes imported from providers."
        actions={(
          <Button
            variant="primary"
            onClick={() => testLatencyMutation.mutate()}
            isLoading={testLatencyMutation.isPending}
          >
            Test TCP/HTTP Latency
          </Button>
        )}
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Nodes" value={stats.total} hint="All nodes" status="primary" />
        <StatCard label="Enabled" value={stats.enabled} hint="Active nodes" status="success" />
        <StatCard label="Disabled" value={stats.disabled} hint="Inactive nodes" status={stats.disabled > 0 ? 'warning' : 'neutral'} />
        <StatCard label="Protocols" value={stats.protocols} hint="Unique types" status="primary" />
      </div>

      {/* Filter Bar */}
      <Card className="mt-6 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className="ip-input"
            placeholder="Search node name..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <select
            className="ip-input"
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
          >
            <option value="all">All Providers</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
          <select
            className="ip-input"
            value={protocolFilter}
            onChange={(e) => setProtocolFilter(e.target.value)}
          >
            <option value="all">All Protocols</option>
            {protocols.map((protocol) => (
              <option key={protocol} value={protocol}>
                {protocol}
              </option>
            ))}
          </select>
          <select
            className="ip-input"
            value={enabledFilter}
            onChange={(e) => setEnabledFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="enabled">Enabled Only</option>
            <option value="disabled">Disabled Only</option>
          </select>
        </div>
      </Card>

      {/* Nodes Table */}
      {filtered.length === 0 ? (
        <Card className="mt-6">
          <div className="p-8">
            <EmptyState 
              title={nodes.length === 0 ? "No nodes yet" : "No results found"}
              description={nodes.length === 0 ? "Import nodes by refreshing providers." : "Try adjusting your filters."}
            />
          </div>
        </Card>
      ) : (
        <Card className="mt-6">
          <DataTable
            headers={['Node', 'Provider', 'Protocol', 'Endpoint', 'TCP', 'HTTP', 'Tag', 'Status', 'Updated', 'Actions']}
          >
            {filtered.map((node) => (
              <tr key={node.id} className="border-b border-line text-sm text-text-muted hover:bg-surface-1">
                <td className="px-4 py-3 font-medium text-text">{node.name}</td>
                <td className="px-4 py-3 text-xs">{providerNameMap.get(node.providerId) || node.providerId}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone="primary">{node.protocol}</StatusBadge>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-primary">
                  {node.server}:{node.port}
                </td>
                <td className="px-4 py-3 text-xs">{renderProbe(connectivityMap[node.id]?.tcp)}</td>
                <td className="px-4 py-3 text-xs">{renderProbe(connectivityMap[node.id]?.http)}</td>
                <td className="px-4 py-3 text-xs max-w-xs truncate">{node.tag || '-'}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone={node.enabled ? 'success' : 'neutral'}>
                    {node.enabled ? 'Enabled' : 'Disabled'}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3 text-xs">{formatDateTime(node.updatedAt)}</td>
                <td className="px-4 py-3">
                  <Button
                    variant={node.enabled ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={() => toggleMutation.mutate({ id: node.id, enabled: node.enabled })}
                    isLoading={
                      toggleMutation.isPending &&
                      toggleMutation.variables?.id === node.id &&
                      toggleMutation.variables?.enabled === node.enabled
                    }
                  >
                    {node.enabled ? 'Disable' : 'Enable'}
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      )}
    </div>
  );
}
