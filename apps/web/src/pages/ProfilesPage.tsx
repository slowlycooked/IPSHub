import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { profilesApi, type ProfilePayload } from '@/api/profiles';
import { queryClient } from '@/api/queryClient';
import type { Profile, ProfileUrls } from '@/types/profile';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CopyButton } from '@/components/ui/CopyButton';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { JsonTextarea } from '@/components/ui/JsonTextarea';
import { LoadingState } from '@/components/ui/LoadingState';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, truncate } from '@/utils/format';

const defaultFilterJson = JSON.stringify(
  {
    includeProviders: [],
    excludeProviders: [],
    includeNameRegex: [],
    excludeNameRegex: ['过期', '剩余', 'Traffic', 'Expire'],
    includeProtocols: [],
    excludeProtocols: [],
    onlyEnabled: true,
  },
  null,
  2
);

interface FormState {
  name: string;
  description: string;
  enabled: boolean;
  output_type: 'clash' | 'mihomo' | 'loon' | 'raw';
  rename_template: string;
  filter_json: string;
}

const defaultForm: FormState = {
  name: '',
  description: '',
  enabled: true,
  output_type: 'clash',
  rename_template: '',
  filter_json: defaultFilterJson,
};

function profileUrls(profile: Profile): ProfileUrls {
  const token = profile.token || profile.id;
  const origin = window.location.origin;
  return {
    clash: `${origin}/subscribe/clash/${token}`,
    loon: `${origin}/subscribe/loon/${token}`,
    raw: `${origin}/subscribe/raw/${token}`,
    provider: `${origin}/subscribe/provider/${token}`,
  };
}

function toPayload(form: FormState): ProfilePayload {
  return {
    name: form.name,
    description: form.description || undefined,
    enabled: form.enabled,
    output_type: form.output_type,
    rename_template: form.rename_template || undefined,
    filter_json: form.filter_json,
  };
}

export function ProfilesPage() {
  const { pushToast } = useToast();
  const [selected, setSelected] = useState<Profile | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [regenerateTarget, setRegenerateTarget] = useState<Profile | null>(null);
  const [jsonValid, setJsonValid] = useState(true);
  const [form, setForm] = useState<FormState>(defaultForm);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      try {
        return await profilesApi.list();
      } catch {
        return { profiles: [] };
      }
    },
  });

  const profiles = useMemo(() => data?.profiles || [], [data]);

  const createMutation = useMutation({
    mutationFn: (payload: ProfilePayload) => profilesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      pushToast('Profile created', 'success');
      setOpenForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ProfilePayload> }) =>
      profilesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      pushToast('Profile updated', 'success');
      setOpenForm(false);
      setSelected(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => profilesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      pushToast('Profile deleted', 'success');
      setDeleteTarget(null);
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: (id: string) => profilesApi.regenerateToken(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      pushToast('Token regenerated', 'success');
      setRegenerateTarget(null);
    },
  });

  const openCreate = () => {
    setSelected(null);
    setForm(defaultForm);
    setOpenForm(true);
  };

  const openEdit = (profile: Profile) => {
    setSelected(profile);
    setForm({
      name: profile.name,
      description: profile.description || '',
      enabled: profile.enabled,
      output_type: profile.output_type,
      rename_template: profile.rename_template || '',
      filter_json: profile.filter_json || defaultFilterJson,
    });
    setOpenForm(true);
  };

  const saveForm = () => {
    if (!form.name.trim()) {
      pushToast('Profile name is required', 'error');
      return;
    }
    if (!jsonValid) {
      pushToast('Please fix JSON format', 'error');
      return;
    }
    if (selected) {
      updateMutation.mutate({ id: selected.id, payload: toPayload(form) });
      return;
    }
    createMutation.mutate(toPayload(form));
  };

  if (isLoading) {
    return <LoadingState label="Loading profiles..." />;
  }

  if (isError) {
    return <ErrorState message="Failed to load profiles." onRetry={() => refetch()} />;
  }

  return (
    <div>
      <PageHeader
        title="Profiles"
        description="Manage output profiles and subscription URLs."
        actions={
          <Button variant="primary" onClick={openCreate}>
            Add Profile
          </Button>
        }
      />

      {profiles.length === 0 ? (
        <EmptyState title="No profiles" description="Create your first profile to generate subscription URLs." />
      ) : (
        <Card>
          <DataTable
            headers={[
              'Name',
              'Output Type',
              'Enabled',
              'Filter Summary',
              'Subscription URLs',
              'Updated At',
              'Actions',
            ]}
          >
            {profiles.map((profile) => {
              const urls = profileUrls(profile);
              return (
                <tr key={profile.id} className="border-b border-slate-100 text-sm hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-text">{profile.name}</td>
                  <td className="px-4 py-3">{profile.output_type}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={profile.enabled ? 'success' : 'neutral'}>
                      {profile.enabled ? 'Enabled' : 'Disabled'}
                    </StatusBadge>
                  </td>
                  <td className="max-w-[180px] px-4 py-3" title={profile.filter_json || ''}>
                    {truncate(profile.filter_json || '', 36)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-[56px] text-slate-500">Clash</span>
                        <span className="max-w-[180px] truncate font-mono" title={urls.clash}>{urls.clash}</span>
                        <CopyButton text={urls.clash} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-[56px] text-slate-500">Loon</span>
                        <span className="max-w-[180px] truncate font-mono" title={urls.loon}>{urls.loon}</span>
                        <CopyButton text={urls.loon} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-[56px] text-slate-500">Raw</span>
                        <span className="max-w-[180px] truncate font-mono" title={urls.raw}>{urls.raw}</span>
                        <CopyButton text={urls.raw} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-[56px] text-slate-500">Provider</span>
                        <span className="max-w-[180px] truncate font-mono" title={urls.provider}>{urls.provider}</span>
                        <CopyButton text={urls.provider} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{formatDateTime(profile.updated_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={() => openEdit(profile)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setRegenerateTarget(profile)}>
                        Regenerate Token
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setDeleteTarget(profile)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </DataTable>
        </Card>
      )}

      <Modal
        open={openForm}
        title={selected ? 'Edit Profile' : 'Add Profile'}
        onClose={() => setOpenForm(false)}
        widthClassName="max-w-2xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenForm(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              isLoading={createMutation.isPending || updateMutation.isPending}
              onClick={saveForm}
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
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-700">Description</label>
            <input
              className="ip-input"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Output Type</label>
            <select
              className="ip-input"
              value={form.output_type}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  output_type: event.target.value as FormState['output_type'],
                }))
              }
            >
              <option value="clash">clash</option>
              <option value="mihomo">mihomo</option>
              <option value="loon">loon</option>
              <option value="raw">raw</option>
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
            <label className="mb-1 block text-sm text-slate-700">Rename Template</label>
            <input
              className="ip-input"
              value={form.rename_template}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, rename_template: event.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-700">Filter JSON</label>
            <JsonTextarea
              value={form.filter_json}
              onChange={(value) => setForm((prev) => ({ ...prev, filter_json: value }))}
              onValidityChange={setJsonValid}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(regenerateTarget)}
        title="Regenerate Token"
        description="This action rotates subscription token and invalidates old URLs. Continue?"
        confirmText="Regenerate"
        loading={regenerateMutation.isPending}
        onConfirm={() => {
          if (regenerateTarget) {
            regenerateMutation.mutate(regenerateTarget.id);
          }
        }}
        onCancel={() => setRegenerateTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Profile"
        description="This action cannot be undone. Delete this profile?"
        confirmText="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
