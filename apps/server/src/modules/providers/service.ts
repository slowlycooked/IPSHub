import { z } from 'zod';
import { getDatabase, withTransaction } from '@/db/client';
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
  last_refresh_at?: number;
  last_success_at?: number;
  last_error?: string;
  last_node_count: number;
  created_at: number;
  updated_at: number;
  maskedUrl?: string;
}

export function createProvider(input: CreateProviderInput, userId: string): ProviderDTO {
  const id = uuidv4();
  const now = Date.now();

  const urlEncrypted = Buffer.from(encryptString(input.subscription_url));

  return withTransaction((database) => {
    database.prepare(`
      INSERT INTO providers (
        id, user_id, name, url, url_encrypted, type, enabled, refresh_interval,
        timeout_seconds, user_agent, request_headers_json, provider_prefix,
        last_node_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId,
      input.name,
      input.subscription_url,
      urlEncrypted,
      input.type,
      input.enabled ? 1 : 0,
      input.refresh_interval_minutes * 60,
      input.timeout_seconds,
      input.user_agent || null,
      input.request_headers_json || null,
      input.provider_prefix || null,
      0,
      now,
      now
    );

    logger.info(`Provider created: ${input.name}`);

    const provider = database.prepare('SELECT * FROM providers WHERE id = ?').get(id) as any;
    return toDTO(provider);
  });
}

export function getProviders(userId: string): ProviderDTO[] {
  const db = getDatabase();
  const providers = db.prepare('SELECT * FROM providers WHERE user_id = ?').all(userId) as any[];
  return providers.map(toDTO);
}

export function getProviderById(id: string, userId: string): ProviderDTO | null {
  const db = getDatabase();
  const provider = db.prepare('SELECT * FROM providers WHERE id = ? AND user_id = ?').get(id, userId) as any;
  return provider ? toDTO(provider) : null;
}

export function updateProvider(id: string, userId: string, input: UpdateProviderInput): ProviderDTO | null {
  
  return withTransaction((database) => {
    const provider = database.prepare('SELECT * FROM providers WHERE id = ? AND user_id = ?').get(id, userId) as any;

    if (!provider) {
      return null;
    }

    const params: any[] = [];

    // Build SET clause
    const setClauses: string[] = [];

    if (input.name !== undefined) {
      setClauses.push('name = ?');
      params.push(input.name);
    }
    if (input.type !== undefined) {
      setClauses.push('type = ?');
      params.push(input.type);
    }
    if (input.subscription_url !== undefined) {
      setClauses.push('url_encrypted = ?');
      params.push(Buffer.from(encryptString(input.subscription_url)));
    }
    if (input.enabled !== undefined) {
      setClauses.push('enabled = ?');
      params.push(input.enabled ? 1 : 0);
    }
    if (input.refresh_interval_minutes !== undefined) {
      setClauses.push('refresh_interval = ?');
      params.push(input.refresh_interval_minutes * 60);
    }
    if (input.timeout_seconds !== undefined) {
      setClauses.push('timeout_seconds = ?');
      params.push(input.timeout_seconds);
    }
    if (input.user_agent !== undefined) {
      setClauses.push('user_agent = ?');
      params.push(input.user_agent || null);
    }
    if (input.request_headers_json !== undefined) {
      setClauses.push('request_headers_json = ?');
      params.push(input.request_headers_json || null);
    }
    if (input.provider_prefix !== undefined) {
      setClauses.push('provider_prefix = ?');
      params.push(input.provider_prefix || null);
    }

    if (setClauses.length === 0) return toDTO(provider);

    setClauses.push('updated_at = ?');
    params.push(Date.now());
    params.push(id);
    params.push(userId);

    const sql = `UPDATE providers SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`;
    database.prepare(sql).run(...params);

    logger.info(`Provider updated: ${id}`);
    const updated = database.prepare('SELECT * FROM providers WHERE id = ?').get(id) as any;
    return toDTO(updated);
  });
}

export function deleteProvider(id: string, userId: string): boolean {

  return withTransaction((database) => {
    const provider = database.prepare('SELECT * FROM providers WHERE id = ? AND user_id = ?').get(id, userId) as any;

    if (!provider) {
      return false;
    }

    // Delete associated nodes
    database.prepare('DELETE FROM nodes WHERE provider_id = ?').run(id);
    database.prepare('DELETE FROM providers WHERE id = ?').run(id);

    logger.info(`Provider deleted: ${id}`);
    return true;
  });
}

export function getDecryptedSubscriptionUrl(id: string): string | null {
  const db = getDatabase();
  const provider = db.prepare('SELECT url_encrypted FROM providers WHERE id = ?').get(id) as any;

  if (!provider || !provider.url_encrypted) {
    return null;
  }

  try {
    const encryptedBuffer = Buffer.isBuffer(provider.url_encrypted) 
      ? provider.url_encrypted.toString('binary') 
      : provider.url_encrypted;
    return decryptString(encryptedBuffer);
  } catch (error) {
    logger.error(`Failed to decrypt URL for provider ${id}`, error);
    return null;
  }
}

export function updateProviderStats(id: string, nodeCount: number, errorMessage?: string): void {
  const db = getDatabase();
  const now = Date.now();

  const updateSql = errorMessage
    ? 'UPDATE providers SET last_refresh_at = ?, last_error = ?, failed_count = failed_count + 1, updated_at = ? WHERE id = ?'
    : 'UPDATE providers SET last_refresh_at = ?, last_node_count = ?, last_success_at = ?, last_error = NULL, failed_count = 0, updated_at = ? WHERE id = ?';

  const params = errorMessage
    ? [now, errorMessage, now, id]
    : [now, nodeCount, now, now, id];

  db.prepare(updateSql).run(...params);
}

function toDTO(provider: any): ProviderDTO {
  let decryptedUrl = provider.url;
  try {
    if (provider.url_encrypted) {
      const encryptedBuffer = Buffer.isBuffer(provider.url_encrypted)
        ? provider.url_encrypted.toString('binary')
        : provider.url_encrypted;
      decryptedUrl = decryptString(encryptedBuffer);
    }
  } catch (error) {
    logger.debug('Failed to decrypt URL for display', error);
  }

  return {
    id: provider.id,
    name: provider.name,
    type: provider.type,
    enabled: provider.enabled === 1,
    refresh_interval_minutes: Math.round((provider.refresh_interval || 0) / 60),
    timeout_seconds: provider.timeout_seconds || 30,
    user_agent: provider.user_agent,
    request_headers_json: provider.request_headers_json,
    provider_prefix: provider.provider_prefix,
    last_refresh_at: provider.last_refresh_at,
    last_success_at: provider.last_success_at,
    last_error: provider.last_error,
    last_node_count: provider.last_node_count || 0,
    created_at: provider.created_at,
    updated_at: provider.updated_at,
    maskedUrl: decryptedUrl ? maskUrl(decryptedUrl) : undefined,
  };
}
