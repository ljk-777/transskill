import type { AuditReport, Severity } from '../auditor.interface.js';

const COLORS: Record<Severity, string> = {
  critical: '\x1b[1;31m',
  high: '\x1b[33m',
  medium: '\x1b[93m',
  low: '\x1b[32m',
  info: '\x1b[36m',
};
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

const LABELS = {
  en: {
    severity: { critical: 'CRIT', high: 'HIGH', medium: 'MED', low: 'LOW', info: 'INFO' },
    noFindings: 'No findings.',
    noun: (n: number) => ` finding${n !== 1 ? 's' : ''}`,
    sev: { critical: 'critical', high: 'high', medium: 'medium', low: 'low', info: 'info' },
  },
  zh: {
    severity: { critical: '严重', high: '高危', medium: '中危', low: '低危', info: '信息' },
    noFindings: '未发现问题',
    noun: () => '个问题',
    sev: { critical: '严重', high: '高危', medium: '中危', low: '低危', info: '信息' },
  },
};

function getLabels(lang: string) {
  return lang === 'zh' ? LABELS.zh : LABELS.en;
}

/** Render findings in clean one-line-per-finding format */
export function renderConsoleReport(report: AuditReport): string {
  const lines: string[] = [];
  const labels = getLabels(report.lang);

  for (const finding of report.findings) {
    const color = COLORS[finding.severity];
    const label = labels.severity[finding.severity];
    const loc = finding.lineNumber ? `:${finding.lineNumber}` : '';

    lines.push(
      `${finding.filePath}${loc}  ${color}${label}${RESET}  ${BOLD}${finding.id}${RESET}  ${finding.title}`,
    );
  }

  const counts = report.severityCounts;
  const total = report.findings.length;
  const parts: string[] = [];

  if (counts.critical > 0) parts.push(`${counts.critical} ${labels.sev.critical}`);
  if (counts.high > 0) parts.push(`${counts.high} ${labels.sev.high}`);
  if (counts.medium > 0) parts.push(`${counts.medium} ${labels.sev.medium}`);
  if (counts.low > 0) parts.push(`${counts.low} ${labels.sev.low}`);
  if (counts.info > 0) parts.push(`${counts.info} ${labels.sev.info}`);

  lines.push('');
  if (total === 0) {
    lines.push(`${DIM}${labels.noFindings}${RESET}`);
  } else {
    lines.push(`${total}${labels.noun(total)}${parts.length > 0 ? ` (${parts.join(', ')})` : ''}`);
  }

  return lines.join('\n');
}
