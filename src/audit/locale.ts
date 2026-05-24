/**
 * Translation map: Chinese → English for audit findings.
 * English is derived from context; Chinese is the source text.
 */
const ZH_TO_EN: Record<string, string> = {
  // ── dangerous-commands.ts ──
  '递归强制删除系统根目录或 home 目录，可能导致系统崩溃': 'Recursive rm -rf on root or home directory, system destruction',
  '格式化磁盘指令，可能导致数据永久丢失': 'Disk format command, may cause permanent data loss',
  '关机/重启命令或 fork bomb，可导致拒绝服务': 'Shutdown/reboot command or fork bomb, denial of service',
  '使用 sudo 提权执行操作': 'Sudo privilege escalation to execute commands',
  '将文件权限设为 777（任何人可读写执行）': 'File permissions set to 777 (world-readable/writable/executable)',
  '修改文件所有者，可能存在权限提升风险': 'File ownership change, potential privilege escalation',
  '从网络下载脚本并直接执行（管道到 shell），典型的远程代码执行模式': 'Download and pipe script to shell, classic remote code execution',
  '动态代码执行函数调用，可能被用于执行任意代码': 'Dynamic code execution via eval/exec, arbitrary code risk',
  '子进程创建/代码执行调用': 'Subprocess/child process creation, arbitrary command execution',
  'PowerShell 动态代码执行': 'PowerShell dynamic code execution via Invoke-Expression',
  '子进程创建（spawn），可能执行任意命令': 'Subprocess creation via spawn, arbitrary command execution',
  '通过 HTTP 请求向外发送数据，可能用于数据窃取': 'HTTP request sending data externally, potential data exfiltration',
  '使用 netcat 建立网络连接，可被用于反向 shell 或数据窃取': 'Netcat network connection, possible reverse shell or data exfiltration',
  '读取 SSH 私钥、令牌或环境变量文件，可能导致凭证泄露': 'Reading SSH private keys, tokens, or env files, credential leak risk',
  '向 SSH 配置目录写入内容，可能安装后门持久化': 'Writing to SSH config directory, possible backdoor persistence',
  '强制推送 git 历史，可能覆盖远程分支': 'Force push git history, may overwrite remote branches',
  '修改 git 凭证或用户配置': 'Modifying git credentials or user configuration',
  '引用环境变量中的敏感信息（API Key、Token、密码）': 'Referencing sensitive env variables (API Key, Token, Password)',
  'export 命令中包含疑似 Token/Key 的长字符串': 'Export command with long string resembling a token/key',
  '自动发布 npm 包，可能导致意外发布': 'Auto-publish npm package, may cause accidental release',
  'React 危险 HTML 渲染，可能导致 XSS': 'React dangerouslySetInnerHTML, potential XSS vulnerability',
  '直接操作 DOM 可能导致 XSS 攻击': 'Direct DOM manipulation may lead to XSS attacks',

  // ── prompt-injection.ts ──
  '尝试覆盖/忽略系统指令，典型的 prompt 注入模式': 'Attempt to override/ignore system instructions, typical prompt injection',
  '模拟系统级指令覆盖，可能是恶意注入': 'Simulated system-level instruction override, possible malicious injection',
  '尝试"释放"AI 约束，典型 jailbreak 模式': 'Attempt to bypass AI constraints, classic jailbreak pattern',
  '试图清除 AI 上下文或记忆': 'Attempt to clear AI context or memory',
  '引用已知 jailbreak 角色（如 DAN/Developer Mode）': 'References known jailbreak persona (e.g. DAN/Developer Mode)',
  '试图提取系统提示词，可能是信息收集行为': 'Attempt to extract system prompt, possible information gathering',
  '使用紧急/重要词汇引导 AI 行为（组合其他模式时风险更高）': 'Using urgent/important language to influence AI behavior (higher risk when combined with other patterns)',

  // ── suspicious-urls.ts ──
  '指令中包含直接 IP 地址的 HTTP 请求，可能指向恶意服务器': 'Direct IP address in HTTP request, may point to malicious server',
  '引用暗网地址（.onion/.i2p），可能访问非法内容': 'References darknet address (.onion/.i2p), may access illegal content',
  '引用文本分享网站，内容不可追踪且可能隐藏恶意载荷': 'References paste site, content is untraceable and may hide malicious payload',
  '引用 GitHub 上的脚本文件，需确认来源是否可信': 'References GitHub-hosted script file, verify source trustworthiness',
  '指令中包含 data: URI 长 base64 内容，可能隐藏恶意载荷': 'Data URI with long base64 content, may hide malicious payload',

  // ── instruction-scanner.ts (encoding checks) ──
  'Base64 解码后执行，可能隐藏恶意指令': 'Base64 decode then execute, may hide malicious instructions',
  '对 base64 编码内容解码后执行，可能用于隐藏恶意载荷': 'Decoding then executing base64 content, may be used to hide malicious payload',
  '指令中包含长 base64 编码字符串': 'Instruction contains long base64-encoded string',
  '疑似编码混淆，可能隐藏恶意载荷': 'Suspected encoding obfuscation, may hide malicious payload',

  // ── permission-scanner.ts ──
  'alwaysApply 全局生效无范围限制': 'alwaysApply active globally with no scope restrictions',
  '规则设置为 alwaysApply（全局应用）且未指定 globs 范围，会影响所有文件操作': 'Rule set to alwaysApply with no globs scope, affects all file operations',
  'alwaysApply 规则 globs 范围过宽': 'alwaysApply rule has overly broad globs scope',
  '规则作用于所有文件 (**/*)，建议缩小范围': 'Rule applies to all files (**/*), consider narrowing scope',
  'globs 范围过宽': 'Globs scope is too broad',
  'MCP tool 可能有危险操作': 'MCP tool may perform dangerous operations',
  '的描述或名称暗示可能执行系统命令或危险操作': ' description or name suggests system command execution or dangerous operations',
  'MCP tool 涉及文件系统操作': 'MCP tool involves filesystem operations',
  '可能读写文件系统': 'may read/write filesystem',
  'MCP tool 涉及网络访问': 'MCP tool involves network access',
  '可能发起网络请求': 'may initiate network requests',
  'MCP server 使用危险命令': 'MCP server uses dangerous command',
  'MCP server 设置为执行': 'MCP server is configured to execute',
  'Claude skill 禁用了模型调用': 'Claude skill has model invocation disabled',
  'disableModelInvocation 为 true，该 skill 不会触发 Claude 模型调用': 'disableModelInvocation is true, this skill will not trigger Claude model calls',

  // ── mcp-scanner.ts ──
  'MCP 配置未解析出结构化数据': 'MCP configuration did not parse into structured data',
  '文件被识别为 mcp.json 但未提取出工具和服务器信息': 'File identified as mcp.json but no tool or server info extracted',
  '描述中包含 prompt 注入': ' description contains prompt injection',
  '描述中包含可疑关键词': ' description contains suspicious keywords',
  'Tool shadowing': 'Tool shadowing',
  '引用了其他 tool': ' references another tool',
  ' 描述中包含 prompt 注入': ' description contains prompt injection',
  ' 描述中包含可疑关键词': ' description contains suspicious keywords',
  ' 可能暴露 agent 于不可信内容': ' may expose agent to untrusted content',
  ' 访问敏感数据领域': ' accesses sensitive data domain',
  ' 可能具有破坏性能力': ' may have destructive capabilities',
  '的描述中提到了其他 tool': "'s description references another tool",
  '这可能是一个 tool shadowing 攻击，恶意 server 试图覆盖或干扰另一工具的决策': 'This may be a tool shadowing attack; a malicious server may be trying to override another tool\'s decisions',
  '可能暴露 agent 于不可信内容': ' may expose agent to untrusted content',
  'Tool 描述暗示该工具会获取外部数据': 'Tool description suggests it fetches external data',
  '访问敏感数据领域': ' accesses sensitive data domain',
  '涉及': ' involves',
  '数据，这些数据进入 AI 上下文后可能通过 prompt 注入泄露': ' data that could leak via prompt injection when in AI context',

  // ── directory-scanner.ts ──
  'scripts/ 中包含疑似二进制或混淆文件': 'scripts/ may contain binary or obfuscated files',
  '包含二进制内容，可能是打包的恶意载荷': ' contains binary content, possibly a bundled malicious payload',
  '无法读取脚本文件': 'Cannot read script file',
  '无法作为文本读取，可能是二进制文件': ' cannot be read as text, may be binary',
  '目录中包含敏感文件': 'Directory contains sensitive file',
  '目录中包含隐藏文件': 'Directory contains hidden file',
  '是隐藏文件，可能无意中包含在 skill 中': ' is a hidden file, may have been unintentionally included',
  '符号链接逃逸到 skill 目录外': 'Symbolic link escapes the skill directory',
  '是一个符号链接，指向目录外的路径': ' is a symbolic link pointing outside the directory',
  '文件引用外部 URL 并可能执行': 'File references external URL with potential execution',
  '中包含 curl/wget 外部 URL 的指令': ' contains curl/wget external URL instructions',
};

/**
 * Translate a Chinese string to English if a translation exists.
 * Falls back to the original string if no translation is found.
 * Handles suffixes like `: some_path` by matching the prefix.
 */
export function t(zh: string, lang: string): string {
  if (lang === 'zh' || lang === 'zh-CN') return zh;

  // 1) Try exact match
  if (ZH_TO_EN[zh]) return ZH_TO_EN[zh];

  // 2) Try suffix after last `"` (handles template `prefix "VAR" suffix` before
  //    `: ` ones because colon-based patterns might also contain quoted vars)
  const lastQuote = zh.lastIndexOf('"');
  if (lastQuote > 0 && lastQuote < zh.length - 1) {
    const rawSuffix = zh.slice(lastQuote + 1);
    const suffix = rawSuffix.trim();
    const leading = rawSuffix.length - suffix.length;
    const varPart = zh.slice(0, lastQuote + 1) + ' '.repeat(leading);
    if (ZH_TO_EN[suffix]) {
      return varPart + ZH_TO_EN[suffix];
    }
  }

  // 3) Try prefix before first `"` (handles `MCP tool "xxx" 描述...` patterns)
  const quoteIdx = zh.indexOf('"');
  if (quoteIdx > 0) {
    const prefix = zh.slice(0, quoteIdx);
    if (ZH_TO_EN[prefix]) {
      return ZH_TO_EN[prefix] + zh.slice(quoteIdx);
    }
  }

  // 4) Try prefix before `: ` (handles file path suffixes like `: .env`)
  const colonIdx = zh.indexOf(': ');
  if (colonIdx > 0) {
    const prefix = zh.slice(0, colonIdx);
    if (ZH_TO_EN[prefix]) {
      return ZH_TO_EN[prefix] + zh.slice(colonIdx);
    }
  }

  return zh;
}
