import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { profilesApi, type ProfilePayload } from '@/api/profiles';
import { queryClient } from '@/api/queryClient';
import type { OutputType, Profile, ProfileUrls } from '@/types/profile';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CopyButton } from '@/components/ui/CopyButton';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, truncate } from '@/utils/format';

interface FormState {
  name: string;
  description: string;
  output_format: OutputType;
  include_protocols: string;
  exclude_keywords: string;
}

interface IssuedTokenState {
  name: string;
  token: string;
}

const defaultForm: FormState = {
  name: '',
  description: '',
  output_format: 'clash',
  include_protocols: '',
  exclude_keywords: '过期,剩余,Traffic,Expire',
};

function splitCsv(value: string): string[] | undefined {
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : undefined;
}

function toPayload(form: FormState): ProfilePayload {
  return {
    name: form.name,
    description: form.description || undefined,
    output_format: form.output_format,
    include_protocols: splitCsv(form.include_protocols),
    exclude_keywords: splitCsv(form.exclude_keywords),
  };
}

function buildProfileUrls(name: string, token: string): ProfileUrls {
  const origin = window.location.origin;
  const encodedName = encodeURIComponent(name);

  return {
    clash: `${origin}/sub/clash/${encodedName}?token=${token}`,
    loon: `${origin}/sub/loon/${encodedName}?token=${token}`,
    raw: `${origin}/sub/raw/${encodedName}?token=${token}`,
    provider: `${origin}/sub/provider/${encodedName}?token=${token}`,
  };
}

export function ProfilesPage() {
  const { pushToast } = useToast();
  const [selected, setSelected] = useState<Profile | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [regenerateTarget, setRegenerateTarget] = useState<Profile | null>(null);
  const [issuedToken, setIssuedToken] = useState<IssuedTokenState | null>(null);
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      pushToast('Profile created', 'success');
      setOpenForm(false);

      if (data.profile.token) {
        setIssuedToken({ name: data.profile.name, token: data.profile.token });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ProfilePayload> }) =>
      profilesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      pushToast('Profile updated', 'success');
      setOpenForm(false);
      setSelected(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => profilesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      pushToast('Profile deleted', 'success');
      setDeleteTarget(null);
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: (id: string) => profilesApi.regenerateToken(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      pushToast('Token regenerated', 'success');
      setRegenerateTarget(null);

      if (data.profile.token) {
        setIssuedToken({ name: data.profile.name, token: data.profile.token });
      }
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
      output_format: profile.output_format,
      include_protocols: profile.include_protocols?.join(', ') || '',
      exclude_keywords: profile.exclude_keywords?.join(', ') || '',
    });
    setOpenForm(true);
  };

  const saveForm = () => {
    if (!form.name.trim()) {
      pushToast('Profile name is required', 'error');
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

  const issuedUrls = issuedToken ? buildProfileUrls(issuedToken.name, issuedToken.token) : null;

  return (
    <div>
      <PageHeader
        title="Profiles"
        description="Manage output profiles, filtering rules and token-based subscription endpoints."
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
            headers={['Name', 'Output', 'Protocols', 'Exclude Keywords', 'Access Count', 'Updated At', 'Actions']}
          >
            {profiles.map((profile) => (
              <tr key={profile.id} className="border-b border-line/60 text-sm text-text-muted hover:bg-white/[0.03]">
                <td className="px-4 py-3">
                  <div>
                    <div className="font-medium text-text">{profile.name}</div>
                    <div className="mt-1 text-xs text-text-dim">{truncate(profile.description, 46)}</div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge tone="primary">{profile.output_format}</StatusBadge>
                </td>
                <td className="max-w-[180px] px-4 py-3" title={profile.include_protocols?.join(', ') || ''}>
                  {truncate(profile.include_protocols?.join(', '), 32)}
                </td>
                <td className="max-w-[220px] px-4 py-3" title={profile.exclude_keywords?.join(', ') || ''}>
                  {truncate(profile.exclude_keywords?.join(', '), 40)}
                </td>
                <td className="px-4 py-3">{profile.access_count}</td>
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
            ))}
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
            <label className="mb-1 block text-sm text-text-muted">Name</label>
            <input
              className="ip-input"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-text-muted">Description</label>
            <input
              className="ip-input"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-text-muted">Output Format</label>
            <select
              className="ip-input"
              value={form.output_format}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, output_format: event.target.value as OutputType }))
              }
            >
              <option value="clash">clash</option>
              <option value="clash_provider">clash_provider</option>
              <option value="loon">loon</option>
              <option value="raw">raw</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-text-muted">Include Protocols</label>
            <input
              className="ip-input"
              placeholder="ss, vmess, trojan"
              value={form.include_protocols}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, include_protocols: event.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-text-muted">Exclude Keywords</label>
            <input
              className="ip-input"
              placeholder="过期, 剩余, Traffic"
              value={form.exclude_keywords}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, exclude_keywords: event.target.value }))
              }
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(issuedToken && issuedUrls)}
        title="Issued Subscription Token"
        onClose={() => setIssuedToken(null)}
        widthClassName="max-w-3xl"
      >
        {issuedToken && issuedUrls ? (
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              This token is only shown when it is created or regenerated. Copy the URLs you need now.
            </p>
            <div className="rounded-2xl border border-line bg-black/20 p-4">
              <div className="flex items-center gap-2 text-sm text-text">
                <span className="font-medium">Token</span>
                <span className="font-mono text-xs text-text-muted">{issuedToken.token}</span>
                <CopyButton text={issuedToken.token} />
              </div>
            </div>
            {Object.entries(issuedUrls).map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-line bg-black/20 p-4">
                <div className="flex items-center gap-2">
                  <span className="w-[80px] text-sm font-medium capitalize text-text">{key}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-muted" title={value}>
                    {value}
                  </span>
                  <CopyButton text={value} />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Profile"
        description={`Delete ${deleteTarget?.name || 'this profile'}? Existing subscription links will stop working.`}
        confirmText="Delete"
        danger
        loading={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />

      <ConfirmDialog
        open={Boolean(regenerateTarget)}
        title="Regenerate Token"
        description={`Regenerate the token for ${regenerateTarget?.name || 'this profile'}? Existing URLs will become invalid immediately.`}
        confirmText="Regenerate"
        loading={regenerateMutation.isPending}
        onCancel={() => setRegenerateTarget(null)}
        onConfirm={() => regenerateTarget && regenerateMutation.mutate(regenerateTarget.id)}
      />
    </div>
  );
}
