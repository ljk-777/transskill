import { join } from 'node:path';
import { writeFileSync, cpSync, mkdirSync, existsSync } from 'node:fs';
import matter from 'gray-matter';
import type { Renderer } from './renderer.interface.js';
import type { FormatType, IntermediateSkill, SkillDirectory, DirectoryConversionResult } from '../core/types.js';

/**
 * Renders IntermediateSkill to .mdc format (Cursor 2.3+).
 *
 * .mdc files have YAML frontmatter with description, globs, and alwaysApply.
 * The body contains the rule instructions.
 */
export class MdcRenderer implements Renderer {
  readonly format: FormatType = '.mdc';
  readonly extension = '.mdc';

  render(skill: IntermediateSkill): string {
    const frontmatter: Record<string, unknown> = {
      description: skill.description,
    };

    const cursor = skill.platformSpecific.cursor;
    if (cursor?.globs && cursor.globs.length > 0) {
      frontmatter.globs = cursor.globs.length === 1 ? cursor.globs[0] : cursor.globs.join(', ');
    }
    if (cursor?.alwaysApply !== undefined) {
      frontmatter.alwaysApply = cursor.alwaysApply;
    }

    return matter.stringify(skill.instructions || '', frontmatter);
  }

  renderDirectory(
    skillDir: SkillDirectory,
    skill: IntermediateSkill,
    outputPath: string,
  ): DirectoryConversionResult {
    const copied: string[] = [];
    const skipped: string[] = [];

    const mdcPath = join(outputPath, `${skillDir.name}.mdc`);
    writeFileSync(mdcPath, this.render(skill), 'utf-8');

    if (skillDir.scriptsDir) {
      const target = join(outputPath, 'scripts');
      if (!existsSync(target)) {
        mkdirSync(target, { recursive: true });
      }
      try {
        cpSync(skillDir.scriptsDir, target, { recursive: true });
        copied.push(target);
      } catch {
        skipped.push(skillDir.scriptsDir);
      }
    }

    return {
      skillName: skill.name,
      mainOutput: mdcPath,
      copiedFiles: copied,
      skippedFiles: skipped,
    };
  }
}
