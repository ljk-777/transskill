import type { Auditor, AuditFinding } from '../auditor.interface.js';
import type { IntermediateSkill } from '../../core/types.js';
import { DANGEROUS_COMMAND_RULES } from '../rules/dangerous-commands.js';
import { PROMPT_INJECTION_RULES } from '../rules/prompt-injection.js';
import { URL_PATTERNS } from '../rules/suspicious-urls.js';

/**
 * InstructionScanner (L1)
 *
 * Scans the instructions body of any skill format for:
 * - Dangerous shell commands (rm -rf, sudo, etc.)
 * - Remote code execution patterns (curl|sh, eval)
 * - Prompt injection / jailbreak attempts
 * - Suspicious URL references
 * - Base64/hex encoded commands
 */
export class InstructionScanner implements Auditor {
  readonly id = 'instruction-scanner';
  readonly name = '指令扫描器 (L1)';
  readonly description = '扫描 skill 指令中的危险命令、prompt 注入、网络外链等';

  audit(skill: IntermediateSkill, filePath: string): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const instructions = skill.instructions;

    if (!instructions || instructions.trim().length === 0) {
      return findings;
    }

    const lines = instructions.split('\n');

    // 1) Check dangerous command patterns
    for (const rule of DANGEROUS_COMMAND_RULES) {
      const match = instructions.match(rule.pattern);
      if (match) {
        const lineNumber = findLineNumber(lines, match.index ?? 0);
        findings.push({
          id: rule.id,
          severity: rule.severity,
          title: rule.description.length > 60
            ? rule.description.slice(0, 60) + '…'
            : rule.description,
          description: rule.description,
          filePath,
          lineNumber,
          snippet: extractSnippet(lines, lineNumber),
          recommendation: rule.recommendation,
          cwe: rule.cwe,
        });
      }
    }

    // 2) Check prompt injection patterns
    for (const rule of PROMPT_INJECTION_RULES) {
      const match = instructions.match(rule.pattern);
      if (match) {
        const lineNumber = findLineNumber(lines, match.index ?? 0);
        findings.push({
          id: rule.id,
          severity: rule.severity,
          title: rule.description.length > 60
            ? rule.description.slice(0, 60) + '…'
            : rule.description,
          description: rule.description,
          filePath,
          lineNumber,
          snippet: extractSnippet(lines, lineNumber),
          recommendation: rule.recommendation,
          cwe: rule.cwe,
        });
      }
    }

    // 3) Check for base64/hex encoding (potential obfuscation)
    findings.push(...this.checkEncoding(instructions, filePath, lines));

    // 4) Check for suspicious URLs
    for (const rule of URL_PATTERNS) {
      const match = instructions.match(rule.pattern);
      if (match) {
        const lineNumber = findLineNumber(lines, match.index ?? 0);
        findings.push({
          id: rule.id,
          severity: rule.severity,
          title: rule.description,
          description: rule.description,
          filePath,
          lineNumber,
          snippet: extractSnippet(lines, lineNumber),
          recommendation: rule.recommendation,
        });
      }
    }

    return findings;
  }

  private checkEncoding(
    instructions: string,
    filePath: string,
    lines: string[],
  ): AuditFinding[] {
    const findings: AuditFinding[] = [];

    // Detect base64 decode then execute patterns
    const b64Exec = /(?:base64\s*-d|base64\s*--decode|frombase64)\s*[|;]\s*(?:sh|bash|python|node)\b/i;
    const b64Match = instructions.match(b64Exec);
    if (b64Match) {
      findings.push({
        id: 'L1-008a',
        severity: 'high',
        title: 'Base64 解码后执行，可能隐藏恶意指令',
        description: '对 base64 编码内容解码后执行，可能用于隐藏恶意载荷',
        filePath,
        lineNumber: findLineNumber(lines, b64Match.index ?? 0),
        snippet: extractSnippet(lines, findLineNumber(lines, b64Match.index ?? 0)),
        recommendation: '审查解码后的实际内容是否安全',
        cwe: 'CWE-693',
      });
    }

    // Detect long base64 strings embedded in commands
    const longB64 = /['"][A-Za-z0-9+/=]{100,}['"]/g;
    let b64StringMatch: RegExpExecArray | null;
    while ((b64StringMatch = longB64.exec(instructions)) !== null) {
      // Only flag if it looks like it's being used somehow (near a command)
      const ctxStart = Math.max(0, b64StringMatch.index - 60);
      const ctxEnd = Math.min(instructions.length, b64StringMatch.index + b64StringMatch[0].length + 60);
      const context = instructions.slice(ctxStart, ctxEnd);
      const suspiciousContext =
        /\b(run|exec|eval|decode|execute|load|import|source)\b/i.test(context);
      if (suspiciousContext) {
        findings.push({
          id: 'L1-008b',
          severity: 'medium',
          title: '指令中包含长 base64 编码字符串',
          description: '疑似编码混淆，可能隐藏恶意载荷',
          filePath,
          lineNumber: findLineNumber(lines, b64StringMatch.index),
          snippet: extractSnippet(lines, findLineNumber(lines, b64StringMatch.index)),
          recommendation: '审查 base64 解码后的内容',
          cwe: 'CWE-693',
        });
      }
    }

    return findings;
  }
}

// ── Helpers ──

function findLineNumber(lines: string[], charIndex: number): number {
  let pos = 0;
  for (let i = 0; i < lines.length; i++) {
    pos += lines[i].length + 1; // +1 for newline
    if (pos > charIndex) return i + 1; // 1-indexed
  }
  return lines.length;
}

function extractSnippet(lines: string[], lineNumber: number): string {
  const idx = lineNumber - 1;
  if (idx < 0 || idx >= lines.length) return '';
  const line = lines[idx].trim();
  return line.length > 120 ? line.slice(0, 120) + '…' : line;
}
