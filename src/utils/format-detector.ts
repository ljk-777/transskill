import { readFileSync, statSync, existsSync, readdirSync } from 'node:fs';
import { extname, join, basename } from 'node:path';
import { detectFormat } from '../parser/parser-registry.js';
import type { FormatType } from '../core/types.js';
import { TransSkillError } from '../core/errors.js';

export interface FormatDetectionResult {
  format: FormatType;
  isDirectory: boolean;
}

/**
/**
 * Determine format by filename.
 */
function formatByFilename(filename: string): FormatDetectionResult {
  const name = basename(filename);
  if (name === 'SKILL.md') return { format: 'skill.md', isDirectory: true };
  if (name === 'SOUL.md') return { format: 'soul.md', isDirectory: true };
  if (name === 'CLAUDE.md' || name === 'claude.md') return { format: 'claude.md', isDirectory: true };
  if (name === 'AGENTS.md') return { format: 'agents.md', isDirectory: true };
  if (name.endsWith('.cursorrules')) return { format: '.cursorrules', isDirectory: true };
  if (name.endsWith('.mdc')) return { format: '.mdc', isDirectory: true };
  return { format: 'skill.md', isDirectory: true };
}

/**
 * Detect format from a local file or directory path.
 */
export function detectFormatFromPath(localPath: string): FormatDetectionResult {
  const stat = statSync(localPath);

  if (stat.isDirectory()) {
    // Directory mode - check for known skill files in priority order
    const priorityFiles = ['SKILL.md', 'SOUL.md', 'CLAUDE.md', 'claude.md', 'AGENTS.md'];
    const dirEntries = readdirSync(localPath);

    for (const pf of priorityFiles) {
      if (dirEntries.includes(pf)) {
        return formatByFilename(pf);
      }
    }

    // Check for .cursorrules or .mdc as main file
    const hasCursorrules = dirEntries.find((f) => f.endsWith('.cursorrules'));
    if (hasCursorrules) {
      return { format: '.cursorrules', isDirectory: true };
    }
    const hasMdc = dirEntries.find((f) => f.endsWith('.mdc'));
    if (hasMdc) {
      return { format: '.mdc', isDirectory: true };
    }

    // Fallback: SKILL.md
    return { format: 'skill.md', isDirectory: true };
  }

  // File mode - detect by extension and content
  const ext = extname(localPath).toLowerCase();

  // Quick extension-based detection
  const extMap: Record<string, FormatType> = {
    '.cursorrules': '.cursorrules',
    '.mdc': '.mdc',
  };

  if (ext in extMap) {
    return { format: extMap[ext], isDirectory: false };
  }

  if (ext === '.json') {
    return { format: 'mcp.json', isDirectory: false };
  }

  if (ext === '.md') {
    const baseName = localPath.split('/').pop() || localPath.split('\\').pop() || '';

    // Check by filename
    if (baseName === 'SOUL.md') return { format: 'soul.md', isDirectory: false };
    if (baseName.toLowerCase() === 'claude.md' || baseName.endsWith('.claude.md')) {
      return { format: 'claude.md', isDirectory: false };
    }

    // Check content for signatures
    try {
      const content = readFileSync(localPath, 'utf-8');
      const firstLine = content.split('\n')[0]?.trim() || '';
      if (/^#\s+SOUL\.md/i.test(firstLine)) return { format: 'soul.md', isDirectory: false };
      if (/^#\s+CLAUDE\.md/i.test(firstLine)) return { format: 'claude.md', isDirectory: false };
    } catch {
      // fall through
    }
    return { format: 'skill.md', isDirectory: false };
  }

  // Fallback to content-based detection
  const content = readFileSync(localPath, 'utf-8');
  const detected = detectFormat(content, localPath);
  if (detected) {
    return { format: detected, isDirectory: false };
  }

  throw new TransSkillError(
    `Unable to detect format for: ${localPath}. Use --format to specify manually.`,
    'UNSUPPORTED_INPUT',
    { localPath },
  );
}
