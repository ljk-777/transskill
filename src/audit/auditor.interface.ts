import type { FormatType, IntermediateSkill } from '../core/types.js';

// ── Severity ──

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 25,
  high: 10,
  medium: 4,
  low: 1,
  info: 0,
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: '🔴 Critical',
  high: '🟠 High',
  medium: '🟡 Medium',
  low: '🟢 Low',
  info: 'ℹ️ Info',
};

// ── Finding ──

export interface AuditFinding {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  filePath: string;
  lineNumber?: number;
  snippet?: string;
  recommendation?: string;
  cwe?: string;
}

// ── Score ──

export type ScoreLevel = 'A' | 'B' | 'C' | 'D' | 'F';

export interface SecurityScore {
  total: number; // 0-100
  level: ScoreLevel;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export function computeScore(
  critical: number,
  high: number,
  medium: number,
  low: number,
  _info: number,
): SecurityScore {
  const raw =
    100 -
    critical * SEVERITY_WEIGHTS.critical -
    high * SEVERITY_WEIGHTS.high -
    medium * SEVERITY_WEIGHTS.medium -
    low * SEVERITY_WEIGHTS.low;
  const total = Math.max(0, Math.min(100, raw));

  let level: ScoreLevel;
  if (total >= 90) level = 'A';
  else if (total >= 70) level = 'B';
  else if (total >= 50) level = 'C';
  else if (total >= 30) level = 'D';
  else level = 'F';

  return { total, level, critical, high, medium, low, info: _info };
}

// ── Report ──

export interface AuditReport {
  target: string;
  format: FormatType;
  isDirectory: boolean;
  findings: AuditFinding[];
  score: SecurityScore;
  summary: string;
  timestamp: string; // ISO 8601
}

// ── Auditor Interface ──

export interface Auditor {
  /** Unique auditor identifier */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Description of what this auditor checks */
  readonly description: string;
  /** Which format(s) this auditor supports (empty = all) */
  readonly supportedFormats?: FormatType[];
  /** Run audit on a parsed skill */
  audit(skill: IntermediateSkill, filePath: string): AuditFinding[];
  /** Whether this auditor can handle directory-level checks */
  readonly supportsDirectory?: boolean;
}

// ── Audit Options ──

export interface AuditOptions {
  /** Minimum severity to report */
  minSeverity?: Severity;
  /** Specific auditor IDs to run (empty = all) */
  auditors?: string[];
  /** Skip directory-level checks */
  noDirectory?: boolean;
}
