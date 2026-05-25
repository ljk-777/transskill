/**
 * Install command — download, audit, convert, and write a skill from the registry.
 *
 * Flow:
 *   1. Find skill in registry
 *   2. Download SKILL.md from GitHub raw
 *   3. Parse content
 *   4. Security audit (with --force to skip warnings)
 *   5. Interactive or --to format selection
 *   6. Convert via Mapper + Renderer
 *   7. Write to local file or --dir
 *   8. Record in ~/.transskill/installed.json
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { homedir } from 'node:os';
import { intro, outro, select, spinner, isCancel, log, confirm } from '@clack/prompts';
import chalk from 'chalk';
import type { FormatType, IntermediateSkill } from '../core/types.js';
import { getRegistry, findSkill, getSkillDetail } from './registry-client.js';
import type { SkillManifest, SkillDetail } from './types.js';
import { DefaultMapper } from '../mapper/index.js';
import { getParser } from '../parser/parser-registry.js';
import { getRenderer } from '../renderer/renderer-registry.js';
import { AuditEngine } from '../audit/index.js';
import { ensureDir, displayPath } from '../utils/file-utils.js';
import { writeOutput } from '../utils/file-utils.js';

// ──────────────────────────────────────────────
// Installed skills tracking
// ──────────────────────────────────────────────

const INSTALLED_FILE = join(homedir(), '.transskill', 'installed.json');

interface InstalledRecord {
  name: string;
  version: string;
  format: FormatType;
  outputPath: string;
  installedAt: string;
}

function readInstalled(): InstalledRecord[] {
  if (!existsSync(INSTALLED_FILE)) return [];
  try {
    return JSON.parse(readFileSync(INSTALLED_FILE, 'utf-8')) as InstalledRecord[];
  } catch {
    return [];
  }
}

function writeInstalled(records: InstalledRecord[]): void {
  const dir = join(homedir(), '.transskill');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(INSTALLED_FILE, JSON.stringify(records, null, 2), 'utf-8');
}

function recordInstalled(record: InstalledRecord): void {
  const records = readInstalled().filter((r) => !(r.name === record.name && r.format === record.format));
  records.push(record);
  writeInstalled(records);
}

// ──────────────────────────────────────────────
// Target format helpers
// ──────────────────────────────────────────────

const FORMAT_OPTIONS = [
  { value: '.mdc' as FormatType, label: '.mdc        (Cursor IDE)', hint: 'Supports globs + alwaysApply' },
  { value: '.cursorrules' as FormatType, label: '.cursorrules (Cursor IDE)', hint: 'Classic Cursor format' },
  { value: 'skill.md' as FormatType, label: 'skill.md    (Universal)', hint: 'Canonical format' },
  { value: 'claude.md' as FormatType, label: 'claude.md   (Claude Code)', hint: 'Claude Code agent skill' },
  { value: 'mcp.json' as FormatType, label: 'mcp.json    (MCP Server)', hint: 'MCP server definition' },
];

function isValidFormat(s: string): s is FormatType {
  return FORMAT_OPTIONS.some((o) => o.value === s);
}

// ──────────────────────────────────────────────
// Core install logic
// ──────────────────────────────────────────────

export interface InstallOptions {
  to?: string;
  dir?: string;
  force?: boolean;
  noTui?: boolean;
  version?: string;
  refresh?: boolean;
}

/**
 * Install a skill by name.
 */
export async function installSkill(name: string, options: InstallOptions): Promise<void> {
  const spin = spinner();

  intro(chalk.cyan(`⬇ TransSkill Install`));

  // Step 1: Find skill in registry
  spin.start(`Looking up "${name}"…`);
  const registry = await getRegistry(options.refresh ?? false);
  const manifest = findSkill(registry, name);

  if (!manifest) {
    spin.stop('Not found');
    log.error(`Skill "${name}" was not found in the registry.`);
    log.info('Try `transskill search` to discover available skills.');
    outro('Install cancelled');
    process.exit(1);
  }

  spin.stop(`Found ${chalk.bold(manifest.name)} v${manifest.version}`);
  console.log(`  ${chalk.gray(manifest.description)}`);
  console.log(`  Audit score: ${formatAuditScore(manifest.auditScore)}  |  Stars: ${chalk.yellow(`⭐${manifest.stars}`)}`);
  console.log('');

  // Step 2: Download
  spin.start('Downloading skill…');
  let detail: SkillDetail;
  try {
    detail = await getSkillDetail(manifest);
    spin.stop('Downloaded ✓');
  } catch (err: unknown) {
    spin.stop('Download failed');
    const message = err instanceof Error ? err.message : String(err);
    log.error(`Failed to download: ${message}`);
    outro('Install cancelled');
    process.exit(1);
  }

  // Step 3: Parse SKILL.md content
  spin.start('Parsing skill…');
  const parser = getParser('skill.md');
  const skill: IntermediateSkill = parser.parse(detail.readme, `SKILL.md`);
  spin.stop('Parsed ✓');

  // Show parsed metadata
  if (skill.metadata.tags && skill.metadata.tags.length > 0) {
    console.log(`  Tags: ${skill.metadata.tags.map((t) => chalk.cyan(t)).join(', ')}`);
  }
  console.log('');

  // Step 4: Security audit
  spin.start('Running security audit…');
  const engine = new AuditEngine({ lang: 'en' });
  const report = engine.auditSkill(skill, `registry://${name}/SKILL.md`);
  spin.stop('Audit complete');

  const auditOk = report.severityCounts.critical === 0 && report.severityCounts.high === 0;

  if (report.findings.length > 0) {
    console.log(engine.reportToString(report));
  } else {
    console.log(`  ${chalk.green('✓ No security issues found')}`);
  }

  if (!auditOk && !options.force) {
    if (options.noTui) {
      log.error('Audit found critical or high-severity issues. Use --force to install anyway.');
      outro('Install cancelled');
      process.exit(1);
    }

    const proceed = await confirm({
      message: 'Audit found issues. Install anyway?',
      active: 'Yes, install',
      inactive: 'No, cancel',
      initialValue: false,
    });

    if (isCancel(proceed) || !proceed) {
      outro('Install cancelled');
      return;
    }
  }

  // Step 5: Select target format
  let targetFormat: FormatType;

  if (options.to) {
    if (!isValidFormat(options.to)) {
      log.error(`Unsupported format: "${options.to}"`);
      log.info(`Supported: ${FORMAT_OPTIONS.map((o) => o.value).join(', ')}`);
      outro('Install cancelled');
      process.exit(1);
    }
    targetFormat = options.to as FormatType;
    console.log(`  Format: ${chalk.cyan(targetFormat)}`);
  } else if (options.noTui) {
    targetFormat = '.mdc'; // default for non-interactive
    console.log(`  Format: ${chalk.cyan(targetFormat)} (default)`);
  } else {
    const fmt = await select({
      message: 'Select target format:',
      options: FORMAT_OPTIONS,
    });

    if (isCancel(fmt)) {
      outro('Install cancelled');
      return;
    }

    targetFormat = fmt as FormatType;
  }

  console.log('');

  // Step 6: Convert
  spin.start(`Converting to ${targetFormat}…`);
  const mapper = new DefaultMapper();
  const { skill: mapped, report: conversionReport } = mapper.map(skill, targetFormat);

  const renderer = getRenderer(targetFormat);
  const rendered = renderer.render(mapped);
  spin.stop('Converted ✓');

  if (conversionReport.warnings.length > 0) {
    for (const w of conversionReport.warnings) {
      log.warn(w);
    }
  }

  // Step 7: Write to file
  const outDir = options.dir ? resolve(options.dir) : process.cwd();
  ensureDir(outDir);

  const extMap: Record<string, string> = {
    'skill.md': '.skill.md',
    '.cursorrules': '.cursorrules',
    '.mdc': '.mdc',
    'claude.md': '.claude.md',
    'mcp.json': '.mcp.json',
    'soul.md': '.soul.md',
    'agents.md': '.agents.md',
  };

  const ext = extMap[targetFormat] || `.${targetFormat}`;
  const outName = `${skill.name}${ext}`;
  const outPath = join(outDir, outName);

  writeOutput(outPath, rendered);
  spin.stop('Installed ✓');

  console.log(`  ${chalk.green('→')} ${displayPath(outPath)}`);
  console.log('');

  // Step 8: Record installed
  recordInstalled({
    name: manifest.name,
    version: manifest.version,
    format: targetFormat,
    outputPath: outPath,
    installedAt: new Date().toISOString(),
  });

  outro(`${chalk.bold(manifest.name)} v${manifest.version} installed as ${chalk.cyan(targetFormat)}`);
}

/**
 * Format audit score with color.
 */
function formatAuditScore(score: number): string {
  if (score >= 90) return chalk.green(`${score}/100`);
  if (score >= 70) return chalk.yellow(`${score}/100`);
  return chalk.red(`${score}/100`);
}
