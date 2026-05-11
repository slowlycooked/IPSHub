import crypto from 'crypto';
import { ProxyNode } from '@/types/proxy';

/**
 * 为节点生成唯一指纹，用于去重和识别
 * 指纹基于节点的核心配置，而不是名称
 */
export function generateFingerprint(node: ProxyNode): string {
  const parts = [
    node.protocol,
    node.server,
    node.port,
    node.uuid || node.password || '',
    node.cipher || '',
    node.tls || '',
  ].filter(Boolean);

  const str = parts.join(':');
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
}

/**
 * 规范化节点数据，用于一致的序列化
 */
export function normalizeNode(node: ProxyNode): ProxyNode {
  return {
    ...node,
    // 规范化服务器地址（去除末尾点）
    server: node.server.toLowerCase().replace(/\.$/, ''),
    // 清理空字符串
    password: node.password?.trim() || undefined,
    cipher: node.cipher?.trim() || undefined,
    uuid: node.uuid?.toLowerCase() || undefined,
    tls: node.tls?.toLowerCase() || undefined,
    transport: node.transport?.toLowerCase() || undefined,
    path: node.path?.trim() || undefined,
    host: node.host?.trim() || undefined,
  };
}

/**
 * 检查两个节点是否相同（基于指纹）
 */
export function isSameNode(node1: ProxyNode, node2: ProxyNode): boolean {
  return generateFingerprint(node1) === generateFingerprint(node2);
}

/**
 * 合并节点信息（当发现相同指纹时）
 * 保留较新的信息，但保持较好的名称
 */
export function mergeNodes(primary: ProxyNode, secondary: ProxyNode): ProxyNode {
  // 选择更好的名称（更短或不包含数字的）
  const primaryScore = scoreNodeName(primary.name);
  const secondaryScore = scoreNodeName(secondary.name);
  
  return {
    ...primary,
    name: primaryScore >= secondaryScore ? primary.name : secondary.name,
    // 使用 primary 的 provider 信息
    updatedAt: primary.updatedAt || Date.now(),
  };
}

/**
 * 评分节点名称质量（用于在合并时选择更好的名称）
 */
function scoreNodeName(name: string): number {
  let score = name.length;
  
  // 偏好更短的名称
  score -= name.length;
  
  // 偏好中文或有意义的名称
  if (/[\u4e00-\u9fff]/.test(name)) score += 10;
  
  // 降低只包含数字和特殊字符的名称
  if (/^\d+$/.test(name)) score -= 20;
  if (/[^\w\u4e00-\u9fff-]/.test(name)) score -= 5;
  
  return score;
}
