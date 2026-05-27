import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { createHash } from 'node:crypto';
import { createLogger } from '../utils/logger';
import { decryptString, encryptString } from '../utils/crypto';
import { SCHEMA } from './schema';

const logger = createLogger('db');

let db: Database.Database | null = null;

interface LegacyJsonDatabase {
  users?: LegacyUserRecord[];
  providers?: LegacyProviderRecord[];
  nodes?: LegacyNodeRecord[];
  profiles?: LegacyProfileRecord[];
  refreshJobs?: LegacyRefreshJobRecord[];
  accessLogs?: LegacyAccessLogRecord[];
}

interface LegacyUserRecord {
  id: string;
  username: string;
  password_hash: string;
  created_at?: string | number;
  updated_at?: string | number;
}

interface LegacyProviderRecord {
  id: string;
  user_id?: string;
  name: string;
  url?: string;
  subscription_url?: string;
  url_encrypted?: string;
  subscription_url_encrypted?: string;
  type?: string;
  enabled?: number | boolean;
  refresh_interval?: number;
  refresh_interval_minutes?: number;
  timeout_seconds?: number;
  user_agent?: string | null;
  request_headers_json?: string | null;
  provider_prefix?: string | null;
  last_refresh_at?: string | number | null;
  last_success_at?: string | number | null;
  last_error?: string | null;
  last_node_count?: number;
  failed_count?: number;
  created_at?: string | number;
  updated_at?: string | number;
}

interface LegacyNodeRecord {
  id?: string;
  fingerprint?: string;
  provider_id?: string;
  protocol?: string;
  name?: string;
  server?: string;
  port?: number;
  uuid?: string;
  cipher?: string;
  password?: string;
  tls?: string;
  tls_insecure?: number | boolean;
  enabled?: number | boolean;
  tag?: string;
  extra_data?: string;
  created_at?: string | number;
  updated_at?: string | number;
}

interface LegacyProfileRecord {
  id: string;
  user_id?: string;
  name: string;
  description?: string;
  output_format?: string;
  output_type?: string;
  include_protocols?: string[];
  exclude_keywords?: string[];
  filter_json?: string;
  access_count?: number;
  last_accessed_at?: string | number | null;
  created_at?: string | number;
  updated_at?: string | number;
  token_hash?: string;
  token?: string;
  token_encrypted?: string;
}

interface LegacyRefreshJobRecord {
  id: string;
  provider_id: string;
  status?: string;
  node_count?: number;
  error?: string;
  error_message?: string;
  duration_ms?: number;
  created_at?: string | number;
  updated_at?: string | number;
  started_at?: string | number;
  finished_at?: string | number;
}

interface LegacyAccessLogRecord {
  id: string;
  profile_id: string;
  ip_address?: string;
  client_ip?: string;
  user_agent?: string;
  status_code?: number;
  response_size?: number;
  duration_ms?: number;
  accessed_at?: string | number;
  created_at?: string | number;
}

/**
 * 初始化数据库连接
 */
export function initDatabase(): Database.Database {
  if (db) return db;

  const dbPath = process.env.DB_PATH || './data/ipshub.db';
  
  // 确保目录存在
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const legacyJson = loadLegacyJsonDatabase(dbPath);

  // 创建数据库连接
  db = new Database(dbPath);
  
  // 启用外键约束
  db.pragma('foreign_keys = ON');
  
  // 设置 journal 模式为 WAL（提高并发性能）
  db.pragma('journal_mode = WAL');
  
  logger.info(`Database initialized: ${dbPath}`);
  
  // 初始化所有表
  initializeTables(db);

  if (legacyJson) {
    importLegacyJsonDatabase(db, legacyJson);
  }
  
  return db;
}

/**
 * 创建所有表
 */
export function initializeTables(database: Database.Database): void {
  // 创建表
  database.exec(SCHEMA.users);
  database.exec(SCHEMA.providers);
  database.exec(SCHEMA.nodes);
  database.exec(SCHEMA.profiles);
  database.exec(SCHEMA.profile_tokens);
  database.exec(SCHEMA.refresh_jobs);
  database.exec(SCHEMA.access_logs);
  database.exec(SCHEMA.app_settings);
  database.exec(SCHEMA.diagnostic_runs);
  database.exec(SCHEMA.diagnostic_node_results);
  database.exec(SCHEMA.diagnostic_logs);
  database.exec(SCHEMA.diagnostic_config_diffs);

  runMigrations(database);

  // 创建索引
  SCHEMA.indexes.forEach((indexSql) => {
    database.exec(indexSql);
  });

  logger.info('Database tables initialized');
}

function runMigrations(database: Database.Database): void {
  ensureProvidersTableShape(database);
  ensureNodesTableShape(database);
  ensureNodesProtocolSupportsHysteria2(database);
  ensureProfileTokensTableShape(database);
  ensureColumn(database, 'providers', 'enabled', 'INTEGER DEFAULT 1');
  ensureColumn(database, 'providers', 'timeout_seconds', 'INTEGER DEFAULT 30');
  ensureColumn(database, 'providers', 'user_agent', 'TEXT');
  ensureColumn(database, 'providers', 'request_headers_json', 'TEXT');
  ensureColumn(database, 'providers', 'provider_prefix', 'TEXT');
  ensureColumn(database, 'providers', 'last_success_at', 'INTEGER');
  ensureColumn(database, 'providers', 'last_error', 'TEXT');
  ensureColumn(database, 'access_logs', 'status_code', 'INTEGER');
  ensureColumn(database, 'access_logs', 'response_size', 'INTEGER');
  ensureColumn(database, 'access_logs', 'duration_ms', 'INTEGER');
  ensureColumn(database, 'refresh_jobs', 'duration_ms', 'INTEGER');
  ensureColumn(database, 'profiles', 'clash_config', 'TEXT');
}

function ensureNodesTableShape(database: Database.Database): void {
  const nodesTable = database
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'nodes'")
    .get() as { sql?: string } | undefined;

  const tableSql = nodesTable?.sql || '';
  const hasCompositeUnique = tableSql.includes('UNIQUE(provider_id, fingerprint)');
  const hasGlobalFingerprintUnique = tableSql.includes('fingerprint TEXT UNIQUE');
  const needsRebuild = hasGlobalFingerprintUnique || !hasCompositeUnique;

  if (needsRebuild) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS nodes_migrated (
        id TEXT PRIMARY KEY,
        fingerprint TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        protocol TEXT NOT NULL CHECK (protocol IN ('ss', 'vmess', 'trojan', 'vless', 'socks5', 'http', 'hysteria2')),
        name TEXT NOT NULL,
        server TEXT NOT NULL,
        port INTEGER NOT NULL,
        uuid TEXT,
        cipher TEXT,
        password TEXT,
        tls TEXT,
        tls_insecure INTEGER DEFAULT 0,
        enabled INTEGER DEFAULT 1,
        last_seen_at INTEGER,
        stale INTEGER DEFAULT 0,
        tag TEXT,
        extra_data TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
        UNIQUE(provider_id, fingerprint)
      );

      INSERT INTO nodes_migrated (
        id, fingerprint, provider_id, protocol, name, server, port,
        uuid, cipher, password, tls, tls_insecure, enabled,
        last_seen_at, stale, tag, extra_data, created_at, updated_at
      )
      SELECT
        id,
        fingerprint,
        provider_id,
        protocol,
        name,
        server,
        port,
        uuid,
        cipher,
        password,
        tls,
        COALESCE(tls_insecure, 0),
        COALESCE(enabled, 1),
        NULL,
        0,
        tag,
        COALESCE(extra_data, '{}'),
        created_at,
        updated_at
      FROM nodes;

      DROP TABLE nodes;
      ALTER TABLE nodes_migrated RENAME TO nodes;
    `);
  }

  ensureColumn(database, 'nodes', 'last_seen_at', 'INTEGER');
  ensureColumn(database, 'nodes', 'stale', 'INTEGER DEFAULT 0');
}

function ensureNodesProtocolSupportsHysteria2(database: Database.Database): void {
  const nodesTable = database
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'nodes'")
    .get() as { sql?: string } | undefined;

  const tableSql = nodesTable?.sql || '';
  if (tableSql.includes("'hysteria2'")) {
    return; // Already supports hysteria2
  }

  // Rebuild nodes table with updated CHECK constraint that includes hysteria2
  database.exec(`
    CREATE TABLE IF NOT EXISTS nodes_hy2_migrated (
      id TEXT PRIMARY KEY,
      fingerprint TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      protocol TEXT NOT NULL CHECK (protocol IN ('ss', 'vmess', 'trojan', 'vless', 'socks5', 'http', 'hysteria2')),
      name TEXT NOT NULL,
      server TEXT NOT NULL,
      port INTEGER NOT NULL,
      uuid TEXT,
      cipher TEXT,
      password TEXT,
      tls TEXT,
      tls_insecure INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      last_seen_at INTEGER,
      stale INTEGER DEFAULT 0,
      tag TEXT,
      extra_data TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
      UNIQUE(provider_id, fingerprint)
    );

    INSERT INTO nodes_hy2_migrated SELECT * FROM nodes;
    DROP TABLE nodes;
    ALTER TABLE nodes_hy2_migrated RENAME TO nodes;
  `);

  logger.info('Migrated nodes table to support hysteria2 protocol');
}

function ensureProfileTokensTableShape(database: Database.Database): void {
  ensureColumn(database, 'profile_tokens', 'token_encrypted', 'TEXT');
}

function ensureProvidersTableShape(database: Database.Database): void {
  const providerTable = database
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'providers'")
    .get() as { sql?: string } | undefined;

  const tableSql = providerTable?.sql || '';
  const needsRebuild =
    tableSql.includes("CHECK (type IN ('clash', 'subscription'))") ||
    !tableSql.includes('enabled INTEGER') ||
    !tableSql.includes('timeout_seconds INTEGER') ||
    !tableSql.includes('last_success_at INTEGER');

  if (!needsRebuild) {
    return;
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS providers_migrated (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      url_encrypted BLOB NOT NULL,
      type TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      refresh_interval INTEGER DEFAULT 3600,
      timeout_seconds INTEGER DEFAULT 30,
      user_agent TEXT,
      request_headers_json TEXT,
      provider_prefix TEXT,
      last_refresh_at INTEGER,
      last_success_at INTEGER,
      last_error TEXT,
      last_node_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, name)
    );

    INSERT INTO providers_migrated (
      id, user_id, name, url, url_encrypted, type, enabled, refresh_interval,
      timeout_seconds, user_agent, request_headers_json, provider_prefix,
      last_refresh_at, last_success_at, last_error, last_node_count,
      failed_count, created_at, updated_at
    )
    SELECT
      id,
      user_id,
      name,
      url,
      url_encrypted,
      type,
      COALESCE(enabled, 1),
      COALESCE(refresh_interval, 3600),
      COALESCE(timeout_seconds, 30),
      user_agent,
      request_headers_json,
      provider_prefix,
      last_refresh_at,
      last_success_at,
      last_error,
      COALESCE(last_node_count, 0),
      COALESCE(failed_count, 0),
      created_at,
      updated_at
    FROM providers;

    DROP TABLE providers;
    ALTER TABLE providers_migrated RENAME TO providers;
  `);
}

function ensureColumn(
  database: Database.Database,
  tableName: string,
  columnName: string,
  definition: string
): void {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
}

function loadLegacyJsonDatabase(dbPath: string): LegacyJsonDatabase | null {
  const directLegacy = readLegacyJsonIfPresent(dbPath);
  if (directLegacy) {
    const backupPath = reserveLegacyBackupPath(dbPath);
    fs.renameSync(dbPath, backupPath);
    logger.warn(`Detected legacy JSON database at ${dbPath}; backed up to ${backupPath} before SQLite migration`);
    return directLegacy;
  }

  const sidecarPath = `${dbPath}.json`;
  const sidecarLegacy = readLegacyJsonIfPresent(sidecarPath);
  if (sidecarLegacy) {
    logger.warn(`Detected legacy JSON sidecar database at ${sidecarPath}; importing into SQLite database ${dbPath}`);
    // 备份 sidecar 文件，防止重复导入
    const backupPath = reserveLegacyBackupPath(sidecarPath);
    fs.renameSync(sidecarPath, backupPath);
    logger.info(`Legacy JSON sidecar backed up to ${backupPath}`);
    return sidecarLegacy;
  }

  return null;
}

function readLegacyJsonIfPresent(filePath: string): LegacyJsonDatabase | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size === 0) {
    return null;
  }

  const descriptor = fs.openSync(filePath, 'r');
  const headerBuffer = Buffer.alloc(Math.min(64, stat.size));

  try {
    fs.readSync(descriptor, headerBuffer, 0, headerBuffer.length, 0);
  } finally {
    fs.closeSync(descriptor);
  }

  const header = headerBuffer.toString('utf8').trimStart();
  if (!header.startsWith('{')) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as LegacyJsonDatabase;
  } catch (error) {
    logger.error({ error, filePath }, 'Failed to parse legacy JSON database file');
    throw error;
  }
}

function reserveLegacyBackupPath(filePath: string): string {
  const candidateBase = `${filePath}.legacy-json`;
  if (!fs.existsSync(candidateBase)) {
    return candidateBase;
  }

  let index = 1;
  while (fs.existsSync(`${candidateBase}.${index}`)) {
    index += 1;
  }

  return `${candidateBase}.${index}`;
}

function importLegacyJsonDatabase(database: Database.Database, legacy: LegacyJsonDatabase): void {
  const users = legacy.users || [];
  const providers = legacy.providers || [];
  const nodes = legacy.nodes || [];
  const profiles = legacy.profiles || [];
  const refreshJobs = legacy.refreshJobs || [];
  const accessLogs = legacy.accessLogs || [];

  database.transaction(() => {
    const resolvedUserIds = new Map<string, string>();

    for (const user of users) {
      database.prepare(`
        INSERT OR IGNORE INTO users (id, username, password_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        user.id,
        user.username,
        user.password_hash,
        normalizeTimestamp(user.created_at),
        normalizeTimestamp(user.updated_at)
      );

      const resolvedUser = database.prepare('SELECT id FROM users WHERE username = ?').get(user.username) as { id: string } | undefined;
      if (resolvedUser) {
        resolvedUserIds.set(user.id, resolvedUser.id);
      }
    }

    const fallbackUserId = resolveLegacyUserId(users[0]?.id, resolvedUserIds);

    for (const provider of providers) {
      const userId = resolveLegacyUserId(provider.user_id || fallbackUserId, resolvedUserIds);
      if (!userId) {
        continue;
      }

      const encryptedUrl = provider.url_encrypted || provider.subscription_url_encrypted;
      const decryptedUrl = firstNonEmptyString(
        provider.url,
        provider.subscription_url,
        decryptLegacyUrl(encryptedUrl)
      );

      if (!decryptedUrl || !encryptedUrl) {
        continue;
      }

      const refreshIntervalSeconds =
        typeof provider.refresh_interval === 'number'
          ? provider.refresh_interval
          : typeof provider.refresh_interval_minutes === 'number'
            ? provider.refresh_interval_minutes * 60
            : 3600;

      database.prepare(`
        INSERT OR IGNORE INTO providers (
          id, user_id, name, url, url_encrypted, type, enabled, refresh_interval,
          timeout_seconds, user_agent, request_headers_json, provider_prefix,
          last_refresh_at, last_success_at, last_error, last_node_count,
          failed_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        provider.id,
        userId,
        provider.name,
        decryptedUrl,
        Buffer.from(encryptedUrl),
        provider.type || 'auto',
        normalizeBoolean(provider.enabled, true),
        refreshIntervalSeconds,
        provider.timeout_seconds || 30,
        provider.user_agent || null,
        provider.request_headers_json || null,
        provider.provider_prefix || null,
        normalizeNullableTimestamp(provider.last_refresh_at),
        normalizeNullableTimestamp(provider.last_success_at),
        provider.last_error || null,
        provider.last_node_count || 0,
        provider.failed_count || 0,
        normalizeTimestamp(provider.created_at),
        normalizeTimestamp(provider.updated_at)
      );
    }

    for (const node of nodes) {
      if (!node.provider_id || !node.protocol || !node.name || !node.server || !node.port) {
        continue;
      }

      if (!isSupportedProtocol(node.protocol)) {
        continue;
      }

      database.prepare(`
        INSERT OR IGNORE INTO nodes (
          id, fingerprint, provider_id, protocol, name, server, port,
          uuid, cipher, password, tls, tls_insecure, enabled, tag,
          extra_data, last_seen_at, stale, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        node.id || `${node.provider_id}:${node.fingerprint || node.name}`,
        node.fingerprint || createLegacyNodeFingerprint(node),
        node.provider_id,
        node.protocol,
        node.name,
        node.server,
        node.port,
        node.uuid || null,
        node.cipher || null,
        node.password || null,
        node.tls || null,
        normalizeBoolean(node.tls_insecure, false),
        normalizeBoolean(node.enabled, true),
        node.tag || null,
        node.extra_data || '{}',
        normalizeTimestamp(node.updated_at),
        0,
        normalizeTimestamp(node.created_at),
        normalizeTimestamp(node.updated_at)
      );
    }

    for (const profile of profiles) {
      const userId = resolveLegacyUserId(profile.user_id || fallbackUserId, resolvedUserIds);
      if (!userId) {
        continue;
      }

      const filters = parseLegacyFilterJson(profile.filter_json);
      const outputFormat = normalizeOutputFormat(profile.output_format || profile.output_type);

      database.prepare(`
        INSERT OR IGNORE INTO profiles (
          id, user_id, name, description, output_format, include_protocols,
          exclude_keywords, access_count, last_accessed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        profile.id,
        userId,
        profile.name,
        profile.description || null,
        outputFormat,
        serializeOptionalArray(profile.include_protocols || filters.includeProtocols),
        serializeOptionalArray(profile.exclude_keywords || filters.excludeKeywords),
        profile.access_count || 0,
        normalizeNullableTimestamp(profile.last_accessed_at),
        normalizeTimestamp(profile.created_at),
        normalizeTimestamp(profile.updated_at)
      );

      const tokenHash = profile.token_hash || hashLegacyToken(profile.token);
      if (tokenHash) {
        const tokenEncrypted = profile.token_encrypted || (profile.token ? encryptString(profile.token) : null);
        database.prepare(`
          INSERT OR IGNORE INTO profile_tokens (id, profile_id, token_hash, token_encrypted, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          `${profile.id}:legacy-token`,
          profile.id,
          tokenHash,
          tokenEncrypted,
          normalizeTimestamp(profile.created_at)
        );
      }
    }

    for (const job of refreshJobs) {
      database.prepare(`
        INSERT OR IGNORE INTO refresh_jobs (
          id, provider_id, status, node_count, error_message, duration_ms, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        job.id,
        job.provider_id,
        normalizeRefreshStatus(job.status),
        job.node_count || 0,
        job.error_message || job.error || null,
        job.duration_ms || null,
        normalizeTimestamp(job.created_at || job.started_at),
        normalizeTimestamp(job.updated_at || job.finished_at || job.started_at)
      );
    }

    for (const log of accessLogs) {
      database.prepare(`
        INSERT OR IGNORE INTO access_logs (
          id, profile_id, ip_address, user_agent, status_code, response_size, duration_ms, accessed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        log.id,
        log.profile_id,
        log.ip_address || log.client_ip || null,
        log.user_agent || null,
        log.status_code || null,
        log.response_size || null,
        log.duration_ms || null,
        normalizeTimestamp(log.accessed_at || log.created_at)
      );
    }
  })();

  logger.info(
    {
      users: users.length,
      providers: providers.length,
      nodes: nodes.length,
      profiles: profiles.length,
      refreshJobs: refreshJobs.length,
      accessLogs: accessLogs.length,
    },
    'Legacy JSON database imported into SQLite'
  );
}

function normalizeTimestamp(value: string | number | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.length > 0) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && value.trim() !== '') {
      return numeric;
    }

    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Date.now();
}

function normalizeNullableTimestamp(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return normalizeTimestamp(value);
}

function normalizeBoolean(value: number | boolean | undefined, defaultValue: boolean): number {
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  if (typeof value === 'number') {
    return value === 0 ? 0 : 1;
  }

  return defaultValue ? 1 : 0;
}

function decryptLegacyUrl(encryptedUrl: string | undefined): string | undefined {
  if (!encryptedUrl) {
    return undefined;
  }

  try {
    return decryptString(encryptedUrl);
  } catch {
    return undefined;
  }
}

function firstNonEmptyString(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === 'string' && value.length > 0);
}

function isSupportedProtocol(protocol: string): boolean {
  return ['ss', 'vmess', 'trojan', 'vless', 'socks5', 'http'].includes(protocol);
}

function createLegacyNodeFingerprint(node: LegacyNodeRecord): string {
  return createHash('sha256')
    .update([node.protocol || '', node.server || '', String(node.port || ''), node.uuid || '', node.password || '', node.cipher || ''].join(':'))
    .digest('hex')
    .slice(0, 16);
}

function parseLegacyFilterJson(rawFilterJson: string | undefined): { includeProtocols?: string[]; excludeKeywords?: string[] } {
  if (!rawFilterJson) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawFilterJson) as {
      includeProtocols?: string[];
      excludeNameRegex?: string[];
    };

    return {
      includeProtocols: parsed.includeProtocols,
      excludeKeywords: parsed.excludeNameRegex,
    };
  } catch {
    return {};
  }
}

function normalizeOutputFormat(value: string | undefined): string {
  if (value === 'clash_provider') {
    return value;
  }

  if (value === 'clash' || value === 'loon' || value === 'raw') {
    return value;
  }

  if (value === 'mihomo' || value === 'provider') {
    return 'clash';
  }

  return 'clash';
}

function serializeOptionalArray(value: string[] | undefined): string | null {
  if (!value || value.length === 0) {
    return null;
  }

  return JSON.stringify(value);
}

function hashLegacyToken(token: string | undefined): string | undefined {
  if (!token) {
    return undefined;
  }

  return createHash('sha256').update(token).digest('hex');
}

function normalizeRefreshStatus(status: string | undefined): string {
  if (status === 'pending' || status === 'running' || status === 'success' || status === 'failed') {
    return status;
  }

  if (status === 'queued') {
    return 'pending';
  }

  return 'success';
}

function resolveLegacyUserId(userId: string | undefined, resolvedUserIds: Map<string, string>): string | undefined {
  if (!userId) {
    return undefined;
  }

  return resolvedUserIds.get(userId) || userId;
}

/**
 * 获取数据库实例
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return db;
}

/**
 * 关闭数据库连接
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.info('Database closed');
  }
}

/**
 * 执行事务
 */
export function withTransaction<T>(callback: (db: Database.Database) => T): T {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  const transaction = db.transaction(callback);
  return transaction(db);
}

/**
 * 数据库查询助手
 */
export const dbHelpers = {
  /**
   * 执行 INSERT 或 UPDATE 操作
   */
  run: (sql: string, params: any[] = []) => {
    const database = getDatabase();
    const stmt = database.prepare(sql);
    return stmt.run(...params);
  },

  /**
   * 执行 SELECT 操作，返回单个结果
   */
  get: <T = any>(sql: string, params: any[] = []): T | undefined => {
    const database = getDatabase();
    const stmt = database.prepare(sql);
    return stmt.get(...params) as T | undefined;
  },

  /**
   * 执行 SELECT 操作，返回所有结果
   */
  all: <T = any>(sql: string, params: any[] = []): T[] => {
    const database = getDatabase();
    const stmt = database.prepare(sql);
    return stmt.all(...params) as T[];
  },

  /**
   * 执行事务
   */
  transaction: <T>(callback: (db: Database.Database) => T): T => {
    return withTransaction(callback);
  },
};

