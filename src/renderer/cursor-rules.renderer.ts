import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import type { Renderer } from './renderer.interface.js';
import type { FormatType, IntermediateSkill, SkillDirectory, DirectoryConversionResult } from '../core/types.js';
import { copyAttachedFiles, copyDirectoryTree } from '../utils/file-copier.js';

export class CursorRulesRenderer implements Renderer {
  readonly format: FormatType = '.cursorrules';
  readonly extension = '.cursorrules';

  render(skill: IntermediateSkill): string {
    const parts: string[] = [];

    // Use description as heading (allows clean round-trip re-parse)
    const heading = skill.description ? skill.description : skill.name;
    parts.push(`# ${heading}`);
    parts.push('');
    parts.push(skill.instructions || '');
    return parts.join('\n').trim() + '\n';
  }

  renderDirectory(
    skillDir: SkillDirectory,
    skill: IntermediateSkill,
    outputPath: string,
  ): DirectoryConversionResult {
    const allCopied: string[] = [];
    const allSkipped: string[] = [];

    const rulesPath = join(outputPath, `${skillDir.name}.cursorrules`);
    writeFileSync(rulesPath, this.render(skill), 'utf-8');

    if (skill.metadata.attachedFiles && skill.metadata.attachedFiles.length > 0) {
      const result = copyAttachedFiles(skill.metadata.attachedFiles, outputPath);
      allCopied.push(...result.copied);
      allSkipped.push(...result.skipped);
    } else {
      if (skillDir.scriptsDir) {
        const target = join(outputPath, 'scripts');
        allCopied.push(...copyDirectoryTree(skillDir.scriptsDir, target));
      }
      if (skillDir.assetsDir) {
        const target = join(outputPath, 'assets');
        allCopied.push(...copyDirectoryTree(skillDir.assetsDir, target));
      }
    }

    return {
      skillName: skill.name,
      mainOutput: rulesPath,
      copiedFiles: allCopied,
      skippedFiles: allSkipped,
    };
  }
}
