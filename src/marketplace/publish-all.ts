/**
 * Publish-all command — batch submit links for all skills in a directory.
 *
 * v2: No file uploads, just adds link entries to registry.json.
 */

import { readFileSync, existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { intro, outro, spinner, log, confirm } from '@clack/prompts';
import chalk from 'chalk';
import matter from 'gray-matter';

const REGISTRY_OWNER = 'ljk-777';
const REGISTRY_REPO = 'transskill-registry';

interface SkillEntry {
  name: string;
  dirPath: string;
  skillMdPath: string;
  frontmatter: Record<string, unknown>;
}

function scanSkills(baseDir: string): SkillEntry[] {
  if (!existsSync(baseDir)) {
    log.error(`Directory not found: ${baseDir}`);
    process.exit(1);
  }

  const entries = readdirSync(baseDir);
  const skills: SkillEntry[] = [];

  for (const entry of entries) {
    const fullPath = join(baseDir, entry);
    if (!statSync(fullPath).isDirectory()) continue;
    const skillMdPath = join(fullPath, 'SKILL.md');
    if (!existsSync(skillMdPath)) continue;

    try {
      const raw = readFileSync(skillMdPath, 'utf-8');
      const parsed = matter(raw);
      const fm = parsed.data as Record<string, unknown>;
      const name = typeof fm.name === 'string' ? fm.name : entry;
      skills.push({ name, dirPath: fullPath, skillMdPath, frontmatter: fm });
    } catch {
      log.warn(`  Skipped ${entry}/SKILL.md (parse error)`);
    }
  }

  return skills;
}

function ensureFrontmatter(skill: SkillEntry, defaultAuthor: string): boolean {
  const fm = skill.frontmatter;
  let modified = false;

  if (!fm.description || typeof fm.description !== 'string') {
    log.warn(`  ${skill.name}: missing description — skipping`);
    return false;
  }
  if (!Array.isArray(fm.tags) || fm.tags.length === 0) {
    fm.tags = [skill.name.split('-')[0] || skill.name];
    modified = true;
  }
  if (!fm.author || typeof fm.author !== 'string') {
    fm.author = defaultAuthor;
    modified = true;
  }
  if (!fm.version || typeof fm.version !== 'string') {
    fm.version = '1.0.0';
    modified = true;
  }

  if (modified) {
    const raw = readFileSync(skill.skillMdPath, 'utf-8');
    const parsed = matter(raw);
    const newContent = matter.stringify(parsed.content, skill.frontmatter);
    writeFileSync(skill.skillMdPath, newContent, 'utf-8');
  }
  return true;
}

export async function publishAllSkills(
  dir: string,
  options: { force?: boolean; dryRun?: boolean; author?: string },
): Promise<void> {
  const baseDir = dir.startsWith('/') ? dir : join(process.cwd(), dir);
  const defaultAuthor = options.author || 'anthropic';

  intro(chalk.green('📤 TransSkill Batch Publish (v2 — links only)'));

  const spin = spinner();
  spin.start(`Scanning ${baseDir}…`);
  const skills = scanSkills(baseDir);
  spin.stop(`Found ${skills.length} skill(s)`);

  if (skills.length === 0) {
    log.info('No skills found');
    outro('Done');
    return;
  }

  console.log('');
  for (const s of skills) {
    const hasTags = Array.isArray(s.frontmatter.tags) && s.frontmatter.tags.length > 0;
    const hasAuthor = typeof s.frontmatter.author === 'string';
    const ok = hasTags && hasAuthor;
    console.log(
      `  ${ok ? chalk.green('✓') : chalk.yellow('~')} ${chalk.bold(s.name)}` +
      `${hasTags ? '' : chalk.gray(' [no tags]')}${hasAuthor ? '' : chalk.gray(' [no author]')}`
    );
  }
  console.log('');

  if (!options.dryRun && !options.force) {
    const proceed = await confirm({
      message: `Submit ${skills.length} link(s) to ${chalk.cyan(`${REGISTRY_OWNER}/${REGISTRY_REPO}`)}?`,
      active: 'Yes',
      inactive: 'No',
      initialValue: false,
    });
    if (!proceed) { outro('Cancelled'); return; }
  }

  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const skill of skills) {
    console.log('');
    console.log(chalk.cyan(`── ${skill.name} ──`));

    if (!ensureFrontmatter(skill, defaultAuthor)) {
      skipped++;
      continue;
    }

    if (options.dryRun) {
      console.log(`  ${chalk.gray('→ would submit link to registry.json')}`);
      succeeded++;
      continue;
    }

    try {
      const { publishSkill } = await import('./publish.js');
      await publishSkill(skill.dirPath, { force: true, dryRun: false });
      succeeded++;
    } catch {
      failed++;
    }
  }

  console.log('');
  console.log(chalk.gray('─'.repeat(40)));
  console.log(`  ${chalk.green(`✓ ${succeeded} submitted`)}${skipped > 0 ? chalk.yellow(`, ${skipped} skipped`) : ''}${failed > 0 ? chalk.red(`, ${failed} failed`) : ''}`);
  outro('Batch publish complete');
}
