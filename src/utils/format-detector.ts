import { readFileSync, statSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { detectFormat } from '../parser/parser-registry.js';
import type { FormatType } from '../core/types.js';
import { TransSkillError } from '../core/errors.js';

export interface FormatDetectionResult {
  format: FormatType;
  isDirectory: boolean;
}

/**
 * Detect format from a local file or directory path.
 * For directories, checks if it contains a SKILL.md.
 */
export function detectFormatFromPath(localPath: string): FormatDetectionResult {
  const stat = statSync(localPath);

  if (stat.isDirectory()) {
    // Directory mode - check for SKILL.md
    if (existsSync(join(localPath, 'SKILL.md'))) {
      return { format: 'skill.md', isDirectory: true };
    }
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
