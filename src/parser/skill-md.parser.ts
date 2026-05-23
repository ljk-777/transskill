import matter from 'gray-matter';
import type { Parser } from './parser.interface.js';
import type { FormatType, IntermediateSkill, SkillDirectory } from '../core/types.js';
import { TransSkillError } from '../core/errors.js';

/**
 * Parser for SKILL.md format.
 *
 * SKILL.md uses YAML frontmatter for metadata (name, description)
 * and Markdown body for instructions.
 *
 * Used by: Claude Code, Codex CLI, OpenClaw, Cursor (partial)
 */
export class SKILLMdParser implements Parser {
  readonly format: FormatType = 'skill.md';

  detect(content: string, _filePath?: string): boolean {
    try {
      const parsed = matter(content);
      return !!(parsed.data && typeof parsed.data === 'object');
    } catch {
      return false;
    }
  }

  parse(content: string, filePath?: string): IntermediateSkill {
    let parsed;
    try {
      parsed = matter(content);
    } catch (err) {
      throw new TransSkillError(
        `Invalid YAML frontmatter in SKILL.md${filePath ? `: ${filePath}` : ''}`,
        'INVALID_FRONTMATTER',
        { filePath, originalError: String(err) },
      );
    }

    const frontmatter = parsed.data as Record<string, unknown>;

    // name is required
    const name = typeof frontmatter.name === 'string' ? frontmatter.name : guessName(filePath);
    if (!name) {
      throw new TransSkillError(
        `SKILL.md is missing a "name" field in frontmatter${filePath ? `: ${filePath}` : ''}`,
        'INVALID_FRONTMATTER',
        { filePath, frontmatter },
      );
    }

    // description is required; fallback to empty
    const description =
      typeof frontmatter.description === 'string'
        ? frontmatter.description
        : '';

    // Extract remaining frontmatter as raw
    const rawFrontmatter: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(frontmatter)) {
      if (key !== 'name' && key !== 'description') {
        rawFrontmatter[key] = value;
      }
    }

    const instructions = parsed.content.trim();

    return {
      name,
      description,
      instructions,
      metadata: {
        sourceFormat: 'skill.md',
        tags: Array.isArray(frontmatter.tags) ? (frontmatter.tags as string[]) : undefined,
        author: typeof frontmatter.author === 'string' ? frontmatter.author : undefined,
        version: typeof frontmatter.version === 'string' ? frontmatter.version : undefined,
        rawFrontmatter: Object.keys(rawFrontmatter).length > 0 ? rawFrontmatter : undefined,
      },
      platformSpecific: {},
    };
  }

  parseDirectory(dirPath: string): SkillDirectory {
    const { join } = require('node:path');
    const { existsSync, readdirSync, statSync } = require('node:fs');

    const skillMdPath = join(dirPath, 'SKILL.md');
    if (!existsSync(skillMdPath)) {
      throw new TransSkillError(
        `Directory does not contain SKILL.md: ${dirPath}`,
        'NO_SKILL_FOUND',
        { dirPath },
      );
    }

    const name = require('node:path').basename(dirPath);
    const extraFiles: string[] = [];
    let scriptsDir: string | undefined;
    let referencesDir: string | undefined;
    let assetsDir: string | undefined;

    try {
      const entries = readdirSync(dirPath);
      for (const entry of entries) {
        if (entry === 'SKILL.md' || entry === 'scripts' || entry === 'references' || entry === 'assets') {
          continue;
        }
        const fullPath = join(dirPath, entry);
        if (statSync(fullPath).isFile() || statSync(fullPath).isDirectory()) {
          extraFiles.push(fullPath);
        }
      }

      if (existsSync(join(dirPath, 'scripts')) && statSync(join(dirPath, 'scripts')).isDirectory()) {
        scriptsDir = join(dirPath, 'scripts');
      }
      if (existsSync(join(dirPath, 'references')) && statSync(join(dirPath, 'references')).isDirectory()) {
        referencesDir = join(dirPath, 'references');
      }
      if (existsSync(join(dirPath, 'assets')) && statSync(join(dirPath, 'assets')).isDirectory()) {
        assetsDir = join(dirPath, 'assets');
      }
    } catch {
      // If we can't read the directory, just return what we have
    }

    return {
      name,
      rootPath: dirPath,
      skillFile: skillMdPath,
      scriptsDir,
      referencesDir,
      assetsDir,
      extraFiles,
    };
  }
}

/** Guess skill name from file path */
function guessName(filePath?: string): string | undefined {
  if (!filePath) return undefined;
  const { basename, extname } = require('node:path');
  const name = basename(filePath, extname(filePath));
  return name === 'SKILL' ? basename(require('node:path').dirname(filePath)) : name;
}
