import type { Auditor, AuditFinding } from '../auditor.interface.js';
import type { IntermediateSkill, FormatType } from '../../core/types.js';

/**
 * MCPScanner (L3)
 *
 * Deep audit for MCP JSON format files.
 * Checks for tool poisoning, tool shadowing, sensitive data exposure,
 * and other MCP-specific risks aligned with OWASP MCP Top 10.
 */
export class MCPScanner implements Auditor {
  readonly id = 'mcp-scanner';
  readonly name = 'MCP 专项扫描器 (L3)';
  readonly description = '深度审计 MCP JSON 配置中的安全风险';

  readonly supportedFormats: FormatType[] = ['mcp.json'];

  audit(skill: IntermediateSkill, filePath: string): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const mcp = skill.platformSpecific.mcp;

    if (!mcp) {
      // If there's no MCP-specific data but the format is mcp.json,
      // it might be a parse issue — flag as info
      if (skill.instructions) {
        findings.push({
          id: 'L3-INFO',
          severity: 'info',
          title: 'MCP 配置未解析出结构化数据',
          description: '文件被识别为 mcp.json 但未提取出工具和服务器信息',
          filePath,
          recommendation: '检查 MCP JSON 格式是否正确',
        });
      }
      return findings;
    }

    // L3-001: Tool description injection
    if (mcp.tools) {
      for (const tool of mcp.tools) {
        if (!tool.description) continue;

        const desc = tool.description;

        // Check for prompt injection in tool descriptions
        const injectionPatterns = [
          /ignore\s+(?:all\s+)?(?:previous|your|the)\s+(?:instructions?|prompts?)/i,
          /important:\s*(?:disregard|override|forget|ignore)/i,
          /you\s+(?:are|must)\s+(?:now|always)/i,
          /SYSTEM\s+(?:OVERRIDE|MODE|PROMPT)/i,
        ];

        for (const pattern of injectionPatterns) {
          if (pattern.test(desc)) {
            findings.push({
              id: 'L3-001',
              severity: 'critical',
              title: `MCP tool "${tool.name}" 描述中包含 prompt 注入`,
              description: `Tool "${tool.name}" 的 description 字段包含疑似注入内容，可能试图劫持 AI 行为`,
              filePath,
              recommendation: '立即停用该 MCP server，审查 tool 描述的真实用途',
              cwe: 'CWE-940',
            });
            break; // One injection finding per tool
          }
        }

        // L3-003: Suspicious keywords in tool description
        const suspiciousWords = ['urgent', 'override', 'bypass', 'disregard', 'force', 'unrestricted'];
        const foundWords = suspiciousWords.filter((w) =>
          new RegExp(`\\b${w}\\b`, 'i').test(desc),
        );
        if (foundWords.length > 0) {
          findings.push({
            id: 'L3-003',
            severity: 'medium',
            title: `MCP tool "${tool.name}" 描述中包含可疑关键词`,
            description: `描述中出现: ${foundWords.join(', ')}，可能与 prompt 注入或权限绕过相关`,
            filePath,
            recommendation: '审查该 tool 描述是否包含不必要的指令性语言',
          });
        }
      }
    }

    // L3-002: Cross-server tool reference (tool shadowing)
    if (mcp.tools && mcp.tools.length > 1) {
      // Check if one tool's description references another tool by name
      const toolNames = new Set(mcp.tools.map((t) => t.name));
      for (const tool of mcp.tools) {
        if (!tool.description) continue;
        for (const otherName of toolNames) {
          if (
            otherName !== tool.name &&
            new RegExp(`\\b${escapeRegex(otherName)}\\b`, 'i').test(tool.description)
          ) {
            findings.push({
              id: 'L3-002',
              severity: 'high',
              title: `Tool shadowing: "${tool.name}" 引用了其他 tool`,
              description: `Tool "${tool.name}" 的描述中提到了其他 tool "${otherName}"，这可能是一个 tool shadowing 攻击，恶意 server 试图覆盖或干扰另一工具的决策`,
              filePath,
              recommendation: '确保 MCP server 的 tool 描述只描述自身功能，不引用其他 tool',
              cwe: 'CWE-348',
            });
            break;
          }
        }
      }
    }

    // L3-004: Untrusted content exposure
    if (mcp.tools) {
      for (const tool of mcp.tools) {
        if (!tool.description) continue;
        const desc = tool.description.toLowerCase();

        const untrustedIndicators = [
          /fetch|scrape|crawl|read_url|get_url/i,
          /search|query|lookup|retrieve/i,
          /user.?input|user.?content|user.?data/i,
          /public|external|third.?party/i,
        ];

        const matched = untrustedIndicators.filter((p) => p.test(desc));
        if (matched.length >= 2) {
          findings.push({
            id: 'L3-004',
            severity: 'medium',
            title: `MCP tool "${tool.name}" 可能暴露 agent 于不可信内容`,
            description: `Tool 描述暗示该工具会获取外部数据（${matched.length} 个指标匹配）`,
            filePath,
            recommendation: '审查该 tool 的数据来源是否经过验证',
          });
        }
      }
    }

    // L3-005: Sensitive data exposure by tool purpose
    if (mcp.tools) {
      for (const tool of mcp.tools) {
        const nameLower = tool.name.toLowerCase();
        const descLower = (tool.description || '').toLowerCase();

        const sensitiveDomains = [
          { keywords: ['email', 'gmail', 'outlook', 'mail'], label: '邮件', severity: 'high' as const },
          { keywords: ['bank', 'finance', 'transaction', 'payment', 'stripe'], label: '金融', severity: 'critical' as const },
          { keywords: ['password', 'credential', 'secret', 'token', 'vault'], label: '凭据', severity: 'critical' as const },
          { keywords: ['chat', 'message', 'slack', 'discord', 'whatsapp', 'telegram'], label: '聊天记录', severity: 'high' as const },
          { keywords: ['health', 'medical', 'patient', 'hipaa'], label: '医疗', severity: 'critical' as const },
        ];

        for (const domain of sensitiveDomains) {
          if (domain.keywords.some((k) => nameLower.includes(k) || descLower.includes(k))) {
            findings.push({
              id: 'L3-005',
              severity: domain.severity,
              title: `MCP tool "${tool.name}" 访问敏感数据领域: ${domain.label}`,
              description: `Tool "${tool.name}" 涉及 ${domain.label} 数据，这些数据进入 AI 上下文后可能通过 prompt 注入泄露`,
              filePath,
              recommendation: `确保 ${domain.label} 相关 tool 有严格的数据访问控制和审计日志`,
              cwe: 'CWE-200',
            });
            break;
          }
        }
      }
    }

    // L3-007: Destructive capabilities
    if (mcp.tools) {
      for (const tool of mcp.tools) {
        const nameLower = tool.name.toLowerCase();
        const descLower = (tool.description || '').toLowerCase();

        const destructiveIndicators = [
          'shell', 'exec', 'system', 'command', 'bash', 'terminal',
          'delete', 'remove', 'destroy', 'wipe', 'purge',
          'admin', 'sudo', 'root',
        ];

        const found = destructiveIndicators.filter(
          (d) => nameLower.includes(d) || descLower.includes(d),
        );

        if (found.length >= 2) {
          findings.push({
            id: 'L3-007',
            severity: 'high',
            title: `MCP tool "${tool.name}" 可能具有破坏性能力`,
            description: `Tool 名称/描述中包含破坏性关键词: ${found.join(', ')}`,
            filePath,
            recommendation: '对具有破坏性能力的 tool 设置额外的审批流程',
            cwe: 'CWE-276',
          });
        }
      }
    }

    return findings;
  }
}

// ── Helpers ──

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
