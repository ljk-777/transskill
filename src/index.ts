#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { registerResolver, LocalResolver, GitHubResolver, resolveInput } from './resolver/index.js';
import { registerParser, SKILLMdParser, CursorRulesParser, MdcParser, getRegisteredFormats } from './parser/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

// ============================================================
// Bootstrap: register all resolvers and parsers
// ============================================================

registerResolver(new GitHubResolver());
registerResolver(new LocalResolver());

registerParser(new SKILLMdParser());
registerParser(new CursorRulesParser());
registerParser(new MdcParser());

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
  .option('--dry-run', 'Show what would be done without actually writing')
  .option('-v, --verbose', 'Show detailed conversion report')
  .action(async (input, options) => {
    try {
      console.log(`🔄 TransSkill v${pkg.version}`);
      console.log(`   Converting: ${input}`);
      console.log(`   Target:     ${options.to}`);

      if (options['dry-run']) {
        console.log(`\n${'─'.repeat(40)}`);
        console.log(`🔍 DRY RUN - no files will be written`);
        console.log(`${'─'.repeat(40)}`);
        console.log(`   Input:       ${input}`);
        console.log(`   Target:      ${options.to}`);
        if (options.output) console.log(`   Output:      ${options.output}`);
        if (options.installTo) console.log(`   Install to:  ${options.installTo}`);
        if (options.glob) console.log(`   Glob:        ${options.glob}`);
        if (options.alwaysApply) console.log(`   Always apply: yes`);
        console.log(`${'─'.repeat(40)}\n`);
        console.log('✅ Dry-run complete. Pass --dry-run to see what would happen.');
        return;
      }

      // Step 1: Resolve input source
      const resolved = await resolveInput(input);

      if (options.verbose) {
        console.log(`   Source:      ${resolved.isRemote ? 'GitHub (remote)' : 'Local'}`);
        console.log(`   Path:        ${resolved.localPath}`);
        console.log(`   Type:        ${resolved.type}`);
      }

      // TODO: Step 2-5 - parse, map, render, write
      console.log(`\n   ⏳ Conversion pipeline not yet implemented.`);
      console.log(`   See tasks.md Phase 2-4 for remaining work.\n`);

      // Cleanup remote temp files
      if (resolved.cleanup) {
        await resolved.cleanup();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n❌ Error: ${message}`);
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
    console.log('\n   Input sources: local file, local directory, GitHub (gh:user/repo)');
    console.log(`   Registered parsers: ${getRegisteredFormats().join(', ')}\n`);
  });

program
  .command('validate <input>')
  .description('Validate a skill file or directory')
  .option('-f, --format <format>', 'Specify input format (auto-detected if omitted)')
  .action(async (input, options) => {
    try {
      console.log(`🔍 Validating: ${input}`);

      const resolved = await resolveInput(input);
      console.log(`   Resolved:    ${resolved.localPath}`);
      console.log(`   Type:        ${resolved.type}`);
      console.log('\n✅ Validation passed - input looks valid.');

      if (resolved.cleanup) {
        await resolved.cleanup();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n❌ Validation failed: ${message}`);
      process.exit(1);
    }
  });

program.parse();
