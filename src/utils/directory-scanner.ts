import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { SkillDirectory, AttachedFile } from '../core/types.js';

/**
 * Known subdirectory names that carry skill-related files
 */
const KNOWN_DIRS = ['scripts', 'references', 'assets', 'templates', 'examples', 'rules'];

/**
 * Scan a file path and determine its type based on parent directory.
 */
function classifyAttachedFile(filePath: string, rootPath: string): AttachedFile['type'] {
  const rel = relative(rootPath, filePath).replace(/\\/g, '/');
  if (rel.startsWith('scripts/')) return 'script';
  if (rel.startsWith('references/')) return 'reference';
  if (rel.startsWith('assets/')) return 'asset';
  return 'unknown';
}

/**
 * Build SkillDirectory by scanning a path (file or directory).
 * For files, still returns a minimal SkillDirectory for context.
 */
export function scanSkillDirectory(localPath: string): SkillDirectory {
  const stat = statSync(localPath);
  const rootPath = stat.isDirectory() ? localPath : join(localPath, '..');
  const name = rootPath.split('/').pop() || rootPath.split('\\').pop() || 'skill';

  // Find the main skill file
  let skillFile: string;
  if (stat.isFile()) {
    skillFile = localPath;
  } else {
    // Look for known entry point filenames in priority order
    const candidates = ['SKILL.md', 'SOUL.md', 'CLAUDE.md', 'claude.md', 'AGENTS.md'];
    skillFile = '';
    for (const candidate of candidates) {
      const fullPath = join(localPath, candidate);
      if (existsSync(fullPath) && statSync(fullPath).isFile()) {
        skillFile = fullPath;
        break;
      }
    }
    if (!skillFile) {
      // Fallback: first .md file
      const files = readdirSync(localPath);
      const mdFile = files.find((f) => f.endsWith('.md') || f.endsWith('.cursorrules') || f.endsWith('.mdc'));
      skillFile = mdFile ? join(localPath, mdFile) : localPath;
    }
  }

  // Scan for known directories
  let scriptsDir: string | undefined;
  let referencesDir: string | undefined;
  let assetsDir: string | undefined;
  const extraFiles: string[] = [];

  try {
    const entries = readdirSync(rootPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'scripts') scriptsDir = join(rootPath, 'scripts');
      else if (entry.name === 'references') referencesDir = join(rootPath, 'references');
      else if (entry.name === 'assets') assetsDir = join(rootPath, 'assets');
      else if (KNOWN_DIRS.includes(entry.name)) {
        // Scan extra directories for individual files
        const dirFiles = readdirSync(join(rootPath, entry.name));
        for (const f of dirFiles) {
          extraFiles.push(join(rootPath, entry.name, f));
        }
      }
    }
  } catch {
    // Not a directory or no access
  }

  return {
    name,
    rootPath,
    skillFile,
    scriptsDir,
    referencesDir,
    assetsDir,
    extraFiles,
  };
}

/**
 * Convert a SkillDirectory scan result into AttachedFile[] array
 * that can be stored in IntermediateSkill.metadata.attachedFiles.
 */
export function skillDirToAttachedFiles(dir: SkillDirectory): AttachedFile[] {
  const files: AttachedFile[] = [];

  const collectFiles = (dirPath: string | undefined, type: AttachedFile['type']) => {
    if (!dirPath) return;
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          files.push({
            relativePath: join(dirPath.replace(dir.rootPath, ''), entry.name).replace(/^\//, ''),
            absolutePath: join(dirPath, entry.name),
            type,
          });
        }
      }
    } catch {
      // skip
    }
  };

  collectFiles(dir.scriptsDir, 'script');
  collectFiles(dir.referencesDir, 'reference');
  collectFiles(dir.assetsDir, 'asset');

  for (const extra of dir.extraFiles) {
    try {
      if (statSync(extra).isFile()) {
        files.push({
          relativePath: extra.replace(dir.rootPath, '').replace(/^\//, ''),
          absolutePath: extra,
          type: classifyAttachedFile(extra, dir.rootPath),
        });
      }
    } catch {
      // skip
    }
  }

  return files;
}
