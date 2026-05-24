import type { Severity } from '../auditor.interface.js';

export interface CommandRule {
  id: string;
  pattern: RegExp;
  severity: Severity;
  description: string;
  recommendation: string;
  cwe?: string;
}

/**
 * Rules for detecting dangerous shell commands and patterns
 * in agent skill instructions.
 */
export const DANGEROUS_COMMAND_RULES: CommandRule[] = [
  // ── System destruction ──
  {
    id: 'L1-001a',
    pattern: /rm\s+-rf\s+(\/|\/\*|~\/?\*?)/i,
    severity: 'critical',
    description: '递归强制删除系统根目录或 home 目录，可能导致系统崩溃',
    recommendation: '移除 rm -rf 指令，使用更安全的临时目录清理方式',
    cwe: 'CWE-22',
  },
  {
    id: 'L1-001b',
    pattern: /\b(?:mkfs|format)\s+/i,
    severity: 'critical',
    description: '格式化磁盘指令，可能导致数据永久丢失',
    recommendation: '不要在 skill 中包含格式化磁盘的指令',
    cwe: 'CWE-22',
  },
  {
    id: 'L1-001c',
    pattern: /\bshutdown\b|\bpoweroff\b|\breboot\b|:\(\)\s*\{[^}]*\}:\s*;/i,
    severity: 'critical',
    description: '关机/重启命令或 fork bomb，可导致拒绝服务',
    recommendation: '移除所有关机/重启/fork bomb 指令',
    cwe: 'CWE-835',
  },

  // ── Privilege escalation ──
  {
    id: 'L1-001d',
    pattern: /\bsudo\s+(?!apt\b|-u\s+\w+\s+(?:echo|printf|true)\b)/i,
    severity: 'critical',
    description: '使用 sudo 提权执行操作',
    recommendation: '避免在 skill 中使用 sudo，如需安装依赖应提示用户手动操作',
    cwe: 'CWE-269',
  },
  {
    id: 'L1-001e',
    pattern: /\bchmod\s+777\b/i,
    severity: 'high',
    description: '将文件权限设为 777（任何人可读写执行）',
    recommendation: '使用最小必要权限，如 chmod 755 或 chmod 644',
    cwe: 'CWE-732',
  },
  {
    id: 'L1-001f',
    pattern: /\bchown\s+(?!\$\w+)/i,
    severity: 'high',
    description: '修改文件所有者，可能存在权限提升风险',
    recommendation: '避免在 skill 中自动修改文件所有者',
    cwe: 'CWE-732',
  },

  // ── Remote code execution ──
  {
    id: 'L1-002a',
    pattern: /(?:curl|wget)\s+(?:-s\s*|-q\s*|--silent\s*|--quiet\s*)?['"]?(?:https?:\/\/)?[^\s'"]+?\s*[|;`]\s*(?:sh|bash|zsh|python|node)\b/i,
    severity: 'critical',
    description: '从网络下载脚本并直接执行（管道到 shell），典型的远程代码执行模式',
    recommendation: '不要从不可信来源下载并执行脚本，建议使用包管理器安装',
    cwe: 'CWE-494',
  },
  {
    id: 'L1-002b',
    pattern: /\b(?:eval|exec)\s*\(/i,
    severity: 'critical',
    description: '动态代码执行函数调用，可能被用于执行任意代码',
    recommendation: '避免使用 eval/exec，使用更安全的替代方案',
    cwe: 'CWE-95',
  },
  {
    id: 'L1-002c',
    pattern: /\b(?:subprocess|Popen|execSync|execFile)\b/i,
    severity: 'high',
    description: '子进程创建/代码执行调用',
    recommendation: '审查子进程调用的参数，确保没有注入风险',
    cwe: 'CWE-78',
  },
  {
    id: 'L1-002d',
    pattern: /\b(?:Invoke-Expression|iex)\b/i,
    severity: 'critical',
    description: 'PowerShell 动态代码执行',
    recommendation: '避免使用 Invoke-Expression，使用安全的替代方案',
    cwe: 'CWE-95',
  },
  {
    id: 'L1-002e',
    pattern: /spawn\s*\(/i,
    severity: 'high',
    description: '子进程创建（spawn），可能执行任意命令',
    recommendation: '审查 spawn 调用的参数是否安全',
    cwe: 'CWE-78',
  },

  // ── Network exfiltration ──
  {
    id: 'L1-003a',
    pattern: /(?:curl|wget)\s+.*?(?:-d\b|--data\b|--data-raw\b|--post-file\b|--upload-file\b)/i,
    severity: 'critical',
    description: '通过 HTTP 请求向外发送数据，可能用于数据窃取',
    recommendation: '审查数据发送操作，确保不包含敏感信息',
    cwe: 'CWE-201',
  },
  {
    id: 'L1-003b',
    pattern: /\b(?:nc|ncat)\s+/i,
    severity: 'high',
    description: '使用 netcat 建立网络连接，可被用于反向 shell 或数据窃取',
    recommendation: '避免在 skill 中使用 nc/ncat',
    cwe: 'CWE-201',
  },

  // ── SSH / key compromise ──
  {
    id: 'L1-004a',
    pattern: /(?:cat|type)\s+.*(?:id_rsa|id_ed25519|\.ssh|\.pem|secret|token|\.env)/i,
    severity: 'high',
    description: '读取 SSH 私钥、令牌或环境变量文件，可能导致凭证泄露',
    recommendation: '不要读取或共享敏感凭证文件',
    cwe: 'CWE-522',
  },
  {
    id: 'L1-004b',
    pattern: /(?:>>?)\s*.*(?:id_rsa|authorized_keys|\.ssh)/i,
    severity: 'critical',
    description: '向 SSH 配置目录写入内容，可能安装后门持久化',
    recommendation: '禁止向 SSH 配置目录写入内容',
    cwe: 'CWE-276',
  },

  // ── Dangerous git operations ──
  {
    id: 'L1-005a',
    pattern: /git\s+push\s+.*--force/i,
    severity: 'medium',
    description: '强制推送 git 历史，可能覆盖远程分支',
    recommendation: '避免使用 --force 推送，使用 --force-with-lease 替代',
    cwe: 'CWE-348',
  },
  {
    id: 'L1-005b',
    pattern: /git\s+.*--config\s+(?:credential|user\.(?:email|name))/i,
    severity: 'low',
    description: '修改 git 凭证或用户配置',
    recommendation: '不要在 skill 中修改 git 配置',
  },

  // ── Environment / secrets ──
  {
    id: 'L1-006a',
    pattern: /\$(?:SECRET|TOKEN|API_KEY|PASSWORD|PASSWD|CREDENTIALS|AUTH)\b/i,
    severity: 'medium',
    description: '引用环境变量中的敏感信息（API Key、Token、密码）',
    recommendation: '避免在 skill 中暴露敏感环境变量名',
    cwe: 'CWE-200',
  },
  {
    id: 'L1-006b',
    pattern: /export\s+\w+=(?:(?!["']\w).)*[A-Za-z0-9+/=]{40,}/i,
    severity: 'high',
    description: 'export 命令中包含疑似 Token/Key 的长字符串',
    recommendation: '不要在 skill 中硬编码密钥，使用环境变量引用',
    cwe: 'CWE-798',
  },

  // ── Misc dangerous patterns ──
  {
    id: 'L1-007a',
    pattern: /\bnpm\s+publish\b/i,
    severity: 'medium',
    description: '自动发布 npm 包，可能导致意外发布',
    recommendation: '避免自动发布命令，使用手动确认',
  },
  {
    id: 'L1-007b',
    pattern: /\bdangerouslySetInnerHTML\b/i,
    severity: 'medium',
    description: 'React 危险 HTML 渲染，可能导致 XSS',
    recommendation: '避免使用 dangerouslySetInnerHTML，使用安全渲染',
    cwe: 'CWE-79',
  },
  {
    id: 'L1-007c',
    pattern: /(?:innerHTML|outerHTML)\s*=.*(?:document|cookie|localStorage)/i,
    severity: 'high',
    description: '直接操作 DOM 可能导致 XSS 攻击',
    recommendation: '使用安全的 DOM 操作方式',
    cwe: 'CWE-79',
  },
];
