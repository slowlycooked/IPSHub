import { z } from 'zod';
import { getDatabase } from '@/db/client';
import { encryptString, decryptString, maskUrl } from '@/utils/crypto';
import { createLogger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('provider-service');

export const createProviderSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['auto', 'clash', 'base64-uri', 'uri-list']).default('auto'),
  subscription_url: z.string().url(),
  enabled: z.boolean().default(true),
  refresh_interval_minutes: z.number().int().min(15).default(360),
  timeout_seconds: z.number().int().min(5).max(300).default(30),
  user_agent: z.string().optional(),
  request_headers_json: z.string().optional(),
  provider_prefix: z.string().optional(),
});

export const updateProviderSchema = createProviderSchema.partial();

export type CreateProviderInput = z.infer<typeof createProviderSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;

export interface ProviderDTO {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  refresh_interval_minutes: number;
  timeout_seconds: number;
  user_agent?: string;
  request_headers_json?: string;
  provider_prefix?: string;
  last_refresh_at?: string;
  last_success_at?: string;
  last_error?: string;
  last_node_count: number;
  created_at: string;
  updated_at: string;
  maskedUrl?: string;
}

export function createProvider(input: CreateProviderInput): ProviderDTO {
  const db = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  const encryptedUrl = encryptString(input.subscription_url);

  const provider = {
    id,
    name: input.name,
    type: input.type,
    subscription_url_encrypted: encryptedUrl,
    enabled: input.enabled ? 1 : 0,
    refresh_interval_minutes: input.refresh_interval_minutes,
    timeout_seconds: input.timeout_seconds,
    user_agent: input.user_agent || null,
    request_headers_json: input.request_headers_json || null,
    provider_prefix: input.provider_prefix || null,
    last_refresh_at: null,
    last_success_at: null,
    last_error: null,
    last_node_count: 0,
    created_at: now,
    updated_at: now,
  };

  db.providers.insert(provider);
  logger.info(`Provider created: ${input.name}`);

  return toDTO(provider);
}

export function getProviders(): ProviderDTO[] {
  const db = getDatabase();
  return db.providers.getAll().map(toDTO);
}

export function getProviderById(id: string): ProviderDTO | null {
  const db = getDatabase();
  const provider = db.providers.getById(id);
  return provider ? toDTO(provider) : null;
}

export function updateProvider(id: string, input: UpdateProviderInput): ProviderDTO | null {
  const db = getDatabase();
  const provider = db.providers.getById(id);

  if (!provider) {
    return null;
  }

  const updates: any = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) updates.name = input.name;
  if (input.type !== undefined) updates.type = input.type;
  if (input.subscription_url !== undefined) {
    updates.subscription_url_encrypted = encryptString(input.subscription_url);
  }
  if (input.enabled !== undefined) updates.enabled = input.enabled ? 1 : 0;
  if (input.refresh_interval_minutes !== undefined) {
    updates.refresh_interval_minutes = input.refresh_interval_minutes;
  }
  if (input.timeout_seconds !== undefined) updates.timeout_seconds = input.timeout_seconds;
  if (input.user_agent !== undefined) updates.user_agent = input.user_agent || null;
  if (input.request_headers_json !== undefined) {
    updates.request_headers_json = input.request_headers_json || null;
  }
  if (input.provider_prefix !== undefined) {
    updates.provider_prefix = input.provider_prefix || null;
  }

  db.providers.update(id, updates);
  const updated = db.providers.getById(id);

  logger.info(`Provider updated: ${id}`);
  return updated ? toDTO(updated) : null;
}

export function deleteProvider(id: string): boolean {
  const db = getDatabase();
  const provider = db.providers.getById(id);

  if (!provider) {
    return false;
  }

  // 删除关联的节点
  db.nodes.deleteByProviderId(id);
  db.providers.delete(id);

  logger.info(`Provider deleted: ${id}`);
  return true;
}

export function getDecryptedSubscriptionUrl(id: string): string | null {
  const db = getDatabase();
  const provider = db.providers.getById(id);

  if (!provider || !provider.subscription_url_encrypted) {
    return null;
  }

  try {
    return decryptString(provider.subscription_url_encrypted);
  } catch (error) {
    logger.error(`Failed to decrypt URL for provider ${id}`, error);
    return null;
  }
}

function toDTO(provider: any): ProviderDTO {
  return {
    id: provider.id,
    name: provider.name,
    type: provider.type,
    enabled: provider.enabled === 1,
    refresh_interval_minutes: provider.refresh_interval_minutes,
    timeout_seconds: provider.timeout_seconds,
    user_agent: provider.user_agent,
    request_headers_json: provider.request_headers_json,
    provider_prefix: provider.provider_prefix,
    last_refresh_at: provider.last_refresh_at,
    last_success_at: provider.last_success_at,
    last_error: provider.last_error,
    last_node_count: provider.last_node_count,
    created_at: provider.created_at,
    updated_at: provider.updated_at,
    maskedUrl: provider.subscription_url_encrypted
      ? maskUrl(decryptString(provider.subscription_url_encrypted))
      : undefined,
  };
}
