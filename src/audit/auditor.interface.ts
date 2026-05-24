import type { FormatType, IntermediateSkill } from '../core/types.js';

// ── Severity ──

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'CRIT',
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
  info: 'INFO',
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

// ── Report ──

export interface AuditReport {
  target: string;
  format: FormatType;
  isDirectory: boolean;
  findings: AuditFinding[];
  severityCounts: Record<Severity, number>;
  lang: string;
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
  /** Output language: 'en' or 'zh' */
  lang?: string;
}
