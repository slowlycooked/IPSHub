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
    // Include host/path so CDN-fronted nodes (same server:port, different backend) are treated as distinct
    node.host || '',
    node.path || '',
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
  const primaryScore = scoreNodeName(primary.name);
  const secondaryScore = scoreNodeName(secondary.name);
  
  return {
    ...primary,
    name: primaryScore >= secondaryScore ? primary.name : secondary.name,
    updatedAt: primary.updatedAt || Date.now(),
  };
}

/**
 * 订阅元信息假节点的特征模式（流量/到期/重置信息）
 * 供应商用相同连接参数的假节点在 Clash UI 中显示订阅信息
 */
const INFO_NODE_PATTERNS = [
  /剩余流量/,
  /距离下次重置/,
  /套餐到期/,
  /到期时间/,
  /流量：/,
  /流量:/,
  /重置剩余/,
  /套餐.*\d{4}-\d{2}-\d{2}/,  // 套餐到期：2026-06-10
  /^\d{4}-\d{2}-\d{2}$/,       // 纯日期
  // 过期/流量信息节点常见格式
  /expire/i,
  /已用流量/,
  /总流量/,
  /剩余/,
  /traffic/i,
  /reset.*day/i,
  // 以 IP:port 形式作为节点名称（本地/回环代理）
  /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/,
  // 纯 IP 地址作为节点名
  /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
];

/**
 * 判断节点名是否为订阅元信息假节点
 */
export function isInfoNode(name: string): boolean {
  return INFO_NODE_PATTERNS.some(pattern => pattern.test(name));
}

/**
 * 生成含名称的指纹，用于区分"相同连接参数但不同名称"的真实节点
 * 供应商有时会对同一后端创建多个命名条目以支持负载均衡场景
 */
export function generateNamedFingerprint(node: ProxyNode): string {
  const parts = [
    node.protocol,
    node.server,
    node.port,
    node.uuid || node.password || '',
    node.cipher || '',
    node.tls || '',
    node.host || '',
    node.path || '',
    node.name,
  ].filter(Boolean);

  const str = parts.join(':');
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
}

/**
 * 评分节点名称质量（用于在合并时选择更好的名称）
 * 高分 = 更像真实代理节点；低分 = 更像订阅元信息假节点
 */
export function scoreNodeName(name: string): number {
  // 订阅信息假节点直接降到最低分
  if (INFO_NODE_PATTERNS.some(pattern => pattern.test(name))) {
    return -1000;
  }

  let score = 0;

  // 包含国旗 emoji（🇭🇰 🇺🇸 等）是真实节点的强信号
  if (/\p{Regional_Indicator}{2}/u.test(name)) score += 50;

  // 包含中文（地名等）
  if (/[\u4e00-\u9fff]/.test(name)) score += 10;

  // 包含数字序号（香港01、美国03等）
  if (/[\u4e00-\u9fff]\d+/.test(name)) score += 10;

  // 包含倍率信息（是真实节点的一部分）
  if (/\d+(\.\d+)?[xX倍]/.test(name)) score += 5;

  // 纯数字/纯符号降分
  if (/^\d+$/.test(name)) score -= 20;

  return score;
}
