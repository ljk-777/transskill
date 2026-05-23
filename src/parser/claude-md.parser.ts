import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Parser } from './parser.interface.js';
import type { FormatType, IntermediateSkill, SkillDirectory } from '../core/types.js';

/**
 * Parses Claude Code CLAUDE.md files.
 *
 * CLAUDE.md is plain Markdown with no YAML frontmatter.
 * Structure: sections with ## headers, project info, commands, conventions.
 *
 * Detection:
 * - Filename is CLAUDE.md (case-insensitive)
 * - Content starts with # CLAUDE.md
 */
export class ClaudeMDParser implements Parser {
  readonly format: FormatType = 'claude.md';
  readonly extension = '.md';

  parse(content: string, _filePath?: string): IntermediateSkill {
    const lines = content.split('\n');
    const title = this.extractTitle(lines);
    const sections = this.extractSections(lines);

    return {
      name: this.extractName(content, title),
      description: this.extractDescription(sections, content),
      instructions: content,
      metadata: {
        sourceFormat: 'claude.md',
        tags: ['claude', 'project-rules'],
      },
      platformSpecific: {
        claude: {
          sections: sections.map((s) => s.header),
          autoMemory: this.hasAutoMemoryEntry(sections),
        },
      },
    };
  }

  parseDirectory(dirPath: string): SkillDirectory {
    const name = dirPath.split('/').pop() || dirPath.split('\\').pop() || 'claude-project';

    // Look for CLAUDE.md in the directory
    let skillFile = join(dirPath, 'CLAUDE.md');
    try {
      readFileSync(skillFile, 'utf-8');
    } catch {
      // Try lowercase
      skillFile = join(dirPath, 'claude.md');
    }

    // Check for .claude/rules/ directory
    const claudeRulesDir = join(dirPath, '.claude', 'rules');
    let extraFiles: string[] = [];
    try {
      extraFiles = readdirSync(claudeRulesDir)
        .filter((f) => f.endsWith('.mdc'))
        .map((f) => join(claudeRulesDir, f));
    } catch {
      // No .claude/rules directory
    }

    return {
      name,
      rootPath: dirPath,
      skillFile,
      extraFiles,
    };
  }

  detect(content: string, filePath?: string): boolean {
    if (filePath) {
      const base = filePath.split('/').pop() || filePath.split('\\').pop() || '';
      if (base.toLowerCase() === 'claude.md') return true;
    }

    const firstLine = content.split('\n')[0]?.trim() || '';
    if (/^#\s+CLAUDE\.md/i.test(firstLine)) return true;

    return false;
  }

  private extractTitle(lines: string[]): string {
    const titleLine = lines.find((l) => /^#\s+CLAUDE\.md/i.test(l.trim()));
    if (!titleLine) return '';
    return titleLine.replace(/^#\s+CLAUDE\.md\s*[-–—]\s*/i, '').trim();
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

  private extractName(content: string, title: string): string {
    // Try to find project name from ## Project section
    const projectMatch = content.match(/## Project\s*\n(.+)/);
    if (projectMatch) {
      const projectLine = projectMatch[1].trim().replace(/^\*\*(.+)\*\*$/, '$1');
      if (projectLine.length > 0 && projectLine.length < 80) {
        return projectLine
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .trim()
          .replace(/\s+/g, '-');
      }
    }

    if (title) {
      return title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }

    return 'claude-project-rules';
  }

  private extractDescription(
    sections: Array<{ header: string; body: string }>,
    content: string,
  ): string {
    const projectSection = sections.find((s) => s.header.toLowerCase() === 'project');
    if (projectSection) {
      const firstLine = projectSection.body
        .split('\n')
        .find((l) => l.trim().length > 0 && !l.trim().startsWith('-'));
      return firstLine?.trim() || 'Claude Code project rules';
    }

    return 'Claude Code project rules';
  }

  private hasAutoMemoryEntry(sections: Array<{ header: string; body: string }>): boolean {
    return sections.some(
      (s) =>
        s.header.toLowerCase().includes('auto') ||
        s.header.toLowerCase().includes('memory'),
    );
  }
}
