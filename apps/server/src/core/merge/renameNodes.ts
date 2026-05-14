import { ProxyNode } from '@/types/proxy';

/**
 * 为节点添加前缀
 */
export function addPrefixToNodes(nodes: ProxyNode[], prefix: string): ProxyNode[] {
  if (!prefix) return nodes;

  return nodes.map(node => ({
    ...node,
    name: `${prefix}${node.name}`,
  }));
}

/**
 * 为节点添加后缀
 */
export function addSuffixToNodes(nodes: ProxyNode[], suffix: string): ProxyNode[] {
  if (!suffix) return nodes;

  return nodes.map(node => ({
    ...node,
    name: `${node.name}${suffix}`,
  }));
}

/**
 * 替换节点名称中的文本
 */
export function renameNodesByPattern(
  nodes: ProxyNode[],
  pattern: string,
  replacement: string
): ProxyNode[] {
  try {
    const regex = new RegExp(pattern, 'g');
    return nodes.map(node => ({
      ...node,
      name: node.name.replace(regex, replacement),
    }));
  } catch (error) {
    console.error(`Invalid regex pattern: ${pattern}`);
    return nodes;
  }
}

/**
 * 格式化节点名称
 * 支持模板变量: {protocol}, {server}, {port}, {provider}
 */
export function formatNodeNames(
  nodes: ProxyNode[],
  template: string
): ProxyNode[] {
  return nodes.map(node => {
    const name = template
      .replace('{protocol}', node.protocol)
      .replace('{server}', node.server)
      .replace('{port}', String(node.port))
      .replace('{provider}', node.provider || 'Unknown')
      .replace('{name}', node.name);

    return {
      ...node,
      name,
    };
  });
}

/**
 * 清理节点名称
 */
export function cleanNodeNames(nodes: ProxyNode[]): ProxyNode[] {
  return nodes.map(node => ({
    ...node,
    name: node.name
      // 移除表情符号，但保留国旗区域指示符 (U+1F1E0–U+1F1FF)
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
      // 移除特殊字符但保留中文、英文、数字、部分符号，以及国旗 emoji（区域指示符对）
      .replace(/[^\w\u4e00-\u9fff\s\-\(\)（）\u{1F1E0}-\u{1F1FF}]/gu, '')
      // 多个空格合并为一个
      .replace(/\s+/g, ' ')
      // 去除首尾空格
      .trim()
      // 如果名称为空，使用默认名称
      || `${node.protocol.toUpperCase()}-${node.server}:${node.port}`,
  }));
}

/**
 * 去重节点名称
 * 如果有重复名称，添加数字后缀
 */
export function dedupeNodeNames(nodes: ProxyNode[]): ProxyNode[] {
  const nameCount = new Map<string, number>();

  return nodes.map(node => {
    const baseName = node.name;
    const count = nameCount.get(baseName) || 0;
    nameCount.set(baseName, count + 1);

    if (count === 0) {
      return node;
    }

    return {
      ...node,
      name: `${baseName} (${count + 1})`,
    };
  });
}

export interface RenameOptions {
  addPrefix?: string;
  addSuffix?: string;
  patternReplace?: Array<{ pattern: string; replacement: string }>;
  formatTemplate?: string;
  clean?: boolean;
  dedupeName?: boolean;
}

/**
 * 应用多个重命名操作
 */
export function renameNodes(nodes: ProxyNode[], options: RenameOptions): ProxyNode[] {
  let result = [...nodes];

  if (options.clean) {
    result = cleanNodeNames(result);
  }

  if (options.addPrefix) {
    result = addPrefixToNodes(result, options.addPrefix);
  }

  if (options.addSuffix) {
    result = addSuffixToNodes(result, options.addSuffix);
  }

  if (options.patternReplace) {
    for (const { pattern, replacement } of options.patternReplace) {
      result = renameNodesByPattern(result, pattern, replacement);
    }
  }

  if (options.formatTemplate) {
    result = formatNodeNames(result, options.formatTemplate);
  }

  if (options.dedupeName) {
    result = dedupeNodeNames(result);
  }

  return result;
}
