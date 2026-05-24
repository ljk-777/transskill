import type { Auditor, AuditFinding } from '../auditor.interface.js';
import type { IntermediateSkill, FormatType } from '../../core/types.js';

/**
 * PermissionScanner (L2)
 *
 * Scans the platform-specific permission configuration:
 * - .mdc: alwaysApply, globs scope
 * - MCP tools: dangerous operations
 * - Claude-specific: disableModelInvocation, manualOnly
 * - OpenClaw: runtime mode, mount path
 */
export class PermissionScanner implements Auditor {
  readonly id = 'permission-scanner';
  readonly name = '权限扫描器 (L2)';
  readonly description = '检查 skill 声明权限中的安全配置问题';

  readonly supportedFormats: FormatType[] = ['.mdc', 'mcp.json', 'skill.md', '.cursorrules'];

  audit(skill: IntermediateSkill, filePath: string): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const cursor = skill.platformSpecific.cursor;
    const claude = skill.platformSpecific.claude;

    // ── Cursor-specific checks (.mdc) ──
    if (cursor) {
      // L2-001: alwaysApply without scope
      if (cursor.alwaysApply === true && (!cursor.globs || cursor.globs.length === 0)) {
        findings.push({
          id: 'L2-001',
          severity: 'high',
          title: 'alwaysApply 全局生效无范围限制',
          description: '规则设置为 alwaysApply（全局应用）且未指定 globs 范围，会影响所有文件操作',
          filePath,
          recommendation: '为 alwaysApply 规则添加 globs 范围限制',
        });
      }

      // L2-001b: alwaysApply with overly broad globs
      if (
        cursor.alwaysApply === true &&
        cursor.globs &&
        cursor.globs.some((g) => g === '**/*' || g === '**' || g === '*')
      ) {
        findings.push({
          id: 'L2-001b',
          severity: 'medium',
          title: 'alwaysApply 规则 globs 范围过宽',
          description: `alwaysApply 规则使用了宽泛的 globs: ${cursor.globs.filter((g) => g === '**/*' || g === '**' || g === '*').join(', ')}`,
          filePath,
          recommendation: '缩小 globs 范围，限定到特定文件类型或目录',
        });
      }

      // L2-002: overly broad globs (even without alwaysApply)
      if (
        cursor.globs &&
        cursor.globs.some((g) => g === '**/*' || g === '**')
      ) {
        findings.push({
          id: 'L2-002',
          severity: 'low',
          title: 'globs 范围过宽',
          description: `规则作用于所有文件 (**/*)，建议缩小范围`,
          filePath,
          recommendation: '将 globs 限定到特定文件类型，如 "**/*.ts"',
        });
      }
    }

    // ── MCP-specific checks ──
    const mcp = skill.platformSpecific.mcp;
    if (mcp) {
      // L2-003: MCP with shell/exec tools
      if (mcp.tools) {
        for (const tool of mcp.tools) {
          const nameLower = tool.name.toLowerCase();
          const descLower = (tool.description || '').toLowerCase();

          // Dangerous tool names
          const dangerousNames = [
            'shell', 'exec', 'execute', 'system', 'run', 'bash',
            'terminal', 'command', 'sudo', 'rm', 'delete',
          ];
          const isDangerous = dangerousNames.some(
            (n) => nameLower.includes(n) || descLower.includes(n),
          );

          if (isDangerous) {
            findings.push({
              id: 'L2-003',
              severity: 'high',
              title: `MCP tool 可能有危险操作: ${tool.name}`,
              description: `Tool "${tool.name}" 的描述或名称暗示可能执行系统命令或危险操作`,
              filePath,
              recommendation: '审查该 tool 的实际功能，确保操作安全可控',
            });
          }

          // File system tools
          const fileOps = ['readfile', 'writefile', 'deletefile', 'read_file', 'write_file', 'delete_file', 'fs_'];
          const isFileOp = fileOps.some(
            (op) => nameLower.includes(op) || descLower.includes(op),
          );
          if (isFileOp) {
            findings.push({
              id: 'L2-004',
              severity: 'medium',
              title: `MCP tool 涉及文件系统操作: ${tool.name}`,
              description: `Tool "${tool.name}" 可能读写文件系统`,
              filePath,
              recommendation: '确保该 tool 的文件访问有路径限制',
            });
          }

          // Network tools
          const netOps = ['http', 'fetch', 'request', 'webhook', 'network', 'socket', 'api_'];
          const isNetOp = netOps.some(
            (op) => nameLower.includes(op) || descLower.includes(op),
          );
          if (isNetOp) {
            findings.push({
              id: 'L2-005',
              severity: 'low',
              title: `MCP tool 涉及网络访问: ${tool.name}`,
              description: `Tool "${tool.name}" 可能发起网络请求`,
              filePath,
              recommendation: '确保该 tool 的网络访问有 URL 白名单限制',
            });
          }
        }
      }

      // L2-006: MCP with command (stdio)
      if (mcp.command) {
        // Dangerous commands
        const dangerousCmds = ['rm', 'sudo', 'kill', 'shutdown'];
        const cmdName = mcp.command.toLowerCase();
        if (dangerousCmds.some((c) => cmdName.includes(c))) {
          findings.push({
            id: 'L2-003b',
            severity: 'critical',
            title: `MCP server 使用危险命令: ${mcp.command}`,
            description: `MCP server 设置为执行 "${mcp.command}"，可能具有破坏性`,
            filePath,
            recommendation: '审查该 MCP server 的命令是否安全',
          });
        }
      }
    }

    // ── Claude-specific checks ──
    if (claude) {
      if (claude.disableModelInvocation) {
        findings.push({
          id: 'L2-006',
          severity: 'low',
          title: 'Claude skill 禁用了模型调用',
          description: 'disableModelInvocation 为 true，该 skill 不会触发 Claude 模型调用',
          filePath,
          recommendation: '确认这是预期行为（如仅用于提供参考信息）',
        });
      }
    }

    return findings;
  }
}
