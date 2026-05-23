import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import matter from 'gray-matter';
import type { Renderer } from './renderer.interface.js';
import type { FormatType, IntermediateSkill, SkillDirectory, DirectoryConversionResult } from '../core/types.js';
import { copyAttachedFiles, copyDirectoryTree } from '../utils/file-copier.js';

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
    const allCopied: string[] = [];
    const allSkipped: string[] = [];

    const mdcPath = join(outputPath, `${skillDir.name}.mdc`);
    writeFileSync(mdcPath, this.render(skill), 'utf-8');

    if (skill.metadata.attachedFiles && skill.metadata.attachedFiles.length > 0) {
      const result = copyAttachedFiles(skill.metadata.attachedFiles, outputPath);
      allCopied.push(...result.copied);
      allSkipped.push(...result.skipped);
    } else {
      if (skillDir.scriptsDir) {
        const target = join(outputPath, 'scripts');
        allCopied.push(...copyDirectoryTree(skillDir.scriptsDir, target));
      }
    }

    return {
      skillName: skill.name,
      mainOutput: mdcPath,
      copiedFiles: allCopied,
      skippedFiles: allSkipped,
    };
  }
}
