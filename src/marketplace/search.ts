/**
 * Interactive search TUI — search and browse skills from the registry.
 */

import { intro, outro, autocomplete, select, isCancel, log, note, spinner } from '@clack/prompts';
import { createInterface } from 'node:readline';
import chalk from 'chalk';
import type { SkillManifest, RegistryIndex } from './types.js';
import { getRegistry, searchSkills } from './registry-client.js';
import { showSkillInfo } from './info.js';
import { installSkill } from './install.js';

const BRAND = chalk.cyan('◈ TransSkill Marketplace');

/**
 * Format a skill manifest as an autocomplete option label.
 */
function formatSkillOption(s: SkillManifest): string {
  const stars = s.stars > 0 ? chalk.yellow(` ⭐${s.stars}`) : '';
  const audit = s.auditScore >= 90
    ? chalk.green(` ${s.auditScore}`)
    : s.auditScore >= 70
      ? chalk.yellow(` ${s.auditScore}`)
      : chalk.red(` ${s.auditScore}`);
  return `${chalk.bold(s.name)}  ${chalk.gray(`v${s.version}`)}${stars}${audit}  ${s.description}`;
}

/**
 * Custom filter that matches name, description, and tags.
 */
function skillFilter(search: string, option: { label?: string; value: SkillManifest }): boolean {
  if (!search) return true;
  const q = search.toLowerCase();
  const s = option.value;
  return (
    s.name.toLowerCase().includes(q) ||
    s.description.toLowerCase().includes(q) ||
    s.tags.some((t) => t.toLowerCase().includes(q))
  );
}

/**
 * Ask a simple question via readline (for Windows CMD where TUI is broken).
 */
function askQuestion(prompt: string, validOptions: string[]): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const ask = () => {
      rl.question(`${prompt} `, (answer: string) => {
        const trimmed = answer.trim();
        if (validOptions.includes(trimmed)) {
          rl.close();
          resolve(trimmed);
        } else {
          console.log(`  (enter one of: ${validOptions.join(', ')})`);
          ask();
        }
      });
    };
    ask();
  });
}

/**
 * Show action menu after selecting a skill: preview, install, or back.
 * Returns true if the user chose Back (should exit search).
 * Uses select when terminal supports it, falls back to simple Q&A.
 */
async function showAndOfferInstall(manifest: SkillManifest): Promise<boolean> {
  const needsFallback = process.platform === 'win32' && !process.env.WT_SESSION;

  let action: string | symbol;

  if (needsFallback) {
    console.log(`\n  [${manifest.name} v${manifest.version}]`);
    const answer = await askQuestion(
      '  Action (1=Preview, 2=Install, 3=Back):',
      ['1', '2', '3'],
    );
    const map: Record<string, string> = { '1': 'preview', '2': 'install', '3': 'back' };
    action = map[answer];
  } else {
    action = await select({
      message: `Selected ${chalk.bold(manifest.name)} v${manifest.version}`,
      options: [
        { value: 'preview', label: 'Preview  Show full description and README' },
        { value: 'install', label: 'Install  Download and convert to local format' },
        { value: 'back', label: 'Back     Exit search' },
      ],
    });
  }

  if (isCancel(action) || action === 'back') return true; // exit search

  if (action === 'preview') {
    await showSkillInfo(manifest.name);
    return await showAndOfferInstall(manifest); // back to menu
  }

  if (action === 'install') {
    let targetFormat: string;

    if (needsFallback) {
      const answer = await askQuestion(
        '  Format (1=.mdc, 2=.cursorrules, 3=skill.md, 4=claude.md, 5=mcp.json):',
        ['1', '2', '3', '4', '5'],
      );
      const formatMap: Record<string, string> = {
        '1': '.mdc', '2': '.cursorrules', '3': 'skill.md',
        '4': 'claude.md', '5': 'mcp.json',
      };
      targetFormat = formatMap[answer];
    } else {
      const fmt = await select({
        message: 'Select target format:',
        options: [
          { value: '.mdc', label: '.mdc         (Cursor IDE)', hint: 'Supports globs + alwaysApply' },
          { value: '.cursorrules', label: '.cursorrules  (Cursor IDE)', hint: 'Classic Cursor format' },
          { value: 'skill.md', label: 'skill.md     (Universal)', hint: 'Canonical format' },
          { value: 'claude.md', label: 'claude.md    (Claude Code)', hint: 'Claude Code agent skill' },
          { value: 'mcp.json', label: 'mcp.json     (MCP Server)', hint: 'MCP server definition' },
        ],
      });
      if (isCancel(fmt)) return true;
      targetFormat = fmt as string;
    }

    await installSkill(manifest.name, { to: targetFormat, force: false, noTui: true });
    console.log('');
    return false; // continue searching
  }

  return true; // fallback: exit
}

/**
 * Launch interactive search TUI.
 */
export async function interactiveSearch(options: {
  query?: string;
  tag?: string;
  refresh?: boolean;
}): Promise<void> {
  const spin = spinner();

  intro(BRAND);

  // Step 1: Fetch registry
  spin.start('Loading skill registry…');
  let registry: RegistryIndex;
  try {
    registry = await getRegistry(options.refresh ?? false);
    spin.stop(`Loaded ${registry.skills.length} skills from registry`);
  } catch (err: unknown) {
    spin.stop('Failed to load registry');
    const message = err instanceof Error ? err.message : String(err);
    log.error(`Could not reach registry: ${message}`);
    log.info('Check your internet connection or try `transskill info <name>` with a local cache.');
    outro('Search cancelled');
    process.exit(1);
  }

  // Step 2: Pre-filter by tag if specified
  let skills = registry.skills;
  if (options.tag) {
    const tag = options.tag.toLowerCase();
    skills = skills.filter((s) => s.tags.some((t) => t.toLowerCase() === tag));
    if (skills.length === 0) {
      log.warn(`No skills found with tag "${options.tag}"`);
      outro('Search cancelled');
      return;
    }
    log.info(`Filtered by tag: ${chalk.cyan(options.tag)} (${skills.length} skills)`);
  }

  // Step 3: Interactive search loop
  while (true) {
    const result = await autocomplete({
      message: 'Search skills (type to filter, ↑↓ to navigate, Enter to select):',
      options: skills.map((s) => ({
        value: s,
        label: formatSkillOption(s),
        hint: `v${s.version}`,
      })),
      initialUserInput: options.query ?? '',
      filter: skillFilter,
      maxItems: 10,
    });

    if (isCancel(result)) break;

    const selected = result as SkillManifest;
    const shouldExit = await showAndOfferInstall(selected);
    if (shouldExit) break;
    // Install completed → loop restarts search prompt
  }

  outro('Search finished');
}

/**
 * Non-interactive search — output JSON.
 */
export async function jsonSearch(options: {
  query?: string;
  tag?: string;
  refresh?: boolean;
}): Promise<void> {
  let registry: RegistryIndex;
  try {
    registry = await getRegistry(options.refresh ?? false);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ error: message }, null, 2));
    process.exit(1);
  }

  let skills = registry.skills;
  if (options.tag) {
    const tag = options.tag.toLowerCase();
    skills = skills.filter((s) => s.tags.some((t) => t.toLowerCase() === tag));
  }
  if (options.query) {
    skills = searchSkills(registry, options.query);
  }

  process.stdout.write(JSON.stringify({ skills }, null, 2) + '\n');
}
