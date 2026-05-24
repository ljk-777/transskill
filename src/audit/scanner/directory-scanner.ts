import { existsSync, readdirSync, readFileSync, statSync, lstatSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import type { Auditor, AuditFinding } from '../auditor.interface.js';
import type { IntermediateSkill } from '../../core/types.js';
import { InstructionScanner } from './instruction-scanner.js';

/**
 * DirectoryScanner (D)
 *
 * Scans the full skill directory structure for security issues:
 * - Script files in scripts/ (analyzed recursively)
 * - Hidden files and sensitive data
 * - Symbolic link escapes
 * - Cross-file reference chains
 *
 * This auditor runs on the rootPath of a skill directory
 * AND the parsed skill content.
 */
export class DirectoryScanner implements Auditor {
  readonly id = 'directory-scanner';
  readonly name = '目录扫描器 (D)';
  readonly description = '扫描 skill 目录结构中的安全隐患';
  readonly supportsDirectory = true;

  /**
   * Directory audit entry point.
   * The rootPath is passed as the instructions (hacky but works with current arch).
   * In practice, use `auditDirectory()` directly.
   */
  audit(skill: IntermediateSkill, filePath: string): AuditFinding[] {
    // Normal mode: filePath is a file — extract dir from it
    const dirPath = this.locateRoot(skill, filePath);
    if (!dirPath || !existsSync(dirPath) || !statSync(dirPath).isDirectory()) {
      return [];
    }
    return this.auditDirectory(dirPath, filePath);
  }

  /**
   * Full directory audit. Scans all files in the skill directory.
   * Call this directly for directory-mode auditing.
   */
  auditDirectory(rootPath: string, skillFilePath?: string): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const absRoot = resolve(rootPath);

    if (!existsSync(absRoot)) {
      return findings;
    }

    // Collect all files
    const allFiles = this.collectFiles(absRoot);

    for (const file of allFiles) {
      const relPath = relative(absRoot, file);

      // Skip the skill file itself (already analyzed by L1)
      if (skillFilePath && resolve(file) === resolve(skillFilePath)) {
        continue;
      }

      // D-001: Check scripts/ subdirectory
      if (relPath.startsWith('scripts/') || relPath.startsWith('scripts\\')) {
        findings.push(...this.auditScriptFile(file, relPath));
      }

      // D-003: Hidden files
      if (this.isHiddenFile(relPath)) {
        findings.push(...this.checkHiddenFile(file, relPath));
      }

      // D-004: Symbolic link escape
      if (this.isSymlink(file)) {
        findings.push(...this.checkSymlink(file, relPath, absRoot));
      }
    }

    // D-005: Cross-file URL references
    findings.push(...this.checkCrossFileRefs(absRoot, allFiles));

    return findings;
  }

  // ── D-001: Script file audit ──

  private auditScriptFile(filePath: string, relPath: string): AuditFinding[] {
    const findings: AuditFinding[] = [];

    try {
      const ext = filePath.split('.').pop()?.toLowerCase();
      const content = readFileSync(filePath, 'utf-8');

      // Reuse InstructionScanner rules on script content
      const scanner = new InstructionScanner();
      const mockSkill: IntermediateSkill = {
        name: relPath,
        description: '',
        instructions: content,
        metadata: { sourceFormat: '.cursorrules' },
        platformSpecific: {},
      };
      const scriptFindings = scanner.audit(mockSkill, relPath);

      // Re-tag findings with D prefix
      for (const f of scriptFindings) {
        findings.push({
          ...f,
          id: `D-001-${f.id}`,
          filePath: relPath,
        });
      }

      // Check file extension against allowed script types
      const allowedExts = ['sh', 'py', 'js', 'ts', 'bash', 'zsh', 'ps1', 'bat'];
      if (!allowedExts.includes(ext ?? '')) {
        const size = statSync(filePath).size;
        if (size > 0 && size < 1024 * 1024) {
          // Small binary or unusual script
          const header = content.slice(0, 100);
          if (/[\x00-\x08\x0e-\x1f]/.test(header)) {
            findings.push({
              id: 'D-001b',
              severity: 'medium',
              title: 'scripts/ 中包含疑似二进制或混淆文件',
              description: `${relPath} 包含二进制内容，可能是打包的恶意载荷`,
              filePath: relPath,
              recommendation: '检查该文件的真实内容',
            });
          }
        }
      }
    } catch {
      // Binary or unreadable file — flag if suspicious
      try {
        const size = statSync(filePath).size;
        if (size > 0 && size < 10 * 1024 * 1024) {
          findings.push({
            id: 'D-001c',
            severity: 'low',
            title: '无法读取脚本文件',
            description: `${relPath} 无法作为文本读取，可能是二进制文件`,
            filePath: relPath,
            recommendation: '确认该文件是否属于 skill 的必要部分',
          });
        }
      } catch {
        // Skip unreadable
      }
    }

    return findings;
  }

  // ── D-003: Hidden file checks ──

  private isHiddenFile(relPath: string): boolean {
    const parts = relPath.split(/[/\\]/);
    return parts.some((p) => p.startsWith('.') && p.length > 1);
  }

  private checkHiddenFile(filePath: string, relPath: string): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const name = relPath.split(/[/\\]/).pop() ?? '';

    // Check for sensitive hidden files
    const sensitivePatterns = [
      { pattern: /^\.env/, severity: 'high' as const, desc: '环境变量文件，可能包含 API key 和密码' },
      { pattern: /^\.git[^/]*$/, severity: 'high' as const, desc: 'Git 配置目录/文件，可能泄露仓库信息' },
      { pattern: /^\.npmrc/, severity: 'medium' as const, desc: 'npm 配置文件，可能包含认证 token' },
      { pattern: /^\.aws/, severity: 'high' as const, desc: 'AWS 配置目录，可能包含云凭证' },
      { pattern: /^\.ssh/, severity: 'critical' as const, desc: 'SSH 配置目录，可能包含私钥' },
      { pattern: /^\.docker/, severity: 'high' as const, desc: 'Docker 配置目录' },
      { pattern: /^\.kube/, severity: 'high' as const, desc: 'Kubernetes 配置目录，可能包含集群凭证' },
    ];

    for (const sp of sensitivePatterns) {
      if (sp.pattern.test(name)) {
        findings.push({
          id: 'D-003',
          severity: sp.severity,
          title: `目录中包含敏感文件: ${relPath}`,
          description: sp.desc,
          filePath: relPath,
          recommendation: '将敏感配置文件从 skill 目录中移除，使用环境变量引用',
          cwe: 'CWE-522',
        });
        return findings; // One match per file
      }
    }

    // Generic hidden file (non-sensitive)
    if (!relPath.startsWith('.')) {
      findings.push({
        id: 'D-003b',
        severity: 'low',
        title: `目录中包含隐藏文件: ${relPath}`,
        description: `${relPath} 是隐藏文件，可能无意中包含在 skill 中`,
        filePath: relPath,
        recommendation: '确认该文件是否应该包含在 skill 中',
      });
    }

    return findings;
  }

  // ── D-004: Symlink escape ──

  private isSymlink(filePath: string): boolean {
    try {
      return lstatSync(filePath).isSymbolicLink();
    } catch {
      return false;
    }
  }

  private checkSymlink(filePath: string, relPath: string, rootPath: string): AuditFinding[] {
    const findings: AuditFinding[] = [];
    try {
      const realPath = resolve(rootPath, readFileSync(filePath, 'utf-8'));
      const absRoot = resolve(rootPath);

      if (!realPath.startsWith(absRoot)) {
        findings.push({
          id: 'D-004',
          severity: 'high',
          title: '符号链接逃逸到 skill 目录外',
          description: `${relPath} 是一个符号链接，指向目录外的路径: ${realPath}`,
          filePath: relPath,
          recommendation: '移除指向目录外的符号链接，或将目标文件复制到 skill 目录内',
          cwe: 'CWE-59',
        });
      }
    } catch {
      // Can't resolve symlink
    }
    return findings;
  }

  // ── D-005: Cross-file reference chain ──

  private checkCrossFileRefs(rootPath: string, allFiles: string[]): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const urlRegex = /https?:\/\/[^\s'"]+/g;

    for (const file of allFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        const urls = content.match(urlRegex);
        if (!urls) continue;

        for (const url of urls) {
          // Flag URLs that download and execute scripts
          if (/(?:curl|wget)\s+.*(?:https?:\/\/)/i.test(content)) {
            const relPath = relative(rootPath, file);
            findings.push({
              id: 'D-005',
              severity: 'high',
              title: `文件引用外部 URL 并可能执行: ${relPath}`,
              description: `${relPath} 中包含 curl/wget 外部 URL 的指令`,
              filePath: relPath,
              recommendation: '审查该外部 URL 的内容，确保来源可信',
              cwe: 'CWE-494',
            });
            break;
          }
        }
      } catch {
        // Skip binary
      }
    }

    return findings;
  }

  // ── Helpers ──

  private locateRoot(skill: IntermediateSkill, filePath: string): string | null {
    // Try attached files for directory clues
    if (skill.metadata.attachedFiles && skill.metadata.attachedFiles.length > 0) {
      const first = skill.metadata.attachedFiles[0];
      const dir = join(first.absolutePath, '..');
      if (existsSync(dir)) return dir;
    }

    // Try parent of the skill file
    const dir = resolve(filePath, '..');
    if (existsSync(dir)) return dir;

    // Try the file path itself
    if (existsSync(filePath) && statSync(filePath).isDirectory()) return filePath;

    return null;
  }

  private collectFiles(dirPath: string): string[] {
    const files: string[] = [];
    try {
      const entries = readdirSync(dirPath);
      for (const entry of entries) {
        if (entry === '.git' || entry === 'node_modules') continue;
        const fullPath = join(dirPath, entry);
        try {
          if (lstatSync(fullPath).isDirectory()) {
            files.push(...this.collectFiles(fullPath));
          } else {
            files.push(fullPath);
          }
        } catch {
          // Permission denied, skip
        }
      }
    } catch {
      // Can't read, skip
    }
    return files;
  }
}
