import matter from 'gray-matter';
import { basename, extname } from 'node:path';
import type { Parser } from './parser.interface.js';
import type { FormatType, IntermediateSkill, SkillDirectory } from '../core/types.js';

/**
 * Parser for .mdc format (Cursor 2.3+ rules).
 *
 * .mdc files have YAML frontmatter with description, globs, and alwaysApply fields.
 * The body contains the rule instructions in Markdown.
 *
 * Used by: Cursor IDE (.cursor/rules/*.mdc)
 */
export class MdcParser implements Parser {
  readonly format: FormatType = '.mdc';

  detect(_content: string, filePath?: string): boolean {
    return filePath?.endsWith('.mdc') ?? false;
  }

  parse(content: string, filePath?: string): IntermediateSkill {
    let parsed;
    try {
      parsed = matter(content);
    } catch {
      // No valid frontmatter — treat as plain text (fallback)
      const instructions = content.trim();
      const name = filePath ? basename(filePath, extname(filePath)) : 'untitled-rule';
      return {
        name,
        description: instructions.split('\n')[0]?.replace(/^[#\s]*/, '').trim() || name,
        instructions,
        metadata: { sourceFormat: '.mdc' },
        platformSpecific: { cursor: {} },
      };
    }

    const frontmatter = parsed.data as Record<string, unknown>;
    const instructions = parsed.content.trim();
    const name = filePath ? basename(filePath, extname(filePath)) : 'untitled-rule';
    const description =
      typeof frontmatter.description === 'string' ? frontmatter.description : name;

    const cursorSpecific: { globs?: string[]; alwaysApply?: boolean } = {};
    if (typeof frontmatter.globs === 'string') {
      cursorSpecific.globs = [frontmatter.globs];
    }
    if (typeof frontmatter.alwaysApply === 'boolean') {
      cursorSpecific.alwaysApply = frontmatter.alwaysApply;
    }

    return {
      name,
      description,
      instructions,
      metadata: {
        sourceFormat: '.mdc',
        rawFrontmatter: { ...frontmatter, description: undefined } as Record<string, unknown>,
      },
      platformSpecific: {
        cursor: Object.keys(cursorSpecific).length > 0 ? cursorSpecific : undefined,
      },
    };
  }

  parseDirectory(dirPath: string): SkillDirectory {
    throw new Error('.mdc does not support directory parsing — use single file mode');
  }
}
