/**
 * Publish-all command — batch publish all skills from a directory to the registry.
 *
 * Scans a directory (e.g. anthropic-skills/skills/) for skill subdirectories,
 * adds default metadata if missing, and publishes each one.
 */

import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
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

/**
 * Scan a directory for skill subdirectories.
 */
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

      // Determine skill name
      const name = typeof fm.name === 'string' ? fm.name : entry;

      skills.push({
        name,
        dirPath: fullPath,
        skillMdPath,
        frontmatter: fm,
      });
    } catch {
      log.warn(`  Skipped ${entry}/SKILL.md (parse error)`);
    }
  }

  return skills;
}

/**
 * Ensure required frontmatter fields exist.
 */
function ensureFrontmatter(skill: SkillEntry, defaultAuthor: string): boolean {
  const fm = skill.frontmatter;
  let modified = false;

  if (!fm.description || typeof fm.description !== 'string') {
    log.warn(`  ${skill.name}: missing description — skipping`);
    return false;
  }

  if (!Array.isArray(fm.tags) || fm.tags.length === 0) {
    // Auto-generate tags from path name
    const autoTags = [skill.name.split('-')[0] || skill.name];
    fm.tags = autoTags;
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

  // Write back if modified
  if (modified) {
    const raw = readFileSync(skill.skillMdPath, 'utf-8');
    const parsed = matter(raw);
    const newContent = matter.stringify(parsed.content, skill.frontmatter);
    writeFileSync(skill.skillMdPath, newContent, 'utf-8');
  }

  return true;
}

/**
 * Publish all skills in a directory.
 */
export async function publishAllSkills(
  dir: string,
  options: { force?: boolean; dryRun?: boolean; author?: string },
): Promise<void> {
  const baseDir = dir.startsWith('/') ? dir : join(process.cwd(), dir);
  const defaultAuthor = options.author || 'anthropic';

  intro(chalk.green('📤 TransSkill Batch Publish'));

  // Step 1: Scan for skills
  const spin = spinner();
  spin.start(`Scanning ${baseDir}…`);
  const skills = scanSkills(baseDir);
  spin.stop(`Found ${skills.length} skill(s)`);

  if (skills.length === 0) {
    log.info('No skills found (directories must contain SKILL.md)');
    outro('Done');
    return;
  }

  // List skills
  console.log('');
  for (const s of skills) {
    const hasTags = Array.isArray(s.frontmatter.tags) && s.frontmatter.tags.length > 0;
    const hasAuthor = typeof s.frontmatter.author === 'string';
    const isComplete = hasTags && hasAuthor;
    console.log(
      `  ${isComplete ? chalk.green('✓') : chalk.yellow('~')} ${chalk.bold(s.name)}` +
      `${hasTags ? '' : chalk.gray(' [no tags]')}` +
      `${hasAuthor ? '' : chalk.gray(' [no author]')}`
    );
  }
  console.log('');

  // Confirm
  if (!options.dryRun && !options.force) {
    const proceed = await confirm({
      message: `Publish ${skills.length} skill(s) to ${chalk.cyan(`${REGISTRY_OWNER}/${REGISTRY_REPO}`)}?`,
      active: 'Yes, publish all',
      inactive: 'No, cancel',
      initialValue: false,
    });

    if (!proceed) {
      outro('Cancelled');
      return;
    }
  }

  // Step 2: Process each skill
  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const skill of skills) {
    console.log('');
    console.log(chalk.cyan(`── ${skill.name} ──`));

    // Ensure frontmatter
    if (!ensureFrontmatter(skill, defaultAuthor)) {
      skipped++;
      continue;
    }

    if (options.dryRun) {
      console.log(`  ${chalk.gray('→ would publish')}`);
      succeeded++;
      continue;
    }

    // Publish via the existing publish flow
    try {
      // Dynamic import to avoid circular dependency
      const { publishSkill } = await import('./publish.js');
      try {
        await publishSkill(skill.dirPath, {
          force: true,
          dryRun: false,
        });
        succeeded++;
      } catch (pErr) {
        // PublishError means messages already printed, just count as failure
        failed++;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error(`  Failed: ${message}`);
      failed++;
    }
  }

  // Summary
  console.log('');
  console.log(chalk.gray('─'.repeat(40)));
  console.log(`  ${chalk.green(`✓ ${succeeded} published`)}${skipped > 0 ? chalk.yellow(`, ${skipped} skipped`) : ''}${failed > 0 ? chalk.red(`, ${failed} failed`) : ''}`);
  outro('Batch publish complete');
}
