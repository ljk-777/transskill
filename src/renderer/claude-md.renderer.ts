import { writeFileSync, cpSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Renderer } from './renderer.interface.js';
import type { FormatType, IntermediateSkill, SkillDirectory, DirectoryConversionResult } from '../core/types.js';
import { copyAttachedFiles } from '../utils/file-copier.js';

export class ClaudeMDRenderer implements Renderer {
  readonly format: FormatType = 'claude.md';
  readonly extension = '.md';

  render(skill: IntermediateSkill): string {
    const lines: string[] = [];
    lines.push('# CLAUDE.md');
    lines.push('');
    lines.push('## Project');
    lines.push(skill.description || 'No description provided.');
    lines.push('');

    const instructions = skill.instructions || '';
    const instrLines = instructions.split('\n').filter((l) => l.trim().length > 0);

    if (instrLines.length > 0) {
      lines.push('## Conventions');
      lines.push('');
      for (const line of instrLines) {
        if (line.startsWith('-') || line.startsWith('*') || line.startsWith('#')) {
          lines.push(line);
        } else {
          lines.push(`- ${line}`);
        }
      }
      lines.push('');
    }

    return lines.join('\n').trim() + '\n';
  }

  renderDirectory(
    skillDir: SkillDirectory,
    skill: IntermediateSkill,
    outputPath: string,
  ): DirectoryConversionResult {
    const allCopied: string[] = [];
    const allSkipped: string[] = [];

    const mdPath = join(outputPath, 'CLAUDE.md');
    writeFileSync(mdPath, this.render(skill), 'utf-8');

    if (skill.metadata.attachedFiles && skill.metadata.attachedFiles.length > 0) {
      const result = copyAttachedFiles(skill.metadata.attachedFiles, outputPath);
      allCopied.push(...result.copied);
      allSkipped.push(...result.skipped);
    } else {
      // Copy .claude/rules/ extra files
      for (const extraFile of skillDir.extraFiles) {
        const relativeName = extraFile.split('/').pop() || extraFile.split('\\').pop() || '';
        const targetDir = join(outputPath, '.claude', 'rules');
        const target = join(targetDir, relativeName);
        try {
          if (!existsSync(targetDir)) {
            mkdirSync(targetDir, { recursive: true });
          }
          cpSync(extraFile, target, { recursive: true });
          allCopied.push(target);
        } catch {
          allSkipped.push(extraFile);
        }
      }
    }

    return {
      skillName: skill.name,
      mainOutput: mdPath,
      copiedFiles: allCopied,
      skippedFiles: allSkipped,
    };
  }
}
