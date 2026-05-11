import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { providersApi } from '@/api/providers';
import { queryClient } from '@/api/queryClient';
import type { Provider, ProviderInput, ProviderType } from '@/types/provider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, truncate } from '@/utils/format';

interface ProviderFormState {
  name: string;
  type: ProviderType;
  subscription_url: string;
  enabled: boolean;
  refresh_interval_minutes: number;
  timeout_seconds: number;
  user_agent: string;
  request_headers_json: string;
  provider_prefix: string;
}

const defaultForm: ProviderFormState = {
  name: '',
  type: 'auto',
  subscription_url: '',
  enabled: true,
  refresh_interval_minutes: 360,
  timeout_seconds: 30,
  user_agent: '',
  request_headers_json: '{}',
  provider_prefix: '',
};

function toPayload(form: ProviderFormState, editing: boolean): ProviderInput {
  return {
    name: form.name,
    type: form.type,
    subscription_url: editing ? undefined : form.subscription_url,
    enabled: form.enabled,
    refresh_interval_minutes: Number(form.refresh_interval_minutes),
    timeout_seconds: Number(form.timeout_seconds),
    user_agent: form.user_agent || undefined,
    request_headers_json: form.request_headers_json || undefined,
    provider_prefix: form.provider_prefix || undefined,
  };
}

export function ProvidersPage() {
  const { pushToast } = useToast();
  const [openForm, setOpenForm] = useState(false);
  const [selected, setSelected] = useState<Provider | null>(null);
  const [deleting, setDeleting] = useState<Provider | null>(null);
  const [errorModal, setErrorModal] = useState('');
  const [form, setForm] = useState<ProviderFormState>(defaultForm);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['providers'],
    queryFn: () => providersApi.list(),
  });

  const providers = useMemo(() => data?.providers || [], [data]);

  const createMutation = useMutation({
    mutationFn: (payload: ProviderInput) => providersApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      pushToast('Provider created', 'success');
      setOpenForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ProviderInput> }) =>
      providersApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      pushToast('Provider updated', 'success');
      setOpenForm(false);
      setSelected(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => providersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      pushToast('Provider deleted', 'success');
      setDeleting(null);
    },
  });

  const refreshMutation = useMutation({
    mutationFn: (id: string) => providersApi.refreshNow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      pushToast('Refresh task submitted', 'success');
    },
  });

  const openCreate = () => {
    setSelected(null);
    setForm(defaultForm);
    setOpenForm(true);
  };

  const openEdit = (provider: Provider) => {
    setSelected(provider);
    setForm({
      name: provider.name,
      type: provider.type,
      subscription_url: provider.maskedUrl || '',
      enabled: provider.enabled,
      refresh_interval_minutes: provider.refresh_interval_minutes,
      timeout_seconds: provider.timeout_seconds,
      user_agent: provider.user_agent || '',
      request_headers_json: provider.request_headers_json || '{}',
      provider_prefix: provider.provider_prefix || '',
    });
    setOpenForm(true);
  };

  const submitForm = () => {
    if (!form.name.trim()) {
      pushToast('Provider name is required', 'error');
      return;
    }

    if (!selected && !form.subscription_url.trim()) {
      pushToast('Subscription URL is required', 'error');
      return;
    }

    if (selected) {
      updateMutation.mutate({ id: selected.id, payload: toPayload(form, true) });
      return;
    }

    createMutation.mutate(toPayload(form, false));
  };

  if (isLoading) {
    return <LoadingState label="Loading providers..." />;
  }

  if (isError) {
    return <ErrorState message="Failed to load providers." onRetry={() => refetch()} />;
  }

  return (
    <div>
      <PageHeader
        title="Providers"
        description="Manage subscription providers and refresh tasks."
        actions={
          <Button variant="primary" onClick={openCreate}>
            Add Provider
          </Button>
        }
      />

      {providers.length === 0 ? (
        <EmptyState
          title="No providers yet"
          description="No providers yet. Add your first subscription provider."
        />
      ) : (
        <Card>
          <DataTable
            headers={[
              'Name',
              'Type',
              'Status',
              'Refresh Interval',
              'Last Refresh',
              'Last Node Count',
              'Last Error',
              'Actions',
            ]}
          >
            {providers.map((provider) => (
              <tr key={provider.id} className="border-b border-slate-100 text-sm hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-text">{provider.name}</td>
                <td className="px-4 py-3">{provider.type}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone={provider.enabled ? 'success' : 'neutral'}>
                    {provider.enabled ? 'Enabled' : 'Disabled'}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3">{provider.refresh_interval_minutes}m</td>
                <td className="px-4 py-3">{formatDateTime(provider.last_refresh_at)}</td>
                <td className="px-4 py-3">{provider.last_node_count}</td>
                <td className="max-w-[180px] px-4 py-3" title={provider.last_error || ''}>
                  {provider.last_error ? (
                    <button
                      type="button"
                      className="w-full truncate text-left text-danger"
                      onClick={() => setErrorModal(provider.last_error || '')}
                    >
                      {truncate(provider.last_error, 28)}
                    </button>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => openEdit(provider)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => refreshMutation.mutate(provider.id)}
                      isLoading={refreshMutation.isPending && refreshMutation.variables === provider.id}
                    >
                      Refresh Now
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setDeleting(provider)}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      )}

      <Modal
        open={openForm}
        onClose={() => setOpenForm(false)}
        title={selected ? 'Edit Provider' : 'Add Provider'}
        widthClassName="max-w-2xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenForm(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              isLoading={createMutation.isPending || updateMutation.isPending}
              onClick={submitForm}
            >
              Save
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-700">Name</label>
            <input
              className="ip-input"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Type</label>
            <select
              className="ip-input"
              value={form.type}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, type: event.target.value as ProviderType }))
              }
            >
              <option value="auto">auto</option>
              <option value="clash">clash</option>
              <option value="base64-uri">base64-uri</option>
              <option value="uri-list">uri-list</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Enabled</label>
            <select
              className="ip-input"
              value={form.enabled ? 'true' : 'false'}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, enabled: event.target.value === 'true' }))
              }
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-700">Subscription URL</label>
            <input
              className="ip-input"
              value={form.subscription_url}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, subscription_url: event.target.value }))
              }
              disabled={Boolean(selected)}
              placeholder={selected ? 'Masked URL from backend' : 'https://provider.example/subscription'}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Refresh Interval Minutes</label>
            <input
              type="number"
              className="ip-input"
              value={form.refresh_interval_minutes}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, refresh_interval_minutes: Number(event.target.value) }))
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Timeout Seconds</label>
            <input
              type="number"
              className="ip-input"
              value={form.timeout_seconds}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, timeout_seconds: Number(event.target.value) }))
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">User Agent</label>
            <input
              className="ip-input"
              value={form.user_agent}
              onChange={(event) => setForm((prev) => ({ ...prev, user_agent: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Provider Prefix</label>
            <input
              className="ip-input"
              value={form.provider_prefix}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, provider_prefix: event.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-700">Request Headers JSON</label>
            <textarea
              className="min-h-[90px] w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
              value={form.request_headers_json}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, request_headers_json: event.target.value }))
              }
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete Provider"
        description="This action removes provider and related nodes. Continue?"
        confirmText="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleting) {
            deleteMutation.mutate(deleting.id);
          }
        }}
        onCancel={() => setDeleting(null)}
      />

      <Modal
        open={Boolean(errorModal)}
        title="Last Error"
        onClose={() => setErrorModal('')}
        widthClassName="max-w-xl"
      >
        <pre className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-700">{errorModal}</pre>
      </Modal>
    </div>
  );
}
