/**
 * Publish command — audit, fork, and PR a skill to the registry.
 *
 * Flow:
 *   1. Validate skill directory (SKILL.md + frontmatter)
 *   2. Parse + audit (mandatory, score >= 90 unless --force)
 *   3. GitHub API: fork → branch → upload SKILL.md → update registry.json → PR
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, basename, dirname, relative } from 'node:path';
import { intro, outro, spinner, log } from '@clack/prompts';
import chalk from 'chalk';
import matter from 'gray-matter';
import type { IntermediateSkill, SkillDirectory } from '../core/types.js';
import { AuditEngine } from '../audit/index.js';
import { getParser } from '../parser/parser-registry.js';
import { writeOutput } from '../utils/file-utils.js';

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const REGISTRY_OWNER = 'ljk-777';
const REGISTRY_REPO = 'transskill-registry';
const REGISTRY_FULL = `${REGISTRY_OWNER}/${REGISTRY_REPO}`;
const GITHUB_API = 'https://api.github.com';

// ──────────────────────────────────────────────
// GitHub API helpers
// ──────────────────────────────────────────────

function getToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('');
    log.error('GITHUB_TOKEN environment variable not set.');
    log.info('Create a token at https://github.com/settings/tokens');
    log.info('Then set: export GITHUB_TOKEN=ghp_xxx');
    console.error('');
    process.exit(1);
  }
  return token;
}

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'transskill-cli',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function ghFetch(url: string, token: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...ghHeaders(token),
      ...(options.headers as Record<string, string>),
    },
  });
  return res;
}

/**
 * Get the authenticated user's GitHub login.
 */
async function getGitHubUser(token: string): Promise<string> {
  const res = await ghFetch(`${GITHUB_API}/user`, token);
  if (!res.ok) {
    throw new Error(`Failed to authenticate: ${res.status} ${res.statusText}`);
  }
  const data = await res.json() as { login: string };
  return data.login;
}

/**
 * Get the default branch of the registry repo.
 */
async function getDefaultBranch(token: string): Promise<{ name: string; sha: string }> {
  const res = await ghFetch(`${GITHUB_API}/repos/${REGISTRY_FULL}`, token);
  if (!res.ok) throw new Error(`Failed to get repo info: ${res.status}`);
  const data = await res.json() as { default_branch: string };
  const branch = data.default_branch;

  // Get the SHA of the latest commit on the default branch
  const refRes = await ghFetch(
    `${GITHUB_API}/repos/${REGISTRY_FULL}/git/ref/heads/${branch}`,
    token,
  );
  if (!refRes.ok) throw new Error(`Failed to get branch ref: ${refRes.status}`);
  const refData = await refRes.json() as { object: { sha: string } };

  return { name: branch, sha: refData.object.sha };
}

/**
 * Create a fork of the registry repo (no-op if already exists).
 */
async function ensureFork(token: string, user: string): Promise<void> {
  // Check if fork exists
  const checkRes = await ghFetch(`${GITHUB_API}/repos/${user}/${REGISTRY_REPO}`, token);
  if (checkRes.ok) {
    // Fork exists
    return;
  }

  log.info('Creating fork of transskill-registry…');
  const res = await ghFetch(`${GITHUB_API}/repos/${REGISTRY_FULL}/forks`, token, {
    method: 'POST',
    body: JSON.stringify({}),
  });

  if (res.status === 202) {
    log.info('Fork creation in progress (this may take a few seconds)…');
    // Wait for fork to be ready
    let ready = false;
    let attempts = 0;
    while (!ready && attempts < 30) {
      await new Promise((r) => setTimeout(r, 2000));
      const check = await ghFetch(`${GITHUB_API}/repos/${user}/${REGISTRY_REPO}`, token);
      if (check.ok) ready = true;
      attempts++;
    }
    if (!ready) throw new Error('Timed out waiting for fork to be created');
  } else if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Failed to fork repo: ${res.status} ${(body as { message?: string }).message || res.statusText}`);
  }
}

/**
 * Create or update a file in the fork via GitHub API.
 */
async function upsertFile(
  token: string,
  user: string,
  branch: string,
  path: string,
  content: string,
  message: string,
): Promise<void> {
  // Try to get existing file SHA
  let existingSha: string | undefined;
  const getRes = await ghFetch(
    `${GITHUB_API}/repos/${user}/${REGISTRY_REPO}/contents/${path}?ref=${branch}`,
    token,
  );

  if (getRes.ok) {
    const data = await getRes.json() as { sha: string };
    existingSha = data.sha;
  }

  // Base64 encode content
  const base64 = Buffer.from(content, 'utf-8').toString('base64');

  const body: Record<string, unknown> = {
    message,
    content: base64,
    branch,
  };

  if (existingSha) {
    body.sha = existingSha;
  }

  const res = await ghFetch(
    `${GITHUB_API}/repos/${user}/${REGISTRY_REPO}/contents/${path}`,
    token,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      `Failed to write ${path}: ${res.status} ${(errBody as { message?: string }).message || res.statusText}`,
    );
  }
}

/**
 * Create a pull request.
 */
async function createPR(
  token: string,
  user: string,
  branch: string,
  title: string,
  body: string,
): Promise<string> {
  const res = await ghFetch(
    `${GITHUB_API}/repos/${REGISTRY_FULL}/pulls`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        title,
        body,
        head: `${user}:${branch}`,
        base: 'main',
      }),
    },
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      `Failed to create PR: ${res.status} ${(errBody as { message?: string }).message || res.statusText}`,
    );
  }

  const data = await res.json() as { html_url: string; number: number };
  return data.html_url;
}

// ──────────────────────────────────────────────
// Publish logic
// ──────────────────────────────────────────────

export interface PublishOptions {
  force?: boolean;
  dryRun?: boolean;
}

/**
 * Publish a skill directory to the registry.
 */
export async function publishSkill(skillPath: string, options: PublishOptions): Promise<void> {
  const spin = spinner();

  intro(chalk.green('📤 TransSkill Publish'));

  // Step 1: Resolve and validate skill directory
  const skillDirPath = skillPath.startsWith('/')
    ? skillPath
    : join(process.cwd(), skillPath);

  if (!existsSync(skillDirPath)) {
    log.error(`Path does not exist: ${skillDirPath}`);
    outro('Publish cancelled');
    process.exit(1);
  }

  const stat = statSync(skillDirPath);
  if (!stat.isDirectory()) {
    log.error(`Expected a directory, got a file: ${skillDirPath}`);
    log.info('Usage: transskill publish ./my-skill/');
    outro('Publish cancelled');
    process.exit(1);
  }

  // Check for SKILL.md
  const skillMdPath = join(skillDirPath, 'SKILL.md');
  if (!existsSync(skillMdPath)) {
    log.error(`Directory does not contain SKILL.md: ${skillDirPath}`);
    log.info('A valid skill directory must have a SKILL.md file with frontmatter.');
    outro('Publish cancelled');
    process.exit(1);
  }

  // Step 2: Parse and validate frontmatter
  spin.start('Validating SKILL.md…');
  let skill: IntermediateSkill;
  let rawContent: string;
  let skillDir: SkillDirectory;
  let frontmatter: Record<string, unknown>;

  try {
    rawContent = readFileSync(skillMdPath, 'utf-8');
    const parsed = matter(rawContent);
    frontmatter = parsed.data as Record<string, unknown>;

    const parser = getParser('skill.md');
    skill = parser.parse(rawContent, skillMdPath);

    // Also scan directory structure
    skillDir = parser.parseDirectory(skillDirPath);

    // Validate required frontmatter
    if (!frontmatter.description || typeof frontmatter.description !== 'string') {
      throw new Error('"description" field is required in frontmatter');
    }
    if (!Array.isArray(frontmatter.tags)) {
      throw new Error('"tags" field is required and must be an array');
    }
    if (frontmatter.tags.length === 0) {
      throw new Error('"tags" array must have at least one tag');
    }

    spin.stop('Validated ✓');

    console.log(`  Name:        ${chalk.bold(skill.name)}`);
    console.log(`  Description: ${skill.description}`);
    if (frontmatter.version) {
      console.log(`  Version:     ${frontmatter.version}`);
    }
    console.log(`  Tags:        ${(frontmatter.tags as string[]).map((t: string) => chalk.cyan(t)).join(', ')}`);
    console.log('');
  } catch (err: unknown) {
    spin.stop('Validation failed');
    const message = err instanceof Error ? err.message : String(err);
    log.error(`Invalid skill: ${message}`);
    outro('Publish cancelled');
    process.exit(1);
  }

  // Step 3: Security audit (mandatory)
  spin.start('Running security audit…');
  const engine = new AuditEngine({ lang: 'en' });
  const report = engine.auditSkill(skill, skillMdPath);

  const score = calculateScore(report);
  spin.stop(`Audit complete — score: ${formatScore(score)}`);

  if (report.findings.length > 0) {
    console.log(engine.reportToString(report));
  } else {
    console.log(`  ${chalk.green('✓ No security issues found')}`);
  }
  console.log('');

  if (score < 90 && !options.force) {
    log.error(`Audit score ${score}/100 is below the minimum of 90.`);
    log.info('Fix the issues or use --force to publish anyway.');
    outro('Publish cancelled');
    process.exit(1);
  }

  // Dry run — stop here
  if (options.dryRun) {
    outro(chalk.yellow('Dry run — no changes made. Use without --dry-run to publish.'));
    return;
  }

  // Step 4: GitHub API — authenticate and publish
  spin.start('Connecting to GitHub…');
  let token: string;
  let user: string;
  let baseBranch: string;
  let baseSha: string;

  try {
    token = getToken();
    user = await getGitHubUser(token);
    const base = await getDefaultBranch(token);
    baseBranch = base.name;
    baseSha = base.sha;
    spin.stop(`Authenticated as ${chalk.bold(user)}`);
    console.log(`  Registry:    ${chalk.cyan(REGISTRY_FULL)}`);
    console.log('');
  } catch (err: unknown) {
    spin.stop('GitHub connection failed');
    const message = err instanceof Error ? err.message : String(err);
    log.error(message);
    outro('Publish cancelled');
    process.exit(1);
  }

  // Step 5: Fork
  spin.start('Setting up fork…');
  try {
    await ensureFork(token, user);
    spin.stop('Fork ready ✓');
  } catch (err: unknown) {
    spin.stop('Fork failed');
    const message = err instanceof Error ? err.message : String(err);
    log.error(message);
    outro('Publish cancelled');
    process.exit(1);
  }

  // Step 6: Create branch
  const branchName = `skill/${skill.name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()}`;
  spin.start(`Creating branch ${chalk.cyan(branchName)}…`);

  try {
    const branchRes = await ghFetch(
      `${GITHUB_API}/repos/${user}/${REGISTRY_REPO}/git/refs`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: baseSha,
        }),
      },
    );

    if (branchRes.status === 422) {
      log.info(`Branch ${branchName} already exists — updating it`);
    } else if (!branchRes.ok) {
      throw new Error(`Failed to create branch: ${branchRes.status}`);
    }

    spin.stop('Branch ready ✓');
  } catch (err: unknown) {
    spin.stop('Branch creation failed');
    const message = err instanceof Error ? err.message : String(err);
    log.error(message);
    outro('Publish cancelled');
    process.exit(1);
  }

  // Step 7: Upload files
  const skillDirName = skill.name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
  const skillRepoPath = `skills/${skillDirName}/SKILL.md`;

  spin.start('Uploading SKILL.md…');
  try {
    await upsertFile(
      token,
      user,
      branchName,
      skillRepoPath,
      rawContent,
      `Add ${skill.name} v${((frontmatter as Record<string, unknown>).version as string) || '1.0.0'} skill`,
    );
    spin.stop('SKILL.md uploaded ✓');
  } catch (err: unknown) {
    spin.stop('Upload failed');
    const message = err instanceof Error ? err.message : String(err);
    log.error(message);
    outro('Publish cancelled');
    process.exit(1);
  }

  // Upload extra files if any (scripts, assets, references, etc.)
  const extraDirNames = ['scripts', 'assets', 'references'] as const;
  for (const dirName of extraDirNames) {
    const dirPath = join(skillDirPath, dirName);
    if (existsSync(dirPath) && statSync(dirPath).isDirectory()) {
      spin.start(`Uploading ${dirName}/…`);
      try {
        const entries = readdirSync(dirPath);
        for (const entry of entries) {
          const entryPath = join(dirPath, entry);
          if (statSync(entryPath).isFile()) {
            const content = readFileSync(entryPath, 'utf-8');
            const repoEntryPath = `skills/${skillDirName}/${dirName}/${entry}`;
            await upsertFile(
              token,
              user,
              branchName,
              repoEntryPath,
              content,
              `Add ${dirName}/${entry}`,
            );
          }
        }
        spin.stop(`${dirName}/ uploaded ✓`);
      } catch (err: unknown) {
        spin.stop(`${dirName}/ upload issue`);
        const message = err instanceof Error ? err.message : String(err);
        log.warn(`Failed to upload ${dirName}/: ${message}`);
      }
    }
  }

  // Step 8: Update registry.json
  spin.start('Updating registry index…');

  try {
    // Fetch current registry.json from the branch (or upstream)
    const currentRegRes = await ghFetch(
      `${GITHUB_API}/repos/${user}/${REGISTRY_REPO}/contents/registry.json?ref=${branchName}`,
      token,
    );

    let registry: { $schema: string; updated: string; skills: Array<Record<string, unknown>> };

    if (currentRegRes.ok) {
      const currentData = await currentRegRes.json() as { content: string; sha: string };
      const decoded = Buffer.from(currentData.content, 'base64').toString('utf-8');
      registry = JSON.parse(decoded);
    } else {
      // Fallback: fetch from upstream
      const upRes = await ghFetch(
        `https://raw.githubusercontent.com/${REGISTRY_FULL}/main/registry.json`,
        token,
        { headers: { 'User-Agent': 'transskill-cli' } },
      );
      if (!upRes.ok) throw new Error('Failed to fetch registry.json');
      registry = await upRes.json() as typeof registry;
    }

    // Update or add the skill entry
    const existingIdx = registry.skills.findIndex((s) => s.name === skill.name);
    const skillEntry = {
      name: skill.name,
      version: (frontmatter as Record<string, unknown>).version || '1.0.0',
      description: skill.description,
      tags: (frontmatter as Record<string, unknown>).tags || [],
      author: user,
      stars: existingIdx >= 0 ? (registry.skills[existingIdx].stars as number) : 0,
      auditScore: score,
      created: existingIdx >= 0
        ? (registry.skills[existingIdx].created as string)
        : new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      registry.skills[existingIdx] = { ...registry.skills[existingIdx], ...skillEntry };
    } else {
      registry.skills.push(skillEntry);
    }

    registry.updated = new Date().toISOString();

    const registryJson = JSON.stringify(registry, null, 2);

    await upsertFile(
      token,
      user,
      branchName,
      'registry.json',
      registryJson,
      `Update registry index: add ${skill.name}`,
    );

    spin.stop('Registry index updated ✓');
  } catch (err: unknown) {
    spin.stop('Registry update failed');
    const message = err instanceof Error ? err.message : String(err);
    log.error(message);
    outro('Publish cancelled');
    process.exit(1);
  }

  // Step 9: Create PR
  spin.start('Creating pull request…');

  try {
    const prBody = [
      `## 📦 ${skill.name}`,
      '',
      `${skill.description}`,
      '',
      '---',
      '',
      '### Audit Report',
      '',
      `- **Audit Score:** ${score}/100`,
      `- **Author:** ${user}`,
      ...(Array.isArray((frontmatter as Record<string, unknown>).tags)
        ? [`- **Tags:** ${((frontmatter as Record<string, unknown>).tags as string[]).join(', ')}`]
        : []),
      '',
      '---',
      '',
      '> Published by [TransSkill CLI](https://github.com/ljk-777/transskill)',
    ].join('\n');

    const prUrl = await createPR(
      token,
      user,
      branchName,
      `Add skill: ${skill.name} v${(frontmatter as Record<string, unknown>).version || '1.0.0'}`,
      prBody,
    );

    spin.stop('Pull request created ✓');
    console.log('');
    console.log(`  ${chalk.green('→')} ${prUrl}`);
    console.log('');

    outro(`${chalk.bold(skill.name)} published! 🎉`);
  } catch (err: unknown) {
    spin.stop('PR creation failed');
    const message = err instanceof Error ? err.message : String(err);
    log.error(message);
    outro('Publish failed — files were pushed to the branch but PR could not be created.');
    process.exit(1);
  }
}

/**
 * Calculate audit score from report severity counts.
 */
function calculateScore(report: { severityCounts: { critical: number; high: number; medium: number; low: number; info: number } }): number {
  const c = report.severityCounts;
  let score = 100;
  score -= c.critical * 30;  // -30 each
  score -= c.high * 15;      // -15 each
  score -= c.medium * 5;     // -5 each
  score -= c.low * 2;        // -2 each
  return Math.max(0, score);
}

function formatScore(score: number): string {
  if (score >= 90) return chalk.green(`${score}/100`);
  if (score >= 70) return chalk.yellow(`${score}/100`);
  return chalk.red(`${score}/100`);
}
