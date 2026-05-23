import { readFileSync, statSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { Parser } from './parser.interface.js';
import type { FormatType, IntermediateSkill, SkillDirectory } from '../core/types.js';

/**
 * Parses SOUL.md format — the OpenClaw agent identity / personality definition.
 *
 * SOUL.md is a Markdown file with:
 * - A title (# SOUL.md — Who You Are)
 * - Sections with ## headers (Core Truths, Boundaries, Vibe, etc.)
 * - Free-form personality and behavior rules
 *
 * Output: IntermediateSkill where instructions = full markdown content,
 *         metadata captures the identity nature.
 */
export class SOULMdParser implements Parser {
  readonly format: FormatType = 'soul.md';
  readonly extension = '.md';

  parse(content: string, _filePath?: string): IntermediateSkill {
    const lines = content.split('\n');
    const title = this.extractTitle(lines);
    const sections = this.extractSections(lines);

    return {
      name: this.extractName(title, lines),
      description: sections.find((s) => s.header === 'Core Truths')?.body
        ?.split('\n')
        .find((l) => l.trim().startsWith('**'))
        ?.replace(/\*\*/g, '')
        ?.split('.')[0]
        ?.trim() || title || 'Agent identity definition',
      instructions: content,
      metadata: {
        sourceFormat: 'soul.md',
        tags: ['soul', 'identity'],
        author: this.extractFromSections(sections, 'Identity'),
        version: undefined,
        rawFrontmatter: undefined,
      },
      platformSpecific: {
        openclaw: {
          mountPath: undefined,
        },
      },
    };
  }

  parseDirectory(dirPath: string): SkillDirectory {
    const name = dirPath.split('/').pop() || dirPath.split('\\').pop() || 'skill';
    const skillFile = join(dirPath, 'SOUL.md');

    let referencesDir: string | undefined;
    let assetsDir: string | undefined;

    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name === 'references') referencesDir = join(dirPath, 'references');
        if (entry.name === 'assets') assetsDir = join(dirPath, 'assets');
      }
    }

    return { name, rootPath: dirPath, skillFile, referencesDir, assetsDir, extraFiles: [] };
  }

  detect(content: string, filePath?: string): boolean {
    // Check file name
    if (filePath) {
      const base = filePath.split('/').pop() || filePath.split('\\').pop() || '';
      if (base === 'SOUL.md') return true;
    }

    // Check content for SOUL.md title signature
    const firstLine = content.split('\n')[0]?.trim() || '';
    if (/^#\s+SOUL\.md/i.test(firstLine)) return true;

    return false;
  }

  private extractTitle(lines: string[]): string {
    const titleLine = lines.find((l) => /^#\s+SOUL\.md/i.test(l.trim()));
    if (!titleLine) return '';
    return titleLine.replace(/^#\s+SOUL\.md\s*[-–—]\s*/i, '').trim();
  }

  private extractSections(lines: string[]): Array<{ header: string; body: string }> {
    const sections: Array<{ header: string; body: string }> = [];
    let currentHeader = '';
    let currentBody: string[] = [];

    const flush = () => {
      if (currentHeader) {
        sections.push({ header: currentHeader, body: currentBody.join('\n').trim() });
        currentBody = [];
      }
    };

    for (const line of lines) {
      if (/^##\s+(.+)/.test(line)) {
        flush();
        currentHeader = line.replace(/^##\s+/, '').trim();
      } else if (currentHeader) {
        currentBody.push(line);
      }
    }
    flush();

    return sections;
  }

  private extractName(title: string, lines: string[]): string {
    if (title) return title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    // Fallback: use filename-derived name
    return 'agent-identity';
  }

  private extractFromSections(
    sections: Array<{ header: string; body: string }>,
    header: string,
  ): string | undefined {
    const section = sections.find(
      (s) => s.header.toLowerCase() === header.toLowerCase(),
    );
    return section ? section.body.split('\n')[0]?.trim() || undefined : undefined;
  }
}
