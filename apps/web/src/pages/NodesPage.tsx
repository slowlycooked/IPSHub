import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { nodesApi } from '@/api/nodes';
import { providersApi } from '@/api/providers';
import { queryClient } from '@/api/queryClient';
import type { NodeItem } from '@/types/node';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime } from '@/utils/format';

export function NodesPage() {
  const { pushToast } = useToast();
  const [keyword, setKeyword] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [protocolFilter, setProtocolFilter] = useState('all');
  const [enabledFilter, setEnabledFilter] = useState('all');

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

  if (isLoading) {
    return <LoadingState label="Loading nodes..." />;
  }

  if (isError) {
    return <ErrorState message="Failed to load nodes." onRetry={() => refetch()} />;
  }

  return (
    <div>
      <PageHeader title="Nodes" description="Search, filter and toggle node availability." />

      <Card className="mb-4 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            className="ip-input"
            placeholder="Search node name"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <select
            className="ip-input"
            value={providerFilter}
            onChange={(event) => setProviderFilter(event.target.value)}
          >
            <option value="all">All providers</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
          <select
            className="ip-input"
            value={protocolFilter}
            onChange={(event) => setProtocolFilter(event.target.value)}
          >
            <option value="all">All protocols</option>
            {[...new Set(nodes.map((node) => node.protocol))].map((protocol) => (
              <option key={protocol} value={protocol}>
                {protocol}
              </option>
            ))}
          </select>
          <select
            className="ip-input"
            value={enabledFilter}
            onChange={(event) => setEnabledFilter(event.target.value)}
          >
            <option value="all">All status</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState title="No nodes" description="No nodes found with current filters." />
      ) : (
        <Card>
          <DataTable
            headers={['Name', 'Provider', 'Protocol', 'Server', 'Port', 'Tag', 'Status', 'Updated At', 'Actions']}
          >
            {filtered.map((node) => (
              <tr key={node.id} className="border-b border-line/60 text-sm text-text-muted hover:bg-white/[0.03]">
                <td className="px-4 py-3 text-text">{node.name}</td>
                <td className="px-4 py-3">{providerNameMap.get(node.providerId) || node.providerId}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone="primary">{node.protocol}</StatusBadge>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{node.server}</td>
                <td className="px-4 py-3">{node.port}</td>
                <td className="px-4 py-3">{node.tag || '-'}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone={node.enabled ? 'success' : 'neutral'}>
                    {node.enabled ? 'Enabled' : 'Disabled'}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3">{formatDateTime(node.updatedAt)}</td>
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
