/**
 * Publish command — v2: lightweight link submission.
 *
 * No more file uploads. Publishing a skill just adds a link entry
 * to registry.json pointing to the original source.
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { intro, outro, spinner, log } from '@clack/prompts';
import chalk from 'chalk';
import matter from 'gray-matter';
import { AuditEngine } from '../audit/index.js';
import { getParser } from '../parser/parser-registry.js';

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const REGISTRY_OWNER = 'ljk-777';
const REGISTRY_REPO = 'transskill-registry';
const REGISTRY_FULL = `${REGISTRY_OWNER}/${REGISTRY_REPO}`;
const GITHUB_API = 'https://api.github.com';

// ──────────────────────────────────────────────
// Error type
// ──────────────────────────────────────────────

/** Error thrown to abort publish (messages already printed via log/outro). */
export class PublishError extends Error {
  constructor(msg?: string) {
    super(msg || 'Publish aborted');
    this.name = 'PublishError';
  }
}

// ──────────────────────────────────────────────
// GitHub API helpers
// ──────────────────────────────────────────────

function getToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('');
    log.error('GITHUB_TOKEN environment variable not set.');
    log.info('Create a token at https://github.com/settings/tokens');
    log.info('Then set: export GITHUB_TOKEN=***');
    console.error('');
    throw new PublishError();
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
  return fetch(url, {
    ...options,
    headers: {
      ...ghHeaders(token),
      ...(options.headers as Record<string, string>),
    },
  });
}

async function getGitHubUser(token: string): Promise<string> {
  const res = await ghFetch(`${GITHUB_API}/user`, token);
  if (!res.ok) throw new PublishError(`Failed to authenticate: ${res.status} ${res.statusText}`);
  const data = await res.json() as { login: string };
  return data.login;
}

async function getDefaultBranch(token: string): Promise<{ name: string; sha: string }> {
  const res = await ghFetch(`${GITHUB_API}/repos/${REGISTRY_FULL}`, token);
  if (!res.ok) throw new PublishError(`Failed to get repo info: ${res.status}`);
  const data = await res.json() as { default_branch: string };
  const branch = data.default_branch;

  const refRes = await ghFetch(
    `${GITHUB_API}/repos/${REGISTRY_FULL}/git/ref/heads/${branch}`,
    token,
  );
  if (!refRes.ok) throw new PublishError(`Failed to get branch ref: ${refRes.status}`);
  const refData = await refRes.json() as { object: { sha: string } };
  return { name: branch, sha: refData.object.sha };
}

async function ensureFork(token: string, user: string): Promise<void> {
  const checkRes = await ghFetch(`${GITHUB_API}/repos/${user}/${REGISTRY_REPO}`, token);
  if (checkRes.ok) return; // fork exists

  log.info('Creating fork of transskill-registry…');
  const res = await ghFetch(`${GITHUB_API}/repos/${REGISTRY_FULL}/forks`, token, {
    method: 'POST',
    body: JSON.stringify({}),
  });

  if (res.status === 202) {
    log.info('Fork creation in progress…');
    let ready = false;
    let attempts = 0;
    while (!ready && attempts < 30) {
      await new Promise((r) => setTimeout(r, 2000));
      const check = await ghFetch(`${GITHUB_API}/repos/${user}/${REGISTRY_REPO}`, token);
      if (check.ok) ready = true;
      attempts++;
    }
    if (!ready) throw new PublishError('Timed out waiting for fork');
  } else if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new PublishError(
      `Failed to fork repo: ${res.status} ${(body as { message?: string }).message || res.statusText}`,
    );
  }
}

async function upsertFile(
  token: string,
  user: string,
  branch: string,
  path: string,
  content: string,
  message: string,
): Promise<void> {
  let existingSha: string | undefined;
  const getRes = await ghFetch(
    `${GITHUB_API}/repos/${user}/${REGISTRY_REPO}/contents/${path}?ref=${branch}`,
    token,
  );
  if (getRes.ok) {
    const data = await getRes.json() as { sha: string };
    existingSha = data.sha;
  }

  const base64 = Buffer.from(content, 'utf-8').toString('base64');
  const body: Record<string, unknown> = { message, content: base64, branch };
  if (existingSha) body.sha = existingSha;

  const res = await ghFetch(
    `${GITHUB_API}/repos/${user}/${REGISTRY_REPO}/contents/${path}`,
    token,
    { method: 'PUT', body: JSON.stringify(body) },
  );
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new PublishError(
      `Failed to write ${path}: ${res.status} ${(errBody as { message?: string }).message || res.statusText}`,
    );
  }
}

async function createPR(
  token: string,
  user: string,
  branch: string,
  title: string,
  body: string,
): Promise<string> {
  const res = await ghFetch(`${GITHUB_API}/repos/${REGISTRY_FULL}/pulls`, token, {
    method: 'POST',
    body: JSON.stringify({
      title,
      body,
      head: `${user}:${branch}`,
      base: 'main',
    }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new PublishError(
      `Failed to create PR: ${res.status} ${(errBody as { message?: string }).message || res.statusText}`,
    );
  }
  const data = await res.json() as { html_url: string };
  return data.html_url;
}

// ──────────────────────────────────────────────
// Publish logic
// ──────────────────────────────────────────────

export interface PublishOptions {
  force?: boolean;
  dryRun?: boolean;
  /** Override source URL (default: GitHub path of the skill) */
  sourceUrl?: string;
  /** Override download URL (default: raw GitHub SKILL.md) */
  downloadUrl?: string;
}

/**
 * Publish a skill — validate, then PR a link to the registry index.
 */
export async function publishSkill(skillPath: string, options: PublishOptions): Promise<void> {
  const spin = spinner();

  intro(chalk.green('📤 TransSkill Publish (v2 — link only)'));

  // Step 1: Resolve and validate
  const skillDirPath = skillPath.startsWith('/')
    ? skillPath
    : join(process.cwd(), skillPath);

  if (!existsSync(skillDirPath)) {
    log.error(`Path does not exist: ${skillDirPath}`);
    throw new PublishError();
  }

  if (!statSync(skillDirPath).isDirectory()) {
    log.error(`Expected a directory, got a file`);
    throw new PublishError();
  }

  const skillMdPath = join(skillDirPath, 'SKILL.md');
  if (!existsSync(skillMdPath)) {
    log.error(`Directory does not contain SKILL.md`);
    throw new PublishError();
  }

  // Step 2: Parse + validate frontmatter
  spin.start('Validating SKILL.md…');
  let rawContent: string;
  let frontmatter: Record<string, unknown>;

  try {
    rawContent = readFileSync(skillMdPath, 'utf-8');
    const parsed = matter(rawContent);
    frontmatter = parsed.data as Record<string, unknown>;

    const parser = getParser('skill.md');
    parser.parse(rawContent, skillMdPath);

    if (!frontmatter.description || typeof frontmatter.description !== 'string') {
      throw new Error('"description" field is required');
    }

    spin.stop('Validated ✓');
    console.log(`  Name:        ${chalk.bold(frontmatter.name || skillMdPath)}`);
    console.log(`  Description: ${frontmatter.description}`);
    console.log('');
  } catch (err: unknown) {
    spin.stop('Validation failed');
    const message = err instanceof Error ? err.message : String(err);
    log.error(`Invalid skill: ${message}`);
    throw new PublishError();
  }

  // Step 3: Security audit
  spin.start('Running security audit…');
  const engine = new AuditEngine({ lang: 'en' });
  const report = engine.auditSkill(
    matter(rawContent).content as any,
    skillMdPath,
  );
  // Actually do proper audit
  const parser = getParser('skill.md');
  const skill = parser.parse(rawContent, skillMdPath);
  const auditReport = engine.auditSkill(skill, skillMdPath);
  const score = calculateScore(auditReport);
  spin.stop(`Audit complete — score: ${formatScore(score)}`);

  if (auditReport.findings.length > 0) {
    console.log(engine.reportToString(auditReport));
  } else {
    console.log(`  ${chalk.green('✓ No security issues found')}`);
  }
  console.log('');

  if (score < 90 && !options.force) {
    log.error(`Score ${score}/100 is below 90. Use --force to publish anyway.`);
    throw new PublishError();
  }

  // Step 4: Determine source URLs
  const skillName = (frontmatter.name as string) || 'unnamed';
  const skillAuthor = (frontmatter.author as string) || 'unknown';
  const version = (frontmatter.version as string) || '1.0.0';

  // Try to derive GitHub URLs from git remote
  let sourceUrl = options.sourceUrl || '';
  let downloadUrl = options.downloadUrl || '';

  if (!sourceUrl) {
    // Try to read git remote
    const { execSync } = await import('node:child_process');
    try {
      const remote = execSync('git remote get-url origin', { cwd: skillDirPath })
        .toString().trim()
        .replace(/\.git$/, '');
      if (remote.includes('github.com')) {
        sourceUrl = remote;
        const repoPath = remote.replace(/^https?:\/\/github\.com\//, '');
        downloadUrl = `https://raw.githubusercontent.com/${repoPath}/main/SKILL.md`;
      }
    } catch {
      // No git remote found
    }
  }

  if (!sourceUrl) {
    sourceUrl = `https://github.com/${skillAuthor}/skills`;
    downloadUrl = `https://raw.githubusercontent.com/${skillAuthor}/skills/main/skills/${skillName}/SKILL.md`;
  }

  console.log(`  ${chalk.gray('Source:')} ${sourceUrl}`);
  console.log(`  ${chalk.gray('Download:')} ${downloadUrl}`);
  console.log('');

  // Dry run
  if (options.dryRun) {
    outro(chalk.yellow('Dry run — no changes made.'));
    return;
  }

  // Step 5: GitHub — fork → branch → update registry.json → PR
  spin.start('Connecting to GitHub…');
  let token: string;
  let user: string;
  let baseSha: string;

  try {
    token = getToken();
    user = await getGitHubUser(token);
    const base = await getDefaultBranch(token);
    baseSha = base.sha;
    spin.stop(`Authenticated as ${chalk.bold(user)}`);
  } catch (err: unknown) {
    spin.stop('GitHub connection failed');
    const message = err instanceof Error ? err.message : String(err);
    log.error(message);
    throw new PublishError();
  }

  // Fork
  spin.start('Setting up fork…');
  try {
    await ensureFork(token, user);
    spin.stop('Fork ready ✓');
  } catch {
    spin.stop('Fork failed');
    throw new PublishError();
  }

  // Create branch
  const branchName = `add-${skillName.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}`;
  spin.start(`Creating branch ${chalk.cyan(branchName)}…`);
  try {
    const branchRes = await ghFetch(
      `${GITHUB_API}/repos/${user}/${REGISTRY_REPO}/git/refs`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }),
      },
    );
    if (branchRes.status === 422) {
      log.info(`Branch already exists — updating`);
    } else if (!branchRes.ok) {
      throw new Error(`HTTP ${branchRes.status}`);
    }
    spin.stop('Branch ready ✓');
  } catch {
    spin.stop('Branch creation failed');
    throw new PublishError();
  }

  // Fetch current registry.json and update
  spin.start('Updating registry index…');
  try {
    const regRes = await ghFetch(
      `${GITHUB_API}/repos/${user}/${REGISTRY_REPO}/contents/registry.json?ref=${branchName}`,
      token,
    );

    let registry: { $schema: string; updated: string; skills: Array<Record<string, unknown>> };
    if (regRes.ok) {
      const d = await regRes.json() as { content: string };
      registry = JSON.parse(Buffer.from(d.content, 'base64').toString('utf-8'));
    } else {
      const upRes = await ghFetch(
        `https://raw.githubusercontent.com/${REGISTRY_FULL}/main/registry.json`,
        token,
        { headers: { 'User-Agent': 'transskill-cli' } },
      );
      registry = await upRes.json() as typeof registry;
    }

    // Add or update entry
    const existingIdx = registry.skills.findIndex((s) => s.name === skillName);
    const newEntry = {
      name: skillName,
      version,
      description: frontmatter.description as string,
      tags: (frontmatter.tags as string[]) || [],
      author: user,
      stars: existingIdx >= 0 ? (registry.skills[existingIdx].stars as number) : 0,
      auditScore: score,
      created: existingIdx >= 0
        ? (registry.skills[existingIdx].created as string)
        : new Date().toISOString(),
      sourceUrl,
      downloadUrl,
      source: 'manual' as const,
    };

    if (existingIdx >= 0) {
      registry.skills[existingIdx] = { ...registry.skills[existingIdx], ...newEntry as any };
    } else {
      registry.skills.push(newEntry as any);
    }
    registry.updated = new Date().toISOString();

    await upsertFile(
      token, user, branchName, 'registry.json',
      JSON.stringify(registry, null, 2),
      `Add ${skillName} v${version} to registry index`,
    );
    spin.stop('Registry index updated ✓');
  } catch (err: unknown) {
    spin.stop('Update failed');
    const message = err instanceof Error ? err.message : String(err);
    log.error(message);
    throw new PublishError();
  }

  // Create PR
  spin.start('Creating pull request…');
  try {
    const prBody = [
      `## 📦 ${skillName} v${version}`,
      '',
      `${frontmatter.description}`,
      '',
      '---',
      '',
      '### Links',
      '',
      `- **Source:** ${sourceUrl}`,
      `- **Download:** ${downloadUrl}`,
      '',
      '### Audit Report',
      '',
      `- **Score:** ${score}/100`,
      `- **Author:** ${user}`,
      '',
      '> Published by [TransSkill CLI](https://github.com/ljk-777/transskill)',
    ].join('\n');

    const prUrl = await createPR(
      token, user, branchName,
      `Add ${skillName} v${version} to registry index`,
      prBody,
    );

    spin.stop('Pull request created ✓');
    console.log('');
    console.log(`  ${chalk.green('→')} ${prUrl}`);
    console.log('');
    outro(`${chalk.bold(skillName)} linked in registry! 🎉`);
  } catch {
    spin.stop('PR creation failed');
    throw new PublishError();
  }
}

function calculateScore(report: { severityCounts: { critical: number; high: number; medium: number; low: number; info: number } }): number {
  const c = report.severityCounts;
  return Math.max(0, 100 - c.critical * 30 - c.high * 15 - c.medium * 5 - c.low * 2);
}

function formatScore(score: number): string {
  if (score >= 90) return chalk.green(`${score}/100`);
  if (score >= 70) return chalk.yellow(`${score}/100`);
  return chalk.red(`${score}/100`);
}
