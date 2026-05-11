import { z } from 'zod';
import { getDatabase, withTransaction } from '@/db/client';
import { ProxyNode } from '@/types/proxy';
import { createLogger } from '@/utils/logger';
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
      extra_data, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    JSON.stringify({}),
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
  const inserted: NodeDTO[] = [];

  return withTransaction((database) => {
    const now = Date.now();

    for (const node of nodes) {
      // 检查指纹是否已存在
      const existing = database.prepare('SELECT * FROM nodes WHERE fingerprint = ?').get(node.fingerprint) as any;

      if (existing) {
        // 更新现有节点（保留原有的 enabled 状态）
        database.prepare(`
          UPDATE nodes SET name = ?, provider_id = ?, updated_at = ? WHERE id = ?
        `).run(node.name, providerId, now, existing.id);

        inserted.push(nodeToDTO(existing));
      } else {
        // 创建新节点
        const id = uuidv4();
        database.prepare(`
          INSERT INTO nodes (
            id, fingerprint, provider_id, protocol, name, server, port,
            uuid, cipher, password, tls, tls_insecure, enabled, tag,
            extra_data, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          JSON.stringify({}),
          now,
          now
        );

        const dbNode = database.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as any;
        inserted.push(nodeToDTO(dbNode));
      }
    }

    return inserted;
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
        ORDER BY n.updated_at DESC
      `).all(userId) as any[]
    : db.prepare('SELECT * FROM nodes ORDER BY updated_at DESC').all() as any[];
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
  const nodes = db.prepare('SELECT * FROM nodes WHERE provider_id = ?').all(providerId) as any[];
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
    providerId: dbNode.provider_id,
    createdAt: dbNode.created_at,
    updatedAt: dbNode.updated_at,
  };
}
