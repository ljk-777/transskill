import type { Severity } from '../auditor.interface.js';

export interface UrlRule {
  id: string;
  pattern: RegExp;
  severity: Severity;
  description: string;
  recommendation: string;
}

/**
 * Rules for detecting suspicious URLs and network references
 * in agent skill instructions.
 */
export const URL_PATTERNS: UrlRule[] = [
  {
    id: 'L1-011a',
    pattern: /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?\//,
    severity: 'medium',
    description: '指令中包含直接 IP 地址的 HTTP 请求，可能指向恶意服务器',
    recommendation: '审查该 IP 地址是否可信，尽可能使用域名替代 IP',
  },
  {
    id: 'L1-011b',
    pattern: /https?:\/\/[^\s'"]*\.(?:onion|i2p)\b/i,
    severity: 'high',
    description: '引用暗网地址（.onion/.i2p），可能访问非法内容',
    recommendation: '审查该地址的用途，避免从暗网下载不可信内容',
  },
  {
    id: 'L1-011c',
    pattern: /https?:\/\/[^\s'"]*(?:pastebin|hastebin|rentry|ghostbin|dpaste)\.[^\s'"]+/i,
    severity: 'medium',
    description: '引用文本分享网站，内容不可追踪且可能隐藏恶意载荷',
    recommendation: '审查引用的实际内容是否安全',
  },
  {
    id: 'L1-011d',
    pattern: /https?:\/\/[^\s'"]*(?:raw\.githubusercontent|gist\.github)[^\s'"]+\.(?:sh|py|js|ps1|bat)\b/i,
    severity: 'low',
    description: '引用 GitHub 上的脚本文件，需确认来源是否可信',
    recommendation: '确认 GitHub 仓库和作者是否可信，建议锁定版本 commit hash',
  },
  {
    id: 'L1-011e',
    pattern: /data:\s*text\/[a-z]+;base64,[A-Za-z0-9+/=]{50,}/i,
    severity: 'medium',
    description: '指令中包含 data: URI 长 base64 内容，可能隐藏恶意载荷',
    recommendation: '审查 data: URI 解码后的实际内容',
  },
];
