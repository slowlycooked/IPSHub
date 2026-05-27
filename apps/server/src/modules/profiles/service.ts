import { z } from 'zod';
import { getDatabase, withTransaction } from '@/db/client';
import { createLogger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { decryptString, encryptString, hashToken } from '@/utils/crypto';
import type { ClashConfig } from '@/types/clashConfig';

const logger = createLogger('profiles-service');

// Zod schema for ClashConfig – kept permissive intentionally so the frontend
// can pass partial configs without being rejected at the boundary.
const clashConfigSchema = z.record(z.unknown()).optional();

export const createProfileSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  output_format: z.enum(['clash', 'clash_provider', 'loon', 'raw']).default('clash'),
  include_protocols: z.array(z.string()).optional(),
  exclude_keywords: z.array(z.string()).optional(),
  clash_config: clashConfigSchema,
});

export const updateProfileSchema = createProfileSchema.partial();

export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export interface ProfileDTO {
  id: string;
  name: string;
  description?: string;
  output_format: string;
  include_protocols?: string[];
  exclude_keywords?: string[];
  clash_config?: ClashConfig;
  access_count: number;
  last_accessed_at?: number;
  created_at: number;
  updated_at: number;
  token?: string;
}

/**
 * 生成随机 Token
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 创建 Profile
 */
export function createProfile(input: CreateProfileInput, userId: string): ProfileDTO {
  const profileId = uuidv4();
  const now = Date.now();
  const token = generateToken();
  const tokenHash = hashToken(token);
  const tokenEncrypted = encryptString(token);

  return withTransaction((database) => {
    // 创建 profile
    database.prepare(`
      INSERT INTO profiles (
        id, user_id, name, description, output_format,
        include_protocols, exclude_keywords, clash_config, access_count,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      profileId,
      userId,
      input.name,
      input.description || null,
      input.output_format || 'clash',
      input.include_protocols ? JSON.stringify(input.include_protocols) : null,
      input.exclude_keywords ? JSON.stringify(input.exclude_keywords) : null,
      input.clash_config ? JSON.stringify(input.clash_config) : null,
      0,
      now,
      now
    );

    // 创建 token
    const tokenId = uuidv4();
    database.prepare(`
      INSERT INTO profile_tokens (id, profile_id, token_hash, token_encrypted, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(tokenId, profileId, tokenHash, tokenEncrypted, now);

    logger.info(`Profile created: ${input.name}`);

    const profile = database.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId) as any;
    return {
      ...toDTO(profile),
      token,
    };
  });
}

/**
 * 获取所有 Profile
 */
export function getProfiles(userId: string): ProfileDTO[] {
  const db = getDatabase();
  const profiles = db.prepare('SELECT * FROM profiles WHERE user_id = ?').all(userId) as any[];
  return profiles.map((profile) => ({
    ...toDTO(profile),
    token: getLatestTokenForProfile(profile.id),
  }));
}

/**
 * 按 ID 获取 Profile
 */
export function getProfileById(id: string, userId: string): ProfileDTO | null {
  const db = getDatabase();
  const profile = db.prepare('SELECT * FROM profiles WHERE id = ? AND user_id = ?').get(id, userId) as any;
  return profile
    ? {
        ...toDTO(profile),
        token: getLatestTokenForProfile(profile.id),
      }
    : null;
}

/**
 * 按名称获取 Profile
 */
export function getProfileByName(name: string): { id: string; userId: string } | null {
  const db = getDatabase();
  const profile = db.prepare('SELECT id, user_id FROM profiles WHERE name = ?').get(name) as any;
  return profile ? { id: profile.id, userId: profile.user_id } : null;
}

/**
 * 验证 Token
 */
export function validateToken(token: string): { id: string; userId: string } | null {
  const db = getDatabase();
  const tokenHash = hashToken(token);
  
  const result = db.prepare(`
    SELECT pt.profile_id, p.user_id FROM profile_tokens pt
    JOIN profiles p ON pt.profile_id = p.id
    WHERE pt.token_hash = ?
  `).get(tokenHash) as any;

  if (result) {
    return { id: result.profile_id, userId: result.user_id };
  }

  return null;
}

/**
 * 记录访问
 */
export function recordAccess(profileId: string, ipAddress?: string, userAgent?: string): void {

  withTransaction((database) => {
    const now = Date.now();

    // 更新 Profile 的访问计数和最后访问时间
    database.prepare(`
      UPDATE profiles 
      SET access_count = access_count + 1, last_accessed_at = ?
      WHERE id = ?
    `).run(now, profileId);

    // 记录访问日志
    const logId = uuidv4();
    database.prepare(`
      INSERT INTO access_logs (
        id, profile_id, ip_address, user_agent, accessed_at
      ) VALUES (?, ?, ?, ?, ?)
    `).run(logId, profileId, ipAddress || null, userAgent || null, now);
  });
}

/**
 * 更新 Profile
 */
export function updateProfile(id: string, userId: string, input: UpdateProfileInput): ProfileDTO | null {

  return withTransaction((database) => {
    const profile = database.prepare('SELECT * FROM profiles WHERE id = ? AND user_id = ?').get(id, userId) as any;

    if (!profile) {
      return null;
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      params.push(input.name);
    }
    if (input.description !== undefined) {
      updates.push('description = ?');
      params.push(input.description || null);
    }
    if (input.output_format !== undefined) {
      updates.push('output_format = ?');
      params.push(input.output_format);
    }
    if (input.include_protocols !== undefined) {
      updates.push('include_protocols = ?');
      params.push(input.include_protocols ? JSON.stringify(input.include_protocols) : null);
    }
    if (input.exclude_keywords !== undefined) {
      updates.push('exclude_keywords = ?');
      params.push(input.exclude_keywords ? JSON.stringify(input.exclude_keywords) : null);
    }
    if (input.clash_config !== undefined) {
      updates.push('clash_config = ?');
      params.push(input.clash_config ? JSON.stringify(input.clash_config) : null);
    }

    if (updates.length === 0) return toDTO(profile);

    updates.push('updated_at = ?');
    params.push(Date.now());
    params.push(id);

    const sql = `UPDATE profiles SET ${updates.join(', ')} WHERE id = ?`;
    database.prepare(sql).run(...params);

    logger.info(`Profile updated: ${id}`);
    const updated = database.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as any;
    return updated ? toDTO(updated) : null;
  });
}

/**
 * 重新生成 Token
 */
export function regenerateToken(id: string, userId: string): ProfileDTO | null {

  return withTransaction((database) => {
    const profile = database.prepare('SELECT * FROM profiles WHERE id = ? AND user_id = ?').get(id, userId) as any;

    if (!profile) {
      return null;
    }

    const token = generateToken();
    const tokenHash = hashToken(token);
    const tokenEncrypted = encryptString(token);
    const now = Date.now();

    // 删除旧 token
    database.prepare('DELETE FROM profile_tokens WHERE profile_id = ?').run(id);

    // 创建新 token
    const tokenId = uuidv4();
    database.prepare(`
      INSERT INTO profile_tokens (id, profile_id, token_hash, token_encrypted, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(tokenId, id, tokenHash, tokenEncrypted, now);

    // 更新 profile updated_at
    database.prepare('UPDATE profiles SET updated_at = ? WHERE id = ?').run(now, id);

    logger.info(`Token regenerated for profile: ${id}`);
    const updated = database.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as any;
    return { ...toDTO(updated), token };
  });
}

/**
 * 删除 Profile
 */
export function deleteProfile(id: string, userId: string): boolean {

  return withTransaction((database) => {
    const profile = database.prepare('SELECT * FROM profiles WHERE id = ? AND user_id = ?').get(id, userId) as any;

    if (!profile) {
      return false;
    }

    // 删除关联的 tokens
    database.prepare('DELETE FROM profile_tokens WHERE profile_id = ?').run(id);
    // 删除关联的访问日志
    database.prepare('DELETE FROM access_logs WHERE profile_id = ?').run(id);
    // 删除 profile
    database.prepare('DELETE FROM profiles WHERE id = ?').run(id);

    logger.info(`Profile deleted: ${id}`);
    return true;
  });
}

/**
 * 将数据库 Profile 转换为 DTO
 */
function toDTO(dbProfile: any): ProfileDTO {
  return {
    id: dbProfile.id,
    name: dbProfile.name,
    description: dbProfile.description || undefined,
    output_format: dbProfile.output_format,
    include_protocols: dbProfile.include_protocols ? JSON.parse(dbProfile.include_protocols) : undefined,
    exclude_keywords: dbProfile.exclude_keywords ? JSON.parse(dbProfile.exclude_keywords) : undefined,
    clash_config: dbProfile.clash_config ? JSON.parse(dbProfile.clash_config) : undefined,
    access_count: dbProfile.access_count || 0,
    last_accessed_at: dbProfile.last_accessed_at,
    created_at: dbProfile.created_at,
    updated_at: dbProfile.updated_at,
  };
}

function getLatestTokenForProfile(profileId: string): string | undefined {
  const db = getDatabase();
  const tokenRow = db.prepare(`
    SELECT token_encrypted
    FROM profile_tokens
    WHERE profile_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(profileId) as { token_encrypted?: string | null } | undefined;

  if (!tokenRow?.token_encrypted) {
    return undefined;
  }

  try {
    return decryptString(tokenRow.token_encrypted);
  } catch (error) {
    logger.warn({ profileId }, 'Failed to decrypt profile token for response');
    return undefined;
  }
}
