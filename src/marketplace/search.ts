/**
 * Interactive search TUI — search and browse skills from the registry.
 */

import { intro, outro, autocomplete, isCancel, log, note, spinner } from '@clack/prompts';
import chalk from 'chalk';
import type { SkillManifest, RegistryIndex } from './types.js';
import { getRegistry, searchSkills } from './registry-client.js';
import { showSkillInfo } from './info.js';

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
 * Show detailed info about a selected skill.
 */
async function showAndOfferInstall(manifest: SkillManifest): Promise<void> {
  await showSkillInfo(manifest.name);
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

  // Step 3: Interactive autocomplete prompt
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

  if (isCancel(result)) {
    outro('Search cancelled');
    return;
  }

  // Step 4: Show details for selected skill
  const selected = result as SkillManifest;
  outro(`Selected ${chalk.bold(selected.name)} v${selected.version}`);
  await showAndOfferInstall(selected);
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
