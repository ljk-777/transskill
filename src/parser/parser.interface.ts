import type { FormatType, IntermediateSkill, SkillDirectory } from '../core/types.js';

/**
 * Parser interface - reads platform-specific skill formats
 * and converts them to the platform-agnostic IntermediateSkill.
 */
export interface Parser {
  /** The format this parser handles */
  readonly format: FormatType;

  /** Parse file content into an IntermediateSkill */
  parse(content: string, filePath?: string): IntermediateSkill;

  /** Scan a skill directory and extract its structure */
  parseDirectory(dirPath: string): SkillDirectory;

  /** Quick check if this parser can handle the given content */
  detect(content: string, filePath?: string): boolean;
}
