import type { AuditReport, AuditFinding, Severity } from '../auditor.interface.js';
import { SEVERITY_LABELS } from '../auditor.interface.js';

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

/** Render findings in clean one-line-per-finding format */
export function renderConsoleReport(report: AuditReport): string {
  const lines: string[] = [];

  for (const finding of report.findings) {
    const color = COLORS[finding.severity];
    const label = SEVERITY_LABELS[finding.severity];
    const loc = finding.lineNumber ? `:${finding.lineNumber}` : '';

    lines.push(
      `${finding.filePath}${loc}  ${color}${label}${RESET}  ${BOLD}${finding.id}${RESET}  ${finding.title}`,
    );
  }

  // Summary line
  const counts = report.severityCounts;
  const total = report.findings.length;
  const parts: string[] = [];
  if (counts.critical > 0) parts.push(`${counts.critical} critical`);
  if (counts.high > 0) parts.push(`${counts.high} high`);
  if (counts.medium > 0) parts.push(`${counts.medium} medium`);
  if (counts.low > 0) parts.push(`${counts.low} low`);
  if (counts.info > 0) parts.push(`${counts.info} info`);

  lines.push('');
  if (total === 0) {
    lines.push(`${DIM}No findings.${RESET}`);
  } else {
    lines.push(`${total} finding${total !== 1 ? 's' : ''}${parts.length > 0 ? ` (${parts.join(', ')})` : ''}`);
  }

  return lines.join('\n');
}
