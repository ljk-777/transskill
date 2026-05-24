import type {
  Auditor,
  AuditFinding,
  AuditReport,
  AuditOptions,
  Severity,
} from './auditor.interface.js';
import { SEVERITY_ORDER } from './auditor.interface.js';
import { getAuditors } from './auditor-registry.js';
import type { FormatType, IntermediateSkill } from '../core/types.js';
import { renderConsoleReport } from './reporter/console-reporter.js';
import { DirectoryScanner } from './scanner/directory-scanner.js';
import { t } from './locale.js';

/**
 * AuditEngine — the main entry point for security auditing.
 *
 * Flow:
 *   1. Get all registered auditors
 *   2. Filter by options (minSeverity, specific auditors)
 *   3. Run each applicable auditor against the parsed skill
 *   4. Aggregate findings
 *   5. Compute score + generate report
 */
export class AuditEngine {
  private readonly options: Required<AuditOptions>;

  constructor(options: AuditOptions = {}) {
    this.options = {
      minSeverity: options.minSeverity ?? 'info',
      auditors: options.auditors ?? [],
      noDirectory: options.noDirectory ?? false,
      lang: options.lang ?? 'en',
    };
  }

  /**
   * Audit a single parsed skill file.
   */
  auditSkill(
    skill: IntermediateSkill,
    filePath: string,
    target?: string,
  ): AuditReport {
    const auditors = this.resolveAuditors(skill.metadata.sourceFormat);
    const findings: AuditFinding[] = [];

    for (const auditor of auditors) {
      try {
        const result = auditor.audit(skill, filePath);
        findings.push(...result);
      } catch (err) {
        findings.push({
          id: 'ERR',
          severity: 'info',
          title: `Auditor "${auditor.id}" 执行出错`,
          description: String(err),
          filePath,
          recommendation: '检查 auditor 实现是否正确',
        });
      }
    }

    return this.buildReport(findings, target ?? filePath, skill.metadata.sourceFormat, false);
  }

  /**
   * Audit a skill directory, including file-level and directory-level checks.
   */
  auditDirectory(
    skill: IntermediateSkill,
    rootPath: string,
    skillFilePath: string,
    target?: string,
  ): AuditReport {
    const auditors = this.resolveAuditors(skill.metadata.sourceFormat);
    const findings: AuditFinding[] = [];

    // Run all applicable auditors on the parsed skill
    for (const auditor of auditors) {
      try {
        const result = auditor.audit(skill, skillFilePath);
        findings.push(...result);
      } catch (err) {
        findings.push({
          id: 'ERR',
          severity: 'info',
          title: `Auditor "${auditor.id}" 执行出错`,
          description: String(err),
          filePath: skillFilePath,
          recommendation: '检查 auditor 实现是否正确',
        });
      }
    }

    // Run directory-specific scanner
    const dirScanner = new DirectoryScanner();
    try {
      const dirFindings = dirScanner.auditDirectory(rootPath, skillFilePath);
      findings.push(...dirFindings);
    } catch (err) {
      // Directory scan is best-effort
    }

    return this.buildReport(findings, target ?? rootPath, skill.metadata.sourceFormat, true);
  }

  /**
   * Run all auditors and return the report object.
   */
  run(
    skill: IntermediateSkill,
    filePath: string,
    isDirectory: boolean,
  ): AuditReport {
    return this.auditSkill(skill, filePath, filePath);
  }

  /**
   * Generate console-friendly report string.
   */
  reportToString(report: AuditReport): string {
    return renderConsoleReport(report);
  }

  /**
   * Generate JSON report string.
   */
  reportToJson(report: AuditReport, pretty = true): string {
    return JSON.stringify(report, null, pretty ? 2 : undefined);
  }

  private resolveAuditors(format: FormatType): Auditor[] {
    const all = getAuditors();
    let filtered = all;

    // Filter by format support
    filtered = filtered.filter(
      (a) =>
        !a.supportedFormats ||
        a.supportedFormats.length === 0 ||
        a.supportedFormats.includes(format),
    );

    // Filter by specific auditors if requested
    if (this.options.auditors.length > 0) {
      filtered = filtered.filter((a) => this.options.auditors.includes(a.id));
    }

    return filtered;
  }

  private buildReport(
    findings: AuditFinding[],
    target: string,
    format: FormatType,
    isDirectory: boolean,
  ): AuditReport {
    const lang = this.options.lang || 'en';

    // Apply severity filter
    const minIdx = SEVERITY_ORDER.indexOf(this.options.minSeverity);
    const filtered = findings.filter((f) => {
      const idx = SEVERITY_ORDER.indexOf(f.severity);
      return idx <= minIdx; // higher severity = lower index
    });

    // Translate findings if needed
    const translated = lang !== 'zh' ? filtered.map((f) => ({
      ...f,
      title: t(f.title, lang),
      description: t(f.description, lang),
      recommendation: f.recommendation ? t(f.recommendation, lang) : undefined,
    })) : filtered;

    // Count by severity
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const f of translated) {
      counts[f.severity]++;
    }

    return {
      target,
      format,
      isDirectory,
      findings: translated,
      severityCounts: counts,
      timestamp: new Date().toISOString(),
    };
  }
}
