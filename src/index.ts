#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { registerResolver, LocalResolver, GitHubResolver, resolveInput } from './resolver/index.js';
import { registerParser, SKILLMdParser, CursorRulesParser, MdcParser, MCPJsonParser, SOULMdParser, ClaudeMDParser, getRegisteredFormats } from './parser/index.js';
import { DefaultMapper } from './mapper/index.js';
import { registerRenderer, SKILLMdRenderer, CursorRulesRenderer, MdcRenderer, MCPJsonRenderer, ClaudeMDRenderer, getRegisteredRenderers } from './renderer/index.js';
import { registerAuditor } from './audit/auditor-registry.js';
import { InstructionScanner } from './audit/scanner/instruction-scanner.js';
import { PermissionScanner } from './audit/scanner/permission-scanner.js';
import { DirectoryScanner } from './audit/scanner/directory-scanner.js';
import { MCPScanner } from './audit/scanner/mcp-scanner.js';
import { AuditEngine } from './audit/index.js';
import { detectFormatFromPath } from './utils/format-detector.js';
import { writeOutput, ensureDir, displayPath } from './utils/file-utils.js';
import { scanSkillDirectory, skillDirToAttachedFiles } from './utils/directory-scanner.js';
import type { FormatType, SkillDirectory } from './core/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

// ============================================================
// Bootstrap: register all plugins
// ============================================================

registerResolver(new GitHubResolver());
registerResolver(new LocalResolver());

registerParser(new SKILLMdParser());
registerParser(new CursorRulesParser());
registerParser(new MdcParser());
registerParser(new MCPJsonParser());
registerParser(new SOULMdParser());
registerParser(new ClaudeMDParser());

const mapper = new DefaultMapper();

registerRenderer(new SKILLMdRenderer());
registerRenderer(new CursorRulesRenderer());
registerRenderer(new MdcRenderer());
registerRenderer(new MCPJsonRenderer());
registerRenderer(new ClaudeMDRenderer());

// ============================================================
// Register auditors
// ============================================================

registerAuditor(new InstructionScanner());
registerAuditor(new PermissionScanner());
registerAuditor(new DirectoryScanner());
registerAuditor(new MCPScanner());

// ============================================================
// CLI
// ============================================================

const program = new Command();

program
  .name('transskill')
  .description('Cross-platform AI agent skill converter - Write once, run on any agent')
  .version(pkg.version);

program
  .command('convert <input>')
  .description('Convert a skill file/directory/GitHub repo to another format')
  .requiredOption('-t, --to <format>', 'Target format (skill.md, .cursorrules, .mdc, mcp.json, claude.md)')
  .option('-o, --output <path>', 'Output directory (default: current directory)')
  .option('--install-to <path>', 'Install directly to target agent config directory')
  .option('--glob <pattern>', 'File glob pattern (for .mdc output)')
  .option('--always-apply', 'Always apply rule (for .mdc output)')
  .option('--dry-run', 'Preview what would happen without actually writing')
  .option('-v, --verbose', 'Show detailed conversion report')
  .action(async (input, options) => {
    try {
      console.log(`\n🔄 TransSkill v${pkg.version}`);
      console.log(`${'─'.repeat(40)}`);

      // Step 1: Resolve input
      const resolved = await resolveInput(input);

      if (options.verbose) {
        console.log(`  Source:      ${resolved.isRemote ? 'GitHub (remote)' : 'Local'}`);
        console.log(`  Path:        ${resolved.localPath}`);
        console.log(`  Type:        ${resolved.type}`);
      }

      // Step 2: Detect format
      const { format: sourceFormat, isDirectory } = detectFormatFromPath(resolved.localPath);
      const targetFormat = options.to as FormatType;

      console.log(`  From:        ${sourceFormat}${isDirectory ? ' (directory)' : ''}`);
      console.log(`  To:          ${targetFormat}`);

      // Step 3: Get parser and renderer
      const { getParser } = await import('./parser/parser-registry.js');
      const { getRenderer } = await import('./renderer/renderer-registry.js');

      const parser = getParser(sourceFormat);
      const renderer = getRenderer(targetFormat);

      if (options.dryRun) {
        console.log(`\n${'─'.repeat(40)}`);
        console.log(`DRY RUN - no files will be written`);
        console.log(`${'─'.repeat(40)}`);
        console.log(`  Pipeline:    ${sourceFormat} → ${targetFormat}`);
        console.log(`  Input:       ${input}`);
        console.log(`  Source file: ${resolved.localPath}`);
        if (options.output) console.log(`  Output:      ${options.output}`);
        if (options.installTo) console.log(`  Install to:  ${options.installTo}`);
        if (options.glob) console.log(`  Glob:        ${options.glob}`);
        if (options.alwaysApply) console.log(`  Always apply: yes`);
        console.log(`${'─'.repeat(40)}\n`);
        console.log('Dry-run complete. Remove --dry-run to execute.\n');

        if (resolved.cleanup) await resolved.cleanup();
        return;
      }

      // Step 4: Determine output path
      const cwd = options.installTo || options.output || process.cwd();
      ensureDir(cwd);

      // Step 5: Process
      if (isDirectory) {
        // Directory mode — scan and parse
        const skillDir = scanSkillDirectory(resolved.localPath);
        const attachedFiles = skillDirToAttachedFiles(skillDir);

        const { readInput } = await import('./utils/file-utils.js');
        const content = readInput(skillDir.skillFile);
        const skill = parser.parse(content, skillDir.skillFile);

        // Preserve attached files metadata through the pipeline
        if (attachedFiles.length > 0) {
          skill.metadata.attachedFiles = attachedFiles;
        }

        // Apply mapper
        const { skill: mapped, report } = mapper.map(skill, targetFormat);

        // Apply CLI options to mapped skill
        if (options.glob && mapped.platformSpecific.cursor) {
          mapped.platformSpecific.cursor.globs = [options.glob];
        }
        if (options.alwaysApply && mapped.platformSpecific.cursor) {
          mapped.platformSpecific.cursor.alwaysApply = true;
        }

        // Render directory
        if (renderer.renderDirectory) {
          const result = renderer.renderDirectory(skillDir, mapped, cwd);
          console.log(`\n${'─'.repeat(40)}`);
          console.log('Directory conversion complete');
          console.log(`  Main:        ${displayPath(result.mainOutput)}`);
          for (const copied of result.copiedFiles) {
            console.log(`  Copied:      ${displayPath(copied)}`);
          }
          for (const skipped of result.skippedFiles) {
            console.log(`  Skipped:   ${displayPath(skipped)}`);
          }
        } else {
          // Fallback: single file output for directory input
          const outPath = join(cwd, `${skillDir.name}${renderer.extension}`);
          writeOutput(outPath, renderer.render(mapped));
          console.log(`\nConverted: ${displayPath(outPath)}`);
        }

        // Show report
        if (report.warnings.length > 0) {
          console.log('');
          for (const w of report.warnings) {
            console.log(`  Warning: ${w}`);
          }
        }
        if (options.verbose && report.lost.length > 0) {
          console.log(`\n  Lost fields: ${report.lost.join(', ')}`);
        }
      } else {
        // File mode
        const { readInput } = await import('./utils/file-utils.js');
        const content = readInput(resolved.localPath);
        const skill = parser.parse(content, resolved.localPath);

        // Apply mapper
        const { skill: mapped, report } = mapper.map(skill, targetFormat);

        // Apply CLI options
        if (options.glob && mapped.platformSpecific.cursor) {
          mapped.platformSpecific.cursor.globs = [options.glob];
        }
        if (options.alwaysApply && mapped.platformSpecific.cursor) {
          mapped.platformSpecific.cursor.alwaysApply = true;
        }

        // Render
        const rendered = renderer.render(mapped);
        const { basename, extname } = await import('node:path');
        const outName = basename(resolved.localPath, extname(resolved.localPath)) + renderer.extension;
        const outPath = join(cwd, outName);
        writeOutput(outPath, rendered);

        console.log(`\n${'─'.repeat(40)}`);
        console.log('Conversion complete');
        console.log(`  Output:      ${displayPath(outPath)}`);

        if (report.warnings.length > 0) {
          console.log('');
          for (const w of report.warnings) {
            console.log(`  Warning: ${w}`);
          }
        }
        if (options.verbose && report.lost.length > 0) {
          console.log(`\n  Lost fields: ${report.lost.join(', ')}`);
        }
      }

      console.log('');

      // Cleanup
      if (resolved.cleanup) await resolved.cleanup();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\nError: ${message}\n`);
      process.exit(1);
    }
  });

program
  .command('list-formats')
  .description('List all supported input/output formats')
  .action(() => {
    console.log('\nSupported formats:\n');
    console.log('   Input → Output');
    console.log('   ────────────────');
    console.log('   SKILL.md    → .cursorrules, .mdc');
    console.log('   .cursorrules → SKILL.md, .mdc');
    console.log('   .mdc        → SKILL.md, .cursorrules');
    console.log('   MCP JSON    → SKILL.md, .cursorrules, .mdc, claude.md');
    console.log('   SOUL.md     → SKILL.md, .cursorrules, .mdc, claude.md');
    console.log('   CLAUDE.md   → SKILL.md, .cursorrules, .mdc, mcp.json, claude.md');
    console.log('');
    console.log('   Input sources:');
    console.log('     ./file           Local file');
    console.log('     ./dir/           Local skill directory');
    console.log('     gh:user/repo     GitHub repository');
    console.log('     https://github.com/user/repo  GitHub URL');
    console.log('');
    console.log(`   Parsers:  ${getRegisteredFormats().join(', ')}`);
    console.log(`   Renderers: ${getRegisteredRenderers().map((r) => r.format).join(', ')}`);
    console.log('');
    console.log('   Security audit:');
    console.log('     transskill audit <file|dir> [options]');
    console.log('     Scan skill files for security issues (L1: instructions, L2: permissions, L3: MCP)');
    console.log('');
    console.log('   Audit options:');
    console.log('     --format <type>    Output format: console | json');
    console.log('     --quiet            Only show summary score');
    console.log('     --min-severity     Minimum severity: info | low | medium | high | critical');
    console.log('     --auditor <id>     Run specific auditor only');
    console.log('');
  });

program
  .command('diff <input>')
  .description('Preview what would be lost when converting between formats')
  .requiredOption('-t, --to <format>', 'Target format to check against')
  .option('-v, --verbose', 'Show detailed field-level mapping')
  .action(async (input, options) => {
    try {
      const resolved = await resolveInput(input);
      const { detectFormatFromPath } = await import('./utils/format-detector.js');
      const { readInput } = await import('./utils/file-utils.js');
      const { getParser } = await import('./parser/parser-registry.js');

      const { format: sourceFormat, isDirectory } = detectFormatFromPath(resolved.localPath);
      const targetFormat = options.to;

      let content: string;
      let skill;
      const parser = getParser(sourceFormat);

      if (isDirectory) {
        const { scanSkillDirectory, skillDirToAttachedFiles } = await import('./utils/directory-scanner.js');
        const skillDir = scanSkillDirectory(resolved.localPath);
        content = readInput(skillDir.skillFile);
        skill = parser.parse(content, skillDir.skillFile);
        const attached = skillDirToAttachedFiles(skillDir);
        if (attached.length > 0) {
          skill.metadata.attachedFiles = attached;
        }
      } else {
        content = readInput(resolved.localPath);
        skill = parser.parse(content, resolved.localPath);
      }

      const mapper = new DefaultMapper();
      const { skill: mapped, report } = mapper.map(skill, targetFormat);

      console.log('');
      console.log(`  ${'─'.repeat(50)}`);
      console.log(`  Conversion Impact Report`);
      console.log(`  ${'─'.repeat(50)}`);
      console.log(`  ${sourceFormat}${isDirectory ? ' (directory)' : ''}`);
      console.log(`  →`);
      console.log(`  ${targetFormat}`);
      console.log(`  ${'─'.repeat(50)}`);
      console.log(`  Preserved: ${report.preserved.length > 0 ? report.preserved.join(', ') : '(nothing specific)'}`);
      console.log(`  Lost:      ${report.lost.length > 0 ? report.lost.join(', ') : '(none)'}`);
      console.log('');

      if (report.warnings.length > 0) {
        console.log('  Warnings:');
        for (const w of report.warnings) {
          console.log(`     • ${w}`);
        }
        console.log('');
      }

      // Check for attached files
      if (skill.metadata.attachedFiles && skill.metadata.attachedFiles.length > 0) {
        const count = skill.metadata.attachedFiles.length;
        if (targetFormat === '.cursorrules') {
          console.log(`   ${count} attached file(s) will be copied alongside the output`);
          console.log(`     (scripts, references, assets are preserved as sidecar files)`);
        } else {
          console.log(`   ${count} attached file(s) will be preserved`);
        }
        console.log('');
      }

      console.log(`  ${'─'.repeat(50)}`);
      console.log('');

      if (resolved.cleanup) await resolved.cleanup();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`
Error: Diff failed: ${message}
`);
      process.exit(1);
    }
  });

program
  .command('validate <input>')
  .description('Validate a skill file or directory')
  .option('-f, --format <format>', 'Specify input format (auto-detected if omitted)')
  .action(async (input, _options) => {
    try {
      console.log(`\nValidating: ${input}`);

      const resolved = await resolveInput(input);
      console.log(`  Resolved:    ${resolved.localPath}`);
      console.log(`  Type:        ${resolved.type}`);

      if (resolved.type === 'directory') {
        const { getParser, detectFormat } = await import('./parser/parser-registry.js');
        const parser = getParser('skill.md');
        const dir = parser.parseDirectory(resolved.localPath);
        console.log(`  Skill:       ${dir.name}`);
        console.log(`  SKILL.md:    ${dir.skillFile}`);
        if (dir.scriptsDir) console.log(`  Scripts:     ${dir.scriptsDir}`);
        if (dir.referencesDir) console.log(`  References:  ${dir.referencesDir}`);
        if (dir.assetsDir) console.log(`  Assets:      ${dir.assetsDir}`);
      } else {
        const { readInput } = await import('./utils/file-utils.js');
        const content = readInput(resolved.localPath);
        const { detectFormat } = await import('./parser/parser-registry.js');
        const format = detectFormat(content, resolved.localPath);
        if (format) {
          console.log(`  Format:      ${format}`);
        } else {
          console.log(`  Format:      unknown (use --format to specify)`);
        }
      }

      console.log('\nValidation passed.\n');

      if (resolved.cleanup) await resolved.cleanup();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\nError: Validation failed: ${message}\n`);
      process.exit(1);
    }
  });

program
  .command('audit <input>')
  .description('Security audit a skill file or directory')
  .option('--min-severity <level>', 'Minimum severity to report (info, low, medium, high, critical)', 'info')
  .option('--auditor <id>', 'Run specific auditor only (can be repeated)', (val: string, acc: string[]) => { acc.push(val); return acc; }, [])
  .option('--format <type>', 'Output format: console or json', 'console')
  .option('--quiet', 'Only show summary score')
  .option('-v, --verbose', 'Show detailed findings')
  .option('--lang <lang>', 'Output language: en or zh', 'en')
  .action(async (input, options) => {
    try {
      const resolved = await resolveInput(input);
      const { detectFormatFromPath } = await import('./utils/format-detector.js');
      const { readInput } = await import('./utils/file-utils.js');
      const { getParser } = await import('./parser/parser-registry.js');

      const { format: sourceFormat, isDirectory } = detectFormatFromPath(resolved.localPath);

      // Parse skill
      let skill;
      const parser = getParser(sourceFormat);
      if (isDirectory) {
        const { scanSkillDirectory, skillDirToAttachedFiles } = await import('./utils/directory-scanner.js');
        const skillDir = scanSkillDirectory(resolved.localPath);
        const content = readInput(skillDir.skillFile);
        skill = parser.parse(content, skillDir.skillFile);
        const attached = skillDirToAttachedFiles(skillDir);
        if (attached.length > 0) skill.metadata.attachedFiles = attached;
      } else {
        const content = readInput(resolved.localPath);
        skill = parser.parse(content, resolved.localPath);
      }

      // Run audit
      const severityMap: Record<string, any> = {
        info: 'info', low: 'low', medium: 'medium', high: 'high', critical: 'critical',
      };
      const engine = new AuditEngine({
        minSeverity: severityMap[options.minSeverity] || 'info',
        auditors: options.auditor,
        lang: options.lang || 'en',
      });

      const report = isDirectory
        ? engine.auditDirectory(skill, resolved.localPath, resolved.localPath, input)
        : engine.auditSkill(skill, resolved.localPath, input);

      // Output
      if (options.format === 'json') {
        console.log(engine.reportToJson(report));
      } else if (options.quiet) {
        const c = report.severityCounts;
        console.log(`${report.findings.length} findings (${c.critical} crit, ${c.high} high, ${c.medium} med, ${c.low} low)`);
      } else {
        console.log(engine.reportToString(report));
      }

      if (resolved.cleanup) await resolved.cleanup();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\nError: Audit failed: ${message}\n`);
      process.exit(1);
    }
  });

program
  .command('info <name>')
  .description('Show detailed info about a skill from the registry')
  .action(async (name) => {
    try {
      const { showSkillInfo } = await import('./marketplace/info.js');
      await showSkillInfo(name);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\nError: ${message}\n`);
      process.exit(1);
    }
  });

program
  .command('search [query]')
  .description('Interactively search and browse skills from the registry')
  .option('--refresh', 'Force refresh registry cache')
  .option('--tag <tag>', 'Filter by tag')
  .option('--json', 'Output as JSON (non-interactive)')
  .action(async (query, options) => {
    try {
      if (options.json) {
        const { jsonSearch } = await import('./marketplace/search.js');
        await jsonSearch({ query, tag: options.tag, refresh: options.refresh });
      } else {
        const { interactiveSearch } = await import('./marketplace/search.js');
        await interactiveSearch({ query, tag: options.tag, refresh: options.refresh });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\nError: ${message}\n`);
      process.exit(1);
    }
  });

program
  .command('install <name>')
  .description('Install a skill from the registry: download → audit → convert → write')
  .option('--to <format>', 'Target format (.mdc, .cursorrules, skill.md, claude.md, mcp.json)')
  .option('--dir <path>', 'Output directory (default: current directory)')
  .option('--force', 'Skip security warnings')
  .option('--no-tui', 'Non-interactive mode (uses defaults)')
  .option('--refresh', 'Force refresh registry cache')
  .action(async (name, options) => {
    try {
      const { installSkill } = await import('./marketplace/install.js');
      await installSkill(name, {
        to: options.to,
        dir: options.dir,
        force: options.force ?? false,
        noTui: options.noTui ?? false,
        refresh: options.refresh ?? false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\nError: ${message}\n`);
      process.exit(1);
    }
  });

program
  .command('publish [path]')
  .description('Publish a skill directory to the registry (requires GITHUB_TOKEN)')
  .option('--force', 'Skip audit score check')
  .option('--dry-run', 'Audit only, do not publish')
  .action(async (path, options) => {
    try {
      const { publishSkill } = await import('./marketplace/publish.js');
      await publishSkill(path || '.', {
        force: options.force ?? false,
        dryRun: options.dryRun ?? false,
      });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && (err as Record<string, unknown>).name === 'PublishError') {
        process.exit(1);
      }
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\nError: ${message}\n`);
      process.exit(1);
    }
  });

program
  .command('publish-all [dir]')
  .description('Batch publish all skills from a directory to the registry')
  .option('--force', 'Skip confirmation')
  .option('--dry-run', 'Audit only, do not publish')
  .option('--author <name>', 'Default author name for skills missing it', 'anthropic')
  .action(async (dir, options) => {
    try {
      const { publishAllSkills } = await import('./marketplace/publish-all.js');
      await publishAllSkills(dir || '.', {
        force: options.force ?? false,
        dryRun: options.dryRun ?? false,
        author: options.author,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\nError: ${message}\n`);
      process.exit(1);
    }
  });

program
  .command('list-installed')
  .alias('ls')
  .description('List all installed skills')
  .action(async () => {
    const { readFileSync, existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { homedir } = await import('node:os');
    const installedFile = join(homedir(), '.transskill', 'installed.json');
    if (!existsSync(installedFile)) {
      console.log('No skills installed yet.');
      return;
    }
    try {
      const records = JSON.parse(readFileSync(installedFile, 'utf-8'));
      if (records.length === 0) {
        console.log('No skills installed yet.');
        return;
      }
      console.log('\nInstalled skills:\n');
      for (const r of records) {
        console.log(`  ${r.name} v${r.version}  → ${r.format}  (${r.installedAt.slice(0, 10)})`);
        console.log(`    ${r.outputPath}`);
      }
      console.log('');
    } catch {
      console.log('Could not read installed.json.');
    }
  });

program.parse();
