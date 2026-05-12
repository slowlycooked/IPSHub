import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { profilesApi, type ProfilePayload } from '@/api/profiles';
import { fetchServerConfig } from '@/api/config';
import { queryClient } from '@/api/queryClient';
import type { OutputType, Profile, ProfileUrls } from '@/types/profile';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CopyButton } from '@/components/ui/CopyButton';
import { Drawer } from '@/components/ui/Drawer';
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
  output_format: OutputType;
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

declare const __BACKEND_ORIGIN__: string;

function buildProfileUrls(name: string, token: string, serverBaseUrl: string): ProfileUrls {
  // Priority: APP_BASE_URL from server config > dev backend origin > current origin
  let origin: string;
  if (serverBaseUrl) {
    origin = serverBaseUrl;
  } else if (import.meta.env.DEV) {
    origin = typeof __BACKEND_ORIGIN__ !== 'undefined' ? __BACKEND_ORIGIN__ : window.location.origin;
  } else {
    origin = window.location.origin;
  }
  const encodedName = encodeURIComponent(name);

  return {
    clash: `${origin}/sub/clash/${encodedName}?token=${token}`,
    loon: `${origin}/sub/loon/${encodedName}?token=${token}`,
    raw: `${origin}/sub/raw/${encodedName}?token=${token}`,
    provider: `${origin}/sub/provider/${encodedName}?token=${token}`,
  };
}

const URL_KEY_MAP: Record<OutputType, keyof ProfileUrls> = {
  clash: 'clash',
  clash_provider: 'provider',
  loon: 'loon',
  raw: 'raw',
};

const URL_LABELS: Record<keyof ProfileUrls, string> = {
  clash: 'Clash YAML',
  provider: 'Clash Provider',
  loon: 'Loon',
  raw: 'Raw (URI List)',
};

function hasUsableToken(token: string | undefined): token is string {
  return typeof token === 'string' && token.trim().length > 0;
}

export function ProfilesPage() {
  const { pushToast } = useToast();
  const [selected, setSelected] = useState<Profile | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [regenerateTarget, setRegenerateTarget] = useState<Profile | null>(null);
  const [issuedToken, setIssuedToken] = useState<IssuedTokenState | null>(null);
  const [urlsModal, setUrlsModal] = useState<Profile | null>(null);
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

  const { data: serverConfig } = useQuery({
    queryKey: ['server-config'],
    queryFn: fetchServerConfig,
    staleTime: Infinity,
  });

  const serverBaseUrl = serverConfig?.baseUrl ?? '';

  const profiles = useMemo(() => data?.profiles || [], [data]);

  const createMutation = useMutation({
    mutationFn: (payload: ProfilePayload) => profilesApi.create(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      pushToast('Profile created', 'success');
      setOpenForm(false);

      if (data.profile.token) {
        setIssuedToken({ name: data.profile.name, token: data.profile.token, output_format: data.profile.output_format });
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
        setIssuedToken({ name: data.profile.name, token: data.profile.token, output_format: data.profile.output_format });
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

  const issuedUrls = issuedToken ? buildProfileUrls(issuedToken.name, issuedToken.token, serverBaseUrl) : null;

  return (
    <div>
      <PageHeader
        title="Profiles"
        description="Manage output profiles and token-based subscription endpoints."
        actions={
          <Button variant="primary" onClick={openCreate}>
            + Add Profile
          </Button>
        }
      />

      {profiles.length === 0 ? (
        <Card className="mt-0">
          <div className="p-8">
            <EmptyState 
              title="No profiles yet"
              description="Create your first profile to generate subscription URLs."
              action={{ label: 'Create Profile', onClick: openCreate }}
            />
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <Card key={profile.id} className="flex flex-col p-5">
              {/* Header */}
              <div className="mb-4 pb-4 border-b border-line">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-display text-lg font-semibold text-primary flex-1 break-words">{profile.name}</h3>
                  <StatusBadge tone="primary">{profile.output_format}</StatusBadge>
                </div>
                {profile.description && (
                  <p className="text-sm text-text-dim">{truncate(profile.description, 80)}</p>
                )}
              </div>

              {/* Info */}
              <div className="space-y-3 mb-5 text-sm flex-1">
                {profile.include_protocols && (
                  <div>
                    <p className="text-xs font-medium text-text-muted mb-1">Protocols</p>
                    <p className="text-text">{profile.include_protocols.join(', ')}</p>
                  </div>
                )}
                {profile.exclude_keywords && profile.exclude_keywords.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-text-muted mb-1">Exclude Keywords</p>
                    <p className="text-text text-xs">{truncate(profile.exclude_keywords.join(', '), 60)}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="rounded border border-line bg-surface-1 p-2">
                    <p className="text-xs text-text-dim">Access Count</p>
                    <p className="text-lg font-semibold text-primary">{profile.access_count}</p>
                  </div>
                  <div className="rounded border border-line bg-surface-1 p-2">
                    <p className="text-xs text-text-dim">Updated</p>
                    <p className="text-xs text-text-muted">{formatDateTime(profile.updated_at).split(' ')[0]}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <Button 
                  variant="secondary" 
                  size="md"
                  className="w-full"
                  onClick={() => setUrlsModal(profile)}
                >
                  View URLs
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="w-full"
                    onClick={() => openEdit(profile)}
                  >
                    Edit
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="w-full"
                    onClick={() => setRegenerateTarget(profile)}
                    title="Regenerate token - WARNING: existing URLs will expire"
                  >
                    Regen Token
                  </Button>
                </div>
                <Button 
                  variant="danger" 
                  size="sm"
                  className="w-full"
                  onClick={() => setDeleteTarget(profile)}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Form Drawer */}
      <Drawer
        open={openForm}
        title={selected ? 'Edit Profile' : 'Add Profile'}
        onClose={() => setOpenForm(false)}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setOpenForm(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              isLoading={createMutation.isPending || updateMutation.isPending}
              onClick={saveForm}
            >
              Save Profile
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">Name</label>
            <input
              className="ip-input"
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Gaming, Work"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">Description</label>
            <input
              className="ip-input"
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Optional profile description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">Output Format</label>
            <select
              className="ip-input"
              value={form.output_format}
              onChange={(e) => setForm(prev => ({ ...prev, output_format: e.target.value as OutputType }))}
            >
              <option value="clash">Clash YAML</option>
              <option value="clash_provider">Clash Provider</option>
              <option value="loon">Loon</option>
              <option value="raw">Raw (Shadowsocks URI)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">Include Protocols</label>
            <input
              className="ip-input"
              placeholder="ss, vmess, trojan (comma-separated)"
              value={form.include_protocols}
              onChange={(e) => setForm(prev => ({ ...prev, include_protocols: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">Exclude Keywords</label>
            <input
              className="ip-input"
              placeholder="过期, 剩余, Traffic (comma-separated)"
              value={form.exclude_keywords}
              onChange={(e) => setForm(prev => ({ ...prev, exclude_keywords: e.target.value }))}
            />
          </div>
        </div>
      </Drawer>

      {/* URLs Modal */}
      <Modal
        open={Boolean(urlsModal)}
        title={urlsModal ? `${urlsModal.name} - Subscription URLs` : 'Subscription URLs'}
        onClose={() => setUrlsModal(null)}
        widthClassName="max-w-2xl"
      >
        {urlsModal && (() => {
          if (!hasUsableToken(urlsModal.token)) {
            return (
              <div className="space-y-4">
                <div className="bg-surface-1 border border-line rounded-lg p-4 text-sm text-text-muted">
                  Regenerate Token to view subscription URLs.
                </div>
              </div>
            );
          }

          const urls = buildProfileUrls(urlsModal.name, urlsModal.token, serverBaseUrl);
          const primaryKey = URL_KEY_MAP[urlsModal.output_format];
          const otherEntries = (Object.entries(urls) as [keyof ProfileUrls, string][]).filter(([k]) => k !== primaryKey);
          return (
            <div className="space-y-4">
              <div className="border-2 border-accent rounded-md p-4 bg-white">
                <p className="text-xs font-medium text-accent mb-2 uppercase tracking-wider">{URL_LABELS[primaryKey]} — Primary</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono text-primary break-all p-2 bg-surface-1 rounded border border-line">
                    {urls[primaryKey]}
                  </code>
                  <CopyButton text={urls[primaryKey]} label="Copy" />
                </div>
              </div>
              <details className="group">
                <summary className="cursor-pointer text-xs text-text-dim select-none list-none flex items-center gap-1">
                  <span className="group-open:hidden">▶</span><span className="hidden group-open:inline">▼</span> Other formats
                </summary>
                <div className="mt-3 space-y-3">
                  {otherEntries.map(([key, url]) => (
                    <div key={key} className="border border-line rounded-md p-3 bg-white">
                      <p className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">{URL_LABELS[key]}</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs font-mono text-primary break-all p-2 bg-surface-1 rounded border border-line">
                          {url}
                        </code>
                        <CopyButton text={url} label="Copy" />
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          );
        })()}
      </Modal>

      {/* Issued Token Modal */}
      <Modal
        open={Boolean(issuedToken && issuedUrls)}
        title="Profile Created - Save Your Token"
        onClose={() => setIssuedToken(null)}
        widthClassName="max-w-2xl"
      >
        {issuedToken && issuedUrls ? (
          <div className="space-y-4">
            <div className="bg-warning/10 border border-warning/30 text-warning rounded-md p-4 text-sm">
              This token is only shown once. Copy and save it securely now.
            </div>
            <div className="border border-line rounded-md p-4 bg-white">
              <p className="text-xs font-medium text-text-muted mb-2">Token</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono text-primary break-all p-2 bg-surface-1 rounded border border-line">
                  {issuedToken.token}
                </code>
                <CopyButton text={issuedToken.token} label="Copy" />
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-text">Subscription URLs</p>
              {(() => {
                const primaryKey = URL_KEY_MAP[issuedToken.output_format];
                const otherEntries = (Object.entries(issuedUrls) as [keyof ProfileUrls, string][]).filter(([k]) => k !== primaryKey);
                return (
                  <>
                    <div className="border-2 border-accent rounded-md p-3 bg-white">
                      <p className="text-xs font-medium text-accent mb-2 uppercase">{URL_LABELS[primaryKey]} — Primary</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs font-mono text-primary break-all p-1.5 bg-surface-1 rounded text-xs border border-line">
                          {issuedUrls[primaryKey]}
                        </code>
                        <CopyButton text={issuedUrls[primaryKey]} label="Copy" />
                      </div>
                    </div>
                    <details className="group">
                      <summary className="cursor-pointer text-xs text-text-dim select-none list-none flex items-center gap-1">
                        <span className="group-open:hidden">▶</span><span className="hidden group-open:inline">▼</span> Other formats
                      </summary>
                      <div className="mt-2 space-y-2">
                        {otherEntries.map(([key, url]) => (
                          <div key={key} className="border border-line rounded-md p-3 bg-white">
                            <p className="text-xs font-medium text-text-muted mb-2 uppercase">{URL_LABELS[key]}</p>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 text-xs font-mono text-primary break-all p-1.5 bg-surface-1 rounded text-xs border border-line">
                                {url}
                              </code>
                              <CopyButton text={url} label="Copy" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </>
                );
              })()}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Profile"
        description={`Delete "${deleteTarget?.name}"? All subscription links will stop working immediately.`}
        confirmText="Delete"
        danger
        loading={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />

      {/* Regenerate Token Confirmation */}
      <ConfirmDialog
        open={Boolean(regenerateTarget)}
        title="Regenerate Token"
        description={`Regenerate token for "${regenerateTarget?.name}"? All existing subscription URLs will become invalid immediately.`}
        confirmText="Regenerate"
        danger
        loading={regenerateMutation.isPending}
        onCancel={() => setRegenerateTarget(null)}
        onConfirm={() => regenerateTarget && regenerateMutation.mutate(regenerateTarget.id)}
      />
    </div>
  );
}
