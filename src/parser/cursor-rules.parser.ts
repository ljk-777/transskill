import { basename, extname } from 'node:path';
import type { Parser } from './parser.interface.js';
import type { FormatType, IntermediateSkill, SkillDirectory } from '../core/types.js';
import { TransSkillError } from '../core/errors.js';

/**
 * Parser for .cursorrules format.
 *
 * .cursorrules is a plain text file with instructions for Cursor IDE.
 * It has no frontmatter — the entire content is treated as instructions.
 * Used by: Cursor IDE (legacy format)
 */
export class CursorRulesParser implements Parser {
  readonly format: FormatType = '.cursorrules';

  detect(_content: string, filePath?: string): boolean {
    return filePath?.endsWith('.cursorrules') ?? false;
  }

  parse(content: string, filePath?: string): IntermediateSkill {
    const instructions = content.trim();

    // Derive name from filename (or parent directory)
    const name = filePath
      ? basename(filePath, extname(filePath))
      : 'untitled-rules';

    // Extract first meaningful line as description
    const firstLine = instructions.split('\n')[0]?.replace(/^[#\s]*/, '').trim() || '';
    const description = firstLine.length > 0 ? firstLine : `Cursor rules from ${name}`;

    return {
      name,
      description,
      instructions,
      metadata: {
        sourceFormat: '.cursorrules',
      },
      platformSpecific: {},
    };
  }

  parseDirectory(dirPath: string): SkillDirectory {
    throw new TransSkillError(
      `.cursorrules does not support directory parsing — use single file mode`,
      'UNSUPPORTED_INPUT',
      { dirPath },
    );
  }
}
