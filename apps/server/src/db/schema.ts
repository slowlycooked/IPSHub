/**
 * SQLite 数据库表结构定义
 * 所有时间戳使用 Unix 毫秒级别
 */

export const SCHEMA = {
  // 用户表
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `,

  // 订阅源表
  providers: `
    CREATE TABLE IF NOT EXISTS providers (
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
  `,

  // 代理节点表（去重）
  nodes: `
    CREATE TABLE IF NOT EXISTS nodes (
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
  `,

  // Profile 表（订阅配置）
  profiles: `
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      output_format TEXT NOT NULL CHECK (output_format IN ('clash', 'clash_provider', 'loon', 'raw')),
      include_protocols TEXT,
      exclude_keywords TEXT,
      rename_rules TEXT,
      access_count INTEGER DEFAULT 0,
      last_accessed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, name)
    );
  `,

  // Profile Token 表（支持多个 Token）
  profile_tokens: `
    CREATE TABLE IF NOT EXISTS profile_tokens (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      token_encrypted TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );
  `,

  // 刷新任务日志
  refresh_jobs: `
    CREATE TABLE IF NOT EXISTS refresh_jobs (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failed')),
      node_count INTEGER,
      error_message TEXT,
      duration_ms INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
    );
  `,

  // 访问日志
  access_logs: `
    CREATE TABLE IF NOT EXISTS access_logs (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      status_code INTEGER,
      response_size INTEGER,
      duration_ms INTEGER,
      accessed_at INTEGER NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );
  `,

  // 应用设置
  app_settings: `
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `,

  // 索引
  indexes: [
    'CREATE INDEX IF NOT EXISTS idx_providers_user ON providers(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_providers_enabled ON providers(enabled);',
    'CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_nodes_provider_fingerprint ON nodes(provider_id, fingerprint);',
    'CREATE INDEX IF NOT EXISTS idx_nodes_provider ON nodes(provider_id);',
    'CREATE INDEX IF NOT EXISTS idx_nodes_protocol ON nodes(protocol);',
    'CREATE INDEX IF NOT EXISTS idx_nodes_enabled ON nodes(enabled);',
    'CREATE INDEX IF NOT EXISTS idx_nodes_stale ON nodes(stale);',
    'CREATE INDEX IF NOT EXISTS idx_profile_tokens_profile ON profile_tokens(profile_id);',
    'CREATE INDEX IF NOT EXISTS idx_refresh_jobs_provider ON refresh_jobs(provider_id);',
    'CREATE INDEX IF NOT EXISTS idx_refresh_jobs_status ON refresh_jobs(status);',
    'CREATE INDEX IF NOT EXISTS idx_refresh_jobs_created ON refresh_jobs(created_at);',
    'CREATE INDEX IF NOT EXISTS idx_access_logs_profile ON access_logs(profile_id);',
    'CREATE INDEX IF NOT EXISTS idx_access_logs_accessed ON access_logs(accessed_at);',
  ],
};

/**
 * 初始化脚本执行顺序：
 * 1. 创建 users 表
 * 2. 创建 providers 表
 * 3. 创建 nodes 表
 * 4. 创建 profiles 表
 * 5. 创建 profile_tokens 表
 * 6. 创建 refresh_jobs 表
 * 7. 创建 access_logs 表
 * 8. 创建 app_settings 表
 * 9. 创建索引
 */
