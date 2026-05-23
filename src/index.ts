#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

program
  .name('transskill')
  .description('Cross-platform AI agent skill converter')
  .version(pkg.version);

program
  .command('convert <input>')
  .description('Convert a skill file/directory to another format')
  .requiredOption('-t, --to <format>', 'Target format')
  .option('-o, --output <path>', 'Output directory (default: current directory)')
  .option('--install-to <path>', 'Install directly to target agent config directory')
  .option('--glob <pattern>', 'File glob pattern (for .mdc output)')
  .option('--always-apply', 'Always apply rule (for .mdc output)')
  .option('--dry-run', 'Show what would be done without actually writing')
  .option('-v, --verbose', 'Show detailed conversion report')
  .action(async (input, options) => {
    console.log('🔄 TransSkill - converting', input, 'to', options.to);
    // TODO: Phase 4 - implement convert command
  });

program
  .command('list-formats')
  .description('List all supported input/output formats')
  .action(() => {
    console.log('📦 Supported formats:');
    console.log('   SKILL.md');
    console.log('   .cursorrules');
    console.log('   .mdc');
    console.log('   MCP JSON');
    // TODO: read from registry
  });

program
  .command('validate <input>')
  .description('Validate a skill file/directory format')
  .option('-f, --format <format>', 'Specify format (auto-detected if omitted)')
  .action(async (input, options) => {
    console.log('🔍 Validating:', input);
    // TODO: Phase 4 - implement validate command
  });

program.parse();
