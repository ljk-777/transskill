/**
 * Registry client — lightweight index of skill links.
 *
 * The registry no longer stores skill files. It's just a curated
 * JSON index pointing to original sources. Skills are fetched
 * directly from their author's repos when installing.
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { RegistryIndex, SkillManifest, SkillDetail } from './types.js';

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const REGISTRY_URL = 'https://raw.githubusercontent.com/ljk-777/transskill-registry/main/registry.json';
const CACHE_DIR = join(homedir(), '.transskill', 'cache');
const CACHE_FILE = join(CACHE_DIR, 'registry.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ──────────────────────────────────────────────
// Cache helpers
// ──────────────────────────────────────────────

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function isCacheFresh(): boolean {
  if (!existsSync(CACHE_FILE)) return false;
  try {
    const raw = readFileSync(CACHE_FILE, 'utf-8');
    const cachedAt = new Date(raw.split('\n')[0]).getTime();
    return Date.now() - cachedAt < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

function readCache(): RegistryIndex | null {
  if (!isCacheFresh()) return null;
  try {
    const raw = readFileSync(CACHE_FILE, 'utf-8');
    const json = raw.slice(raw.indexOf('\n') + 1);
    return JSON.parse(json) as RegistryIndex;
  } catch {
    return null;
  }
}

function writeCache(index: RegistryIndex): void {
  ensureCacheDir();
  writeFileSync(CACHE_FILE, `${new Date().toISOString()}\n${JSON.stringify(index)}`, 'utf-8');
}

async function fetchRemote(): Promise<RegistryIndex> {
  const res = await fetch(REGISTRY_URL);
  if (!res.ok) throw new Error(`Failed to fetch registry: ${res.status} ${res.statusText}`);
  return (await res.json()) as RegistryIndex;
}

// ──────────────────────────────────────────────
// External source fetchers
// ──────────────────────────────────────────────

/**
 * Parse awesome-agent-skills README and extract skill entries.
 * Each section has a table of skills with links to officialskills.sh.
 */
async function fetchAwesomeAgentSkills(): Promise<SkillManifest[]> {
  const readmeUrl = 'https://raw.githubusercontent.com/VoltAgent/awesome-agent-skills/main/README.md';
  const res = await fetch(readmeUrl);
  if (!res.ok) {
    console.warn(`  ⚠ awesome-agent-skills: HTTP ${res.status}`);
    return [];
  }
  const md = await res.text();

  const skills: SkillManifest[] = [];
  const lines = md.split('\n');

  // Pattern: `- **[org/skill](https://officialskills.sh/...)** - description`
  // or:      `- [org/skill](https://github.com/.../)` - description`
  const skillLinkRe = /^\s*-\s+\*?\*?\[([^\]]+)\]\(([^)]+)\)\*?\*?\s*-\s*(.+)/;

  for (const line of lines) {
    const m = line.match(skillLinkRe);
    if (!m) continue;

    const fullName = m[1];       // e.g. "anthropics/docx"
    const url = m[2];            // e.g. "https://officialskills.sh/anthropics/skills/docx"
    const description = m[3];    // e.g. "Create, edit, and analyze Word documents"

    const parts = fullName.split('/');
    const author = parts[0];
    const name = parts[1] || fullName;

    // Derive download URL from the officialskills.sh page or GitHub
    const downloadUrl = deriveDownloadUrl(url, name, author);

    skills.push({
      name,
      version: '1.0.0',
      description: description.trim(),
      tags: [author, name],
      author,
      stars: 0,
      auditScore: 0,
      created: new Date().toISOString(),
      sourceUrl: url,
      downloadUrl,
      source: 'awesome-agent-skills',
    });
  }

  return skills;
}

/**
 * Derive a raw SKILL.md download URL from various link formats.
 */
function deriveDownloadUrl(url: string, name: string, author: string): string {
  // officialskills.sh format: https://officialskills.sh/<author>/skills/<name>
  const officialMatch = url.match(/officialskills\.sh\/([^/]+)\/skills\/([^/]+)/);
  if (officialMatch) {
    const org = officialMatch[1];
    const skillName = officialMatch[2];
    return `https://raw.githubusercontent.com/${org}/skills/main/skills/${skillName}/SKILL.md`;
  }

  // GitHub tree URL: https://github.com/<author>/<repo>/tree/main/skills/<name>
  const githubTreeMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/tree\//);
  if (githubTreeMatch) {
    const org = githubTreeMatch[1];
    const repo = githubTreeMatch[2];
    return `https://raw.githubusercontent.com/${org}/${repo}/main/skills/${name}/SKILL.md`;
  }

  // Fallback: try generic GitHub raw
  return `https://raw.githubusercontent.com/${author}/skills/main/skills/${name}/SKILL.md`;
}

// ──────────────────────────────────────────────
// Registry API
// ──────────────────────────────────────────────

/**
 * Get the registry index, from cache if fresh, otherwise from remote.
 * Optionally enriches with external sources.
 */
export async function getRegistry(
  forceRefresh = false,
  includeExternal = true,
): Promise<RegistryIndex> {
  if (!forceRefresh) {
    const cached = readCache();
    if (cached) return cached;
  }

  const remote = await fetchRemote();
  writeCache(remote);

  // Enrich with external sources
  if (includeExternal) {
    try {
      const externalSkills = await fetchAwesomeAgentSkills();
      if (externalSkills.length > 0) {
        // Merge: registry entries take priority (dedup by name)
        const existingNames = new Set(remote.skills.map((s) => s.name));
        for (const ext of externalSkills) {
          if (!existingNames.has(ext.name)) {
            remote.skills.push(ext);
          }
        }
        remote.updated = new Date().toISOString();
        // Rewrite cache with enriched data
        writeCache(remote);
      }
    } catch {
      // External enrich is best-effort
    }
  }

  return remote;
}

/**
 * Simple fuzzy search across skill name, description, and tags.
 */
export function searchSkills(registry: RegistryIndex, query: string): SkillManifest[] {
  const q = query.toLowerCase();
  return registry.skills.filter((s) => {
    if (s.name.toLowerCase().includes(q)) return true;
    if (s.description.toLowerCase().includes(q)) return true;
    if (s.tags.some((t) => t.toLowerCase().includes(q))) return true;
    if (s.author.toLowerCase().includes(q)) return true;
    return false;
  });
}

/**
 * Find a single skill by name.
 */
export function findSkill(
  registry: RegistryIndex,
  name: string,
): SkillManifest | undefined {
  // Exact match first
  const exact = registry.skills.find(
    (s) => s.name.toLowerCase() === name.toLowerCase(),
  );
  if (exact) return exact;

  // Fuzzy match
  return registry.skills.find(
    (s) => s.name.toLowerCase().includes(name.toLowerCase()),
  );
}

/**
 * Get full skill detail including SKILL.md content.
 * Fetches directly from the original source URL.
 */
export async function getSkillDetail(manifest: SkillManifest): Promise<SkillDetail> {
  const res = await fetch(manifest.downloadUrl);
  if (!res.ok) {
    // Fallback: try common URL patterns
    const fallbackUrl = `https://raw.githubusercontent.com/${manifest.author}/skills/main/skills/${manifest.name}/SKILL.md`;
    const fallbackRes = await fetch(fallbackUrl);
    if (!fallbackRes.ok) {
      throw new Error(
        `Failed to fetch skill "${manifest.name}" from ${manifest.downloadUrl} ` +
        `(HTTP ${res.status}) and fallback ${fallbackUrl} (HTTP ${fallbackRes.status})`,
      );
    }
    const readme = await fallbackRes.text();
    return { ...manifest, readme };
  }

  const readme = await res.text();
  return { ...manifest, readme };
}
