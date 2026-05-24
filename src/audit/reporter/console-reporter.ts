import type { AuditReport, AuditFinding, Severity } from '../auditor.interface.js';
import { SEVERITY_LABELS } from '../auditor.interface.js';

const COLORS: Record<Severity, string> = {
  critical: '\x1b[1;31m', // bold red
  high: '\x1b[33m',       // yellow/orange
  medium: '\x1b[93m',     // bright yellow
  low: '\x1b[32m',        // green
  info: '\x1b[36m',       // cyan
};
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GRAY = '\x1b[90m';

const HEADER_BG = '\x1b[44m';  // blue bg
const HEADER_FG = '\x1b[37m';  // white fg
const RED_BG = '\x1b[41m';
const YELLOW_BG = '\x1b[43m';
const GREEN_BG = '\x1b[42m';

/** Render findings grouped by file, with severity coloring */
export function renderConsoleReport(report: AuditReport): string {
  const lines: string[] = [];

  // ── Header box ──
  const width = 50;
  lines.push('');
  lines.push(formatSeparator('═', width, HEADER_BG, HEADER_FG));
  lines.push(
    padCenter('  🔍 TransSkill Security Audit', width),
  );
  lines.push(formatSeparator('─', width, DIM));
  lines.push(padCenter(`  Target: ${report.target}`, width));
  lines.push(padCenter(`  Format: ${report.format}${report.isDirectory ? ' (directory)' : ''}`, width));
  lines.push(formatSeparator('═', width, HEADER_BG, HEADER_FG));
  lines.push('');

  // ── Group findings by filePath ──
  const grouped = groupBy(report.findings, (f) => f.filePath);

  for (const [filePath, findings] of Object.entries(grouped)) {
    lines.push(`  ${BOLD}📄 ${filePath}${RESET}`);
    lines.push('');

    for (const finding of findings) {
      const color = COLORS[finding.severity];
      const label = SEVERITY_LABELS[finding.severity];
      const loc = finding.lineNumber ? ` (line ${finding.lineNumber})` : '';

      lines.push(`    ${color}${finding.id}${RESET}  ${BOLD}${finding.title}${RESET}${loc}`);

      if (finding.snippet) {
        lines.push(`       ${GRAY}→ ${finding.snippet}${RESET}`);
      }
      if (finding.recommendation) {
        lines.push(`       ${GRAY}💡 ${finding.recommendation}${RESET}`);
      }
      lines.push('');
    }
  }

  // ── Score box ──
  const score = report.score;
  const totalWidth = 50;

  lines.push(formatSeparator('━', totalWidth, DIM));
  lines.push('');

  // Score badge
  const scoreColor = score.level === 'A' || score.level === 'B'
    ? GREEN_BG
    : score.level === 'C'
      ? YELLOW_BG
      : RED_BG;
  const scoreStr = `  ${BOLD}📊 安全评分: ${score.total}/100 (${score.level}级)${RESET}`;
  lines.push(`  ${scoreColor}${scoreStr}${RESET}`);
  lines.push('');
  lines.push(formatLine('🔴 Critical', score.critical, totalWidth));
  lines.push(formatLine('🟠 High', score.high, totalWidth));
  lines.push(formatLine('🟡 Medium', score.medium, totalWidth));
  lines.push(formatLine('🟢 Low', score.low, totalWidth));
  lines.push(formatLine('ℹ️ Info', score.info, totalWidth));

  // Summary
  if (score.level === 'A' || score.level === 'B') {
    lines.push('');
    lines.push(`  ${GREEN_BG}  ✅ ${report.summary}  ${RESET}`);
  } else {
    lines.push('');
    lines.push(`  ${RED_BG}  ⚠️  ${report.summary}  ${RESET}`);
  }

  lines.push(formatSeparator('━', totalWidth, DIM));
  lines.push('');

  return lines.join('\n');
}

// ── Helpers ──

function formatLine(label: string, count: number, totalWidth: number): string {
  const countStr = `${count}`;
  const padding = totalWidth - label.length - countStr.length - 4;
  return `  ${label}${' '.repeat(Math.max(1, padding))}${countStr}`;
}

function padCenter(text: string, width: number): string {
  if (text.length >= width) return text;
  const pad = Math.floor((width - text.length) / 2);
  return ' '.repeat(Math.max(0, pad)) + text;
}

function formatSeparator(char: string, width: number, ...styles: string[]): string {
  return styles.join('') + char.repeat(width) + RESET;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}
