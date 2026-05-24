import type { AuditReport, AuditFinding, Severity } from '../auditor.interface.js';

const COLORS: Record<Severity, string> = {
  critical: '\x1b[1;31m', // bold red
  high: '\x1b[33m',       // yellow
  medium: '\x1b[93m',     // bright yellow
  low: '\x1b[32m',        // green
  info: '\x1b[36m',       // cyan
};
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

const EN_LABELS: Record<Severity, string> = {
  critical: 'CRIT',
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
  info: 'INFO',
};

const ZH_LABELS: Record<Severity, string> = {
  critical: '严重',
  high: '高危',
  medium: '中危',
  low: '低危',
  info: '信息',
};

function isChinese(report: AuditReport): boolean {
  return report.findings.length > 0 && /[\u4e00-\u9fff]/.test(report.findings[0].title);
}

/** Render findings in clean one-line-per-finding format */
export function renderConsoleReport(report: AuditReport): string {
  const lines: string[] = [];
  const zh = isChinese(report);
  const labels = zh ? ZH_LABELS : EN_LABELS;

  for (const finding of report.findings) {
    const color = COLORS[finding.severity];
    const label = labels[finding.severity];
    const loc = finding.lineNumber ? `:${finding.lineNumber}` : '';

    lines.push(
      `${finding.filePath}${loc}  ${color}${label}${RESET}  ${BOLD}${finding.id}${RESET}  ${finding.title}`,
    );
  }

  // Summary line
  const counts = report.severityCounts;
  const total = report.findings.length;
  const parts: string[] = [];
  const sevLabels = zh
    ? { critical: '严重', high: '高危', medium: '中危', low: '低危', info: '信息' }
    : { critical: 'critical', high: 'high', medium: 'medium', low: 'low', info: 'info' };

  if (counts.critical > 0) parts.push(`${counts.critical} ${sevLabels.critical}`);
  if (counts.high > 0) parts.push(`${counts.high} ${sevLabels.high}`);
  if (counts.medium > 0) parts.push(`${counts.medium} ${sevLabels.medium}`);
  if (counts.low > 0) parts.push(`${counts.low} ${sevLabels.low}`);
  if (counts.info > 0) parts.push(`${counts.info} ${sevLabels.info}`);

  lines.push('');
  if (total === 0) {
    lines.push(`${DIM}${zh ? '未发现问题' : 'No findings.'}${RESET}`);
  } else {
    const noun = zh ? '个问题' : ` finding${total !== 1 ? 's' : ''}`;
    lines.push(`${total}${noun}${parts.length > 0 ? ` (${parts.join(', ')})` : ''}`);
  }

  return lines.join('\n');
}
