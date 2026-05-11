import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Fastify from 'fastify';
import { parse as parseYaml } from 'yaml';
import { initDatabase, closeDatabase, getDatabase } from '../../db/client';
import { createProfile, getProfileById, getProfiles, regenerateToken } from '../profiles/service';
import { registerSubscriptionRoutes } from './routes';
import { mapProviderTypeToFormat } from '../providers/refresh';
import { SubscriptionFormat } from '../../core/parsers/detectType';
import { parseUriList } from '../../core/parsers/parseUriList';
import { renderClash } from '../../core/renderers/renderClash';
import { renderProvider } from '../../core/renderers/renderProvider';
import { upsertNodes, getNodes } from '../nodes/service';
import { encryptString, hashPassword } from '../../utils/crypto';

let tempDir: string;

function setupDb(): void {
  tempDir = mkdtempSync(join(tmpdir(), 'ipshub-test-'));
  process.env.DB_PATH = join(tempDir, 'test.db');
  closeDatabase();
  initDatabase();
}

function teardownDb(): void {
  closeDatabase();
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env.DB_PATH;
}

function seedUser(userId = 'user-1'): string {
  const db = getDatabase();
  const now = Date.now();
  db.prepare(`
    INSERT INTO users (id, username, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, `user-${userId}`, hashPassword('pass123'), now, now);
  return userId;
}

function seedProvider(providerId: string, userId: string, name: string): void {
  const db = getDatabase();
  const now = Date.now();
  db.prepare(`
    INSERT INTO providers (
      id, user_id, name, url, url_encrypted, type, enabled, refresh_interval,
      timeout_seconds, user_agent, request_headers_json, provider_prefix,
      last_node_count, failed_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    providerId,
    userId,
    name,
    'https://example.com/sub',
    Buffer.from(encryptString('https://example.com/sub')),
    'auto',
    1,
    3600,
    30,
    null,
    null,
    null,
    0,
    0,
    now,
    now
  );
}

describe('subscription pipeline fixes', () => {
  beforeEach(() => {
    setupDb();
  });

  afterEach(() => {
    teardownDb();
  });

  it('keeps VLESS nodes through parse -> clash/provider render', () => {
    const parsed = parseUriList('vless://123e4567-e89b-12d3-a456-426614174000@example.com:443?security=tls&type=ws&host=cdn.example.com&path=%2Fws#VLESS-US');
    expect(parsed.nodes).toHaveLength(1);
    expect(parsed.nodes[0].protocol).toBe('vless');

    const clashDoc = parseYaml(renderClash(parsed.nodes)) as { proxies?: Array<{ type?: string }> };
    const providerDoc = parseYaml(renderProvider(parsed.nodes)) as { proxies?: Array<{ type?: string }> };

    expect(clashDoc.proxies?.some((proxy) => proxy.type === 'vless')).toBe(true);
    expect(providerDoc.proxies?.some((proxy) => proxy.type === 'vless')).toBe(true);
  });

  it('maps provider type clash to clash parser format', () => {
    expect(mapProviderTypeToFormat('clash')).toBe(SubscriptionFormat.CLASH_YAML);
    expect(mapProviderTypeToFormat('auto')).toBeUndefined();
  });

  it('does not overwrite nodes across providers with same fingerprint', () => {
    const userId = seedUser();
    seedProvider('provider-a', userId, 'A');
    seedProvider('provider-b', userId, 'B');

    const sharedFingerprint = 'same-fingerprint';

    upsertNodes(
      [
        {
          fingerprint: sharedFingerprint,
          protocol: 'ss',
          name: 'Node A',
          server: 'a.example.com',
          port: 443,
          cipher: 'aes-256-gcm',
          password: 'pass-a',
          enabled: true,
        },
      ],
      'provider-a'
    );

    upsertNodes(
      [
        {
          fingerprint: sharedFingerprint,
          protocol: 'ss',
          name: 'Node B',
          server: 'b.example.com',
          port: 443,
          cipher: 'aes-256-gcm',
          password: 'pass-b',
          enabled: true,
        },
      ],
      'provider-b'
    );

    const nodes = getNodes(userId);
    expect(nodes).toHaveLength(2);
    expect(nodes.map((node) => node.providerId).sort()).toEqual(['provider-a', 'provider-b']);
  });

  it('returns reusable token in profile list/get APIs', () => {
    const userId = seedUser();
    const created = createProfile({ name: 'Main', output_format: 'clash' }, userId);

    const listed = getProfiles(userId);
    expect(listed[0].token).toBeTruthy();
    expect(listed[0].token?.length).toBeGreaterThan(0);

    const regenerated = regenerateToken(created.id, userId);
    expect(regenerated?.token).toBeTruthy();

    const byId = getProfileById(created.id, userId);
    expect(byId?.token).toBe(regenerated?.token);
  });

  it('returns 422 json for clash subscription when profile has no supported nodes', async () => {
    const userId = seedUser();
    const created = createProfile({ name: 'Empty Profile', output_format: 'clash' }, userId);

    const app = Fastify();
    await registerSubscriptionRoutes(app);

    const response = await app.inject({
      method: 'GET',
      url: `/sub/clash/${encodeURIComponent(created.name)}?token=${created.token}`,
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({ error: 'No supported nodes available for this profile' });

    await app.close();
  });
});
