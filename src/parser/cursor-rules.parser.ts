import { basename, extname } from 'node:path';
import type { Parser } from './parser.interface.js';
import type { FormatType, IntermediateSkill, SkillDirectory } from '../core/types.js';
import { TransSkillError } from '../core/errors.js';

/**
 * Parser for .cursorrules format.
 *
 * .cursorrules is a plain text file with instructions for Cursor IDE.
 * It has no frontmatter — the entire content is treated as instructions.
 *
 * Convention: first line may be an optional `# Title` heading.
 *   - If present, it's used as the description and stripped from instructions.
 *   - If absent, a fallback description is generated from the filename.
 *
 * Used by: Cursor IDE (legacy format)
 */
export class CursorRulesParser implements Parser {
  readonly format: FormatType = '.cursorrules';

  detect(_content: string, filePath?: string): boolean {
    return filePath?.endsWith('.cursorrules') ?? false;
  }

  parse(content: string, filePath?: string): IntermediateSkill {
    const trimmed = content.trim();

    // Derive name from filename (or parent directory)
    const name = filePath
      ? basename(filePath, extname(filePath))
      : 'untitled-rules';

    const lines = trimmed.split('\n');
    const firstRaw = lines[0] ?? '';

    // Detect whether the first line looks like a markdown heading
    const headingMatch = firstRaw.match(/^#+\s+(.+)/);
    if (headingMatch) {
      // Title line: use as description, strip from instructions
      const description = headingMatch[1].trim();
      const instructions = lines.slice(1).join('\n').trim();
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

    // No heading found — treat everything as instructions.
    // Derive a sensible fallback description from the filename.
    const description = `Cursor rules for ${name}`;
    return {
      name,
      description,
      instructions: trimmed,
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
