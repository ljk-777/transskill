#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { registerResolver, LocalResolver, GitHubResolver, resolveInput } from './resolver/index.js';
import { registerParser, SKILLMdParser, CursorRulesParser, MdcParser, getRegisteredFormats } from './parser/index.js';
import { DefaultMapper } from './mapper/index.js';
import { registerRenderer, SKILLMdRenderer, CursorRulesRenderer, MdcRenderer, getRegisteredRenderers } from './renderer/index.js';
import { detectFormatFromPath } from './utils/format-detector.js';
import { writeOutput, ensureDir, displayPath } from './utils/file-utils.js';
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

const mapper = new DefaultMapper();

registerRenderer(new SKILLMdRenderer());
registerRenderer(new CursorRulesRenderer());
registerRenderer(new MdcRenderer());

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
  .requiredOption('-t, --to <format>', 'Target format (skill.md, .cursorrules, .mdc)')
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
        console.log(`🔍 DRY RUN - no files will be written`);
        console.log(`${'─'.repeat(40)}`);
        console.log(`  Pipeline:    ${sourceFormat} → ${targetFormat}`);
        console.log(`  Input:       ${input}`);
        console.log(`  Source file: ${resolved.localPath}`);
        if (options.output) console.log(`  Output:      ${options.output}`);
        if (options.installTo) console.log(`  Install to:  ${options.installTo}`);
        if (options.glob) console.log(`  Glob:        ${options.glob}`);
        if (options.alwaysApply) console.log(`  Always apply: yes`);
        console.log(`${'─'.repeat(40)}\n`);
        console.log('✅ Dry-run complete. Remove --dry-run to execute.\n');

        if (resolved.cleanup) await resolved.cleanup();
        return;
      }

      // Step 4: Determine output path
      const cwd = options.installTo || options.output || process.cwd();
      ensureDir(cwd);

      // Step 5: Process
      if (isDirectory) {
        // Directory mode
        const skillDir = parser.parseDirectory(resolved.localPath);

        // Read and parse SKILL.md
        const { readInput } = await import('./utils/file-utils.js');
        const content = readInput(skillDir.skillFile);
        const skill = parser.parse(content, skillDir.skillFile);

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
          console.log('✅ Directory conversion complete');
          console.log(`  Main:        ${displayPath(result.mainOutput)}`);
          for (const copied of result.copiedFiles) {
            console.log(`  Copied:      ${displayPath(copied)}`);
          }
          for (const skipped of result.skippedFiles) {
            console.log(`  ⚠️  Skipped:   ${displayPath(skipped)}`);
          }
        } else {
          // Fallback: single file output for directory input
          const outPath = join(cwd, `${skillDir.name}${renderer.extension}`);
          writeOutput(outPath, renderer.render(mapped));
          console.log(`\n✅ Converted: ${displayPath(outPath)}`);
        }

        // Show report
        if (report.warnings.length > 0) {
          console.log('');
          for (const w of report.warnings) {
            console.log(`  ⚠️  ${w}`);
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
        console.log('✅ Conversion complete');
        console.log(`  Output:      ${displayPath(outPath)}`);

        if (report.warnings.length > 0) {
          console.log('');
          for (const w of report.warnings) {
            console.log(`  ⚠️  ${w}`);
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
      console.error(`\n❌ Error: ${message}\n`);
      process.exit(1);
    }
  });

program
  .command('list-formats')
  .description('List all supported input/output formats')
  .action(() => {
    console.log('\n📦 Supported formats:\n');
    console.log('   Input → Output');
    console.log('   ────────────────');
    console.log('   SKILL.md    → .cursorrules, .mdc');
    console.log('   .cursorrules → SKILL.md, .mdc');
    console.log('   .mdc        → SKILL.md, .cursorrules');
    console.log('   MCP JSON    → SKILL.md');
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
  });

program
  .command('validate <input>')
  .description('Validate a skill file or directory')
  .option('-f, --format <format>', 'Specify input format (auto-detected if omitted)')
  .action(async (input, _options) => {
    try {
      console.log(`\n🔍 Validating: ${input}`);

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

      console.log('\n✅ Validation passed - input looks valid.\n');

      if (resolved.cleanup) await resolved.cleanup();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n❌ Validation failed: ${message}\n`);
      process.exit(1);
    }
  });

program.parse();
