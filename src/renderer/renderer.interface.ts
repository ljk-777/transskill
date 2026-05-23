import type { FormatType, IntermediateSkill, SkillDirectory, DirectoryConversionResult } from '../core/types.js';

/**
 * Renderer interface - writes IntermediateSkill to a target platform format.
 */
export interface Renderer {
  /** The format this renderer outputs */
  readonly format: FormatType;

  /** Output file extension (including dot) */
  readonly extension: string;

  /** Render a single skill to a string */
  render(skill: IntermediateSkill): string;

  /** Render a full skill directory (optional — only for formats that support directories) */
  renderDirectory?(
    skillDir: SkillDirectory,
    skill: IntermediateSkill,
    outputPath: string,
  ): DirectoryConversionResult;
}
