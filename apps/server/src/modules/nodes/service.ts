import { z } from 'zod';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { getDatabase, withTransaction } from '@/db/client';
import { ProxyNode } from '@/types/proxy';
import { createLogger } from '@/utils/logger';
import { scoreNodeName, isInfoNode, generateNamedFingerprint } from '@/core/merge/fingerprint';
import { SSRFGuardError, validateUrl } from '@/core/fetcher/ssrfGuard';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('nodes-service');

export const updateNodeSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  tag: z.string().optional(),
});

export type UpdateNodeInput = z.infer<typeof updateNodeSchema>;

export interface NodeDTO extends ProxyNode {
  id: string;
  createdAt: number;
  updatedAt: number;
}

export interface ConnectivityProbeResult {
  ok: boolean;
  latencyMs: number | null;
  statusCode?: number;
  error?: string;
}

export interface NodeConnectivityResult {
  nodeId: string;
  tcp: ConnectivityProbeResult;
  http: ConnectivityProbeResult;
  checkedAt: number;
}

const DEFAULT_CONNECTIVITY_TIMEOUT_MS = 3000;
const MAX_CONNECTIVITY_TIMEOUT_MS = 15000;
const MIN_CONNECTIVITY_TIMEOUT_MS = 500;
const CONNECTIVITY_CONCURRENCY = 20;

function serializeExtraData(node: ProxyNode): string {
  const extraData: Record<string, any> = {};
  
  // Add all optional fields that aren't stored in main columns
  if (node.host) extraData.host = node.host;
  if (node.transport) extraData.transport = node.transport;
  if (node.path) extraData.path = node.path;
  if (node.obfs) extraData.obfs = node.obfs;
  if (node.obfsHost) extraData.obfsHost = node.obfsHost;
  if (node.serviceName) extraData.serviceName = node.serviceName;
  if (node.flow) extraData.flow = node.flow;
  if (node.realityPublicKey) extraData.realityPublicKey = node.realityPublicKey;
  if (node.realityShortId) extraData.realityShortId = node.realityShortId;
  if (node.realityFingerprint) extraData.realityFingerprint = node.realityFingerprint;
  if (node.alterId !== undefined) extraData.alterId = node.alterId;
  if (node.udpRelay !== undefined) extraData.udpRelay = node.udpRelay;
  
  // If node has extraData object, merge it in
  if (node.extraData) {
    return JSON.stringify({ ...extraData, ...node.extraData });
  }
  
  return JSON.stringify(extraData);
}

/**
 * 从 ProxyNode 创建数据库记录
 */
export function insertNode(node: ProxyNode, providerId: string): NodeDTO {
  const db = getDatabase();
  const id = uuidv4();
  const now = Date.now();

  db.prepare(`
    INSERT INTO nodes (
      id, fingerprint, provider_id, protocol, name, server, port,
      uuid, cipher, password, tls, tls_insecure, enabled, tag,
      extra_data, last_seen_at, stale, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    node.fingerprint,
    providerId,
    node.protocol,
    node.name,
    node.server,
    node.port,
    node.uuid || null,
    node.cipher || null,
    node.password || null,
    node.tls || null,
    node.tlsInsecure ? 1 : 0,
    node.enabled ? 1 : 0,
    node.tag || null,
    serializeExtraData(node),
    now,
    0,
    now,
    now
  );

  logger.debug(`Node inserted: ${node.name} (${node.fingerprint})`);

  const dbNode = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as any;
  return nodeToDTO(dbNode);
}

/**
 * 批量 upsert 节点（用于刷新订阅）
 */
export function upsertNodes(nodes: ProxyNode[], providerId: string): NodeDTO[] {
  const upserted: NodeDTO[] = [];

  // 批次内去重：
  //   - 元信息假节点（剩余流量/套餐到期等）同指纹 → 保留评分最高的名称
  //   - 真实代理节点同指纹且名称不同 → 保留两者（赋含名称指纹）
  const bestByFingerprint = new Map<string, ProxyNode>();
  for (const node of nodes) {
    const existing = bestByFingerprint.get(node.fingerprint);
    if (!existing) {
      bestByFingerprint.set(node.fingerprint, node);
    } else {
      const bothInfo = isInfoNode(node.name) && isInfoNode(existing.name);
      const sameName = node.name === existing.name;
      if (bothInfo || sameName) {
        // 真正的重复或元信息节点 → 保留评分最高的
        if (scoreNodeName(node.name) > scoreNodeName(existing.name)) {
          bestByFingerprint.set(node.fingerprint, node);
        }
      } else {
        // 真实代理节点，名称不同 → 用含名称的指纹保留两者
        const namedFp = generateNamedFingerprint(node);
        bestByFingerprint.set(namedFp, { ...node, fingerprint: namedFp });
      }
    }
  }
  const dedupedNodes = Array.from(bestByFingerprint.values());

  if (dedupedNodes.length < nodes.length) {
    logger.info(`Deduped ${nodes.length - dedupedNodes.length} nodes with duplicate fingerprints in batch`);
  }

  return withTransaction((database) => {
    const now = Date.now();
    const seenFingerprints = new Set<string>();

    for (const node of dedupedNodes) {
      seenFingerprints.add(node.fingerprint);
      const existing = database.prepare(
        'SELECT * FROM nodes WHERE provider_id = ? AND fingerprint = ?'
      ).get(providerId, node.fingerprint) as any;

      if (existing) {
        // 更新节点配置字段，保留 enabled/tag 的人工状态。
        database.prepare(`
          UPDATE nodes
          SET
            protocol = ?,
            name = ?,
            server = ?,
            port = ?,
            uuid = ?,
            cipher = ?,
            password = ?,
            tls = ?,
            tls_insecure = ?,
            extra_data = ?,
            stale = 0,
            last_seen_at = ?,
            updated_at = ?
          WHERE id = ?
        `).run(
          node.protocol,
          node.name,
          node.server,
          node.port,
          node.uuid || null,
          node.cipher || null,
          node.password || null,
          node.tls || null,
          node.tlsInsecure ? 1 : 0,
          serializeExtraData(node),
          now,
          now,
          existing.id
        );

        const updated = database.prepare('SELECT * FROM nodes WHERE id = ?').get(existing.id) as any;
        upserted.push(nodeToDTO(updated));
      } else {
        const id = uuidv4();
        database.prepare(`
          INSERT INTO nodes (
            id, fingerprint, provider_id, protocol, name, server, port,
            uuid, cipher, password, tls, tls_insecure, enabled, tag,
            extra_data, last_seen_at, stale, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          node.fingerprint,
          providerId,
          node.protocol,
          node.name,
          node.server,
          node.port,
          node.uuid || null,
          node.cipher || null,
          node.password || null,
          node.tls || null,
          node.tlsInsecure ? 1 : 0,
          1, // enabled
          node.tag || null,
          serializeExtraData(node),
          now,
          0,
          now,
          now
        );

        const dbNode = database.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as any;
        upserted.push(nodeToDTO(dbNode));
      }
    }

    if (seenFingerprints.size > 0) {
      const placeholders = Array.from(seenFingerprints, () => '?').join(',');
      database.prepare(`
        UPDATE nodes
        SET stale = 1, updated_at = ?
        WHERE provider_id = ? AND fingerprint NOT IN (${placeholders})
      `).run(now, providerId, ...Array.from(seenFingerprints));
    } else {
      database.prepare(`
        UPDATE nodes
        SET stale = 1, updated_at = ?
        WHERE provider_id = ?
      `).run(now, providerId);
    }

    return upserted;
  });
}

/**
 * 获取所有节点
 */
export function getNodes(userId?: string): NodeDTO[] {
  const db = getDatabase();
  const nodes = userId
    ? db.prepare(`
        SELECT n.*
        FROM nodes n
        JOIN providers p ON p.id = n.provider_id
        WHERE p.user_id = ?
          AND n.stale = 0
        ORDER BY n.updated_at DESC
      `).all(userId) as any[]
    : db.prepare('SELECT * FROM nodes WHERE stale = 0 ORDER BY updated_at DESC').all() as any[];
  return nodes.map(nodeToDTO);
}

/**
 * 按 ID 获取节点
 */
export function getNodeById(id: string, userId?: string): NodeDTO | null {
  const db = getDatabase();
  const node = userId
    ? db.prepare(`
        SELECT n.*
        FROM nodes n
        JOIN providers p ON p.id = n.provider_id
        WHERE n.id = ? AND p.user_id = ?
      `).get(id, userId) as any
    : db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as any;
  return node ? nodeToDTO(node) : null;
}

/**
 * 按 Provider 获取节点
 */
export function getNodesByProviderId(providerId: string): NodeDTO[] {
  const db = getDatabase();
  const nodes = db.prepare('SELECT * FROM nodes WHERE provider_id = ? AND stale = 0').all(providerId) as any[];
  return nodes.map(nodeToDTO);
}

/**
 * 更新节点
 */
export function updateNode(id: string, input: UpdateNodeInput, userId?: string): NodeDTO | null {
  const db = getDatabase();
  const node = getNodeById(id, userId);

  if (!node) {
    return null;
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (input.name !== undefined) {
    updates.push('name = ?');
    params.push(input.name);
  }
  if (input.enabled !== undefined) {
    updates.push('enabled = ?');
    params.push(input.enabled ? 1 : 0);
  }
  if (input.tag !== undefined) {
    updates.push('tag = ?');
    params.push(input.tag);
  }

  if (updates.length === 0) return nodeToDTO(node);

  updates.push('updated_at = ?');
  params.push(Date.now());
  params.push(id);

  const sql = `UPDATE nodes SET ${updates.join(', ')} WHERE id = ?`;
  db.prepare(sql).run(...params);

  logger.debug(`Node updated: ${id}`);
  return getNodeById(id, userId);
}

/**
 * 启用节点
 */
export function enableNode(id: string, userId?: string): NodeDTO | null {
  return updateNode(id, { enabled: true }, userId);
}

/**
 * 禁用节点
 */
export function disableNode(id: string, userId?: string): NodeDTO | null {
  return updateNode(id, { enabled: false }, userId);
}

function sanitizeTimeout(timeoutMs?: number): number {
  if (!timeoutMs || Number.isNaN(timeoutMs)) {
    return DEFAULT_CONNECTIVITY_TIMEOUT_MS;
  }

  return Math.min(
    MAX_CONNECTIVITY_TIMEOUT_MS,
    Math.max(MIN_CONNECTIVITY_TIMEOUT_MS, Math.floor(timeoutMs))
  );
}

function normalizeHostForUrl(host: string): string {
  if (host.includes(':') && !host.startsWith('[') && !host.endsWith(']')) {
    return `[${host}]`;
  }
  return host;
}

function shouldUseHttps(node: NodeDTO): boolean {
  const tls = typeof node.tls === 'string' ? node.tls.toLowerCase() : '';
  return node.protocol === 'trojan' || tls === 'tls' || tls === 'reality' || tls === 'xtls';
}

function runTcpProbe(node: NodeDTO, timeoutMs: number): Promise<ConnectivityProbeResult> {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let finished = false;

    const finish = (result: ConnectivityProbeResult) => {
      if (finished) return;
      finished = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      finish({ ok: true, latencyMs: Date.now() - startedAt });
    });

    socket.once('timeout', () => {
      finish({ ok: false, latencyMs: Date.now() - startedAt, error: 'TCP probe timeout' });
    });

    socket.once('error', (error: Error) => {
      finish({
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: error.message || 'TCP probe failed',
      });
    });

    socket.connect(node.port, node.server);
  });
}

function runHttpProbe(node: NodeDTO, timeoutMs: number): Promise<ConnectivityProbeResult> {
  const isHttps = shouldUseHttps(node);
  const protocol = isHttps ? 'https' : 'http';
  const url = `${protocol}://${normalizeHostForUrl(node.server)}:${node.port}/`;

  try {
    validateUrl(url, process.env.NODE_ENV === 'development');
  } catch (error) {
    const message = error instanceof SSRFGuardError ? error.message : 'HTTP probe URL invalid';
    return Promise.resolve({ ok: false, latencyMs: null, error: message });
  }

  const startedAt = Date.now();

  return new Promise((resolve) => {
    const request = (isHttps ? https : http).request(
      {
        host: node.server,
        port: node.port,
        path: '/',
        method: 'HEAD',
        timeout: timeoutMs,
        rejectUnauthorized: false,
        headers: {
          'User-Agent': 'IPSHub/1.0',
          Accept: '*/*',
        },
      },
      (response) => {
        response.resume();
        resolve({
          ok: true,
          latencyMs: Date.now() - startedAt,
          statusCode: response.statusCode,
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(new Error('HTTP probe timeout'));
    });

    request.on('error', (error: Error) => {
      resolve({
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: error.message || 'HTTP probe failed',
      });
    });

    request.end();
  });
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const runWorker = async () => {
    while (currentIndex < items.length) {
      const index = currentIndex;
      currentIndex += 1;
      results[index] = await worker(items[index]);
    }
  };

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

export async function testNodesConnectivity(
  userId?: string,
  timeoutMs?: number
): Promise<NodeConnectivityResult[]> {
  const nodes = getNodes(userId);
  const effectiveTimeout = sanitizeTimeout(timeoutMs);

  return runWithConcurrency(nodes, CONNECTIVITY_CONCURRENCY, async (node) => {
    const [tcp, httpResult] = await Promise.all([
      runTcpProbe(node, effectiveTimeout),
      runHttpProbe(node, effectiveTimeout),
    ]);

    return {
      nodeId: node.id,
      tcp,
      http: httpResult,
      checkedAt: Date.now(),
    };
  });
}

/**
 * 删除节点
 */
export function deleteNode(id: string, userId?: string): boolean {
  const db = getDatabase();
  const node = getNodeById(id, userId);

  if (!node) {
    return false;
  }

  db.prepare('DELETE FROM nodes WHERE id = ?').run(id);
  logger.debug(`Node deleted: ${id}`);
  return true;
}

/**
 * 将数据库节点转换为 DTO
 */
function nodeToDTO(dbNode: any): NodeDTO {
  const extraData = dbNode.extra_data ? JSON.parse(dbNode.extra_data) : {};
  
  return {
    id: dbNode.id,
    fingerprint: dbNode.fingerprint,
    name: dbNode.name,
    protocol: dbNode.protocol as any,
    server: dbNode.server,
    port: dbNode.port,
    password: dbNode.password,
    cipher: dbNode.cipher,
    uuid: dbNode.uuid,
    tls: dbNode.tls,
    tlsInsecure: dbNode.tls_insecure === 1,
    tag: dbNode.tag,
    enabled: dbNode.enabled === 1,
    stale: dbNode.stale === 1,
    lastSeenAt: dbNode.last_seen_at,
    // Unpack extra_data fields onto the node object
    host: extraData.host,
    transport: extraData.transport,
    path: extraData.path,
    obfs: extraData.obfs,
    obfsHost: extraData.obfsHost,
    serviceName: extraData.serviceName,
    flow: extraData.flow,
    realityPublicKey: extraData.realityPublicKey,
    realityShortId: extraData.realityShortId,
    realityFingerprint: extraData.realityFingerprint,
    alterId: extraData.alterId,
    udpRelay: extraData.udpRelay,
    extraData,
    providerId: dbNode.provider_id,
    createdAt: dbNode.created_at,
    updatedAt: dbNode.updated_at,
  };
}
