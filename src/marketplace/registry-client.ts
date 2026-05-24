/**
 * Registry client — fetches, caches, and searches skill registry.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { RegistryIndex, SkillManifest, SkillDetail } from './types.js';

const REGISTRY_URL = 'https://raw.githubusercontent.com/ljk-777/transskill-registry/main/registry.json';
const RAW_SKILL_PREFIX = 'https://raw.githubusercontent.com/ljk-777/transskill-registry/main/skills';
const CACHE_DIR = join(homedir(), '.transskill', 'cache');
const CACHE_FILE = join(CACHE_DIR, 'registry.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function isCacheFresh(): boolean {
  if (!existsSync(CACHE_FILE)) return false;
  const mtime = readFileSync(CACHE_FILE, 'utf-8').split('\n')[0];
  const cachedAt = new Date(mtime).getTime();
  return Date.now() - cachedAt < CACHE_TTL_MS;
}

function readCache(): RegistryIndex | null {
  if (!isCacheFresh()) return null;
  try {
    const raw = readFileSync(CACHE_FILE, 'utf-8');
    // First line is timestamp, rest is JSON
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

/**
 * Get the registry index, from cache if fresh, otherwise from remote.
 */
export async function getRegistry(forceRefresh = false): Promise<RegistryIndex> {
  if (!forceRefresh) {
    const cached = readCache();
    if (cached) return cached;
  }

  const remote = await fetchRemote();
  writeCache(remote);
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
    return false;
  });
}

/**
 * Find a single skill by name.
 */
export function findSkill(registry: RegistryIndex, name: string): SkillManifest | undefined {
  return registry.skills.find((s) => s.name === name);
}

/**
 * Get full skill detail including README content and download URL.
 */
export async function getSkillDetail(manifest: SkillManifest): Promise<SkillDetail> {
  const downloadUrl = `${RAW_SKILL_PREFIX}/${manifest.name}/SKILL.md`;
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`Failed to fetch skill: ${res.status} ${res.statusText}`);
  const readme = await res.text();

  return {
    ...manifest,
    readme,
    downloadUrl,
  };
}
