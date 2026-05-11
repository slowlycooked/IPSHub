import { z } from 'zod';
import { getDatabase, withTransaction } from '@/db/client';
import { ProxyNode } from '@/types/proxy';
import { createLogger } from '@/utils/logger';
import { scoreNodeName, isInfoNode, generateNamedFingerprint } from '@/core/merge/fingerprint';
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
