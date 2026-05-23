import { join } from 'node:path';
import { writeFileSync, cpSync, mkdirSync, existsSync } from 'node:fs';
import matter from 'gray-matter';
import type { Renderer } from './renderer.interface.js';
import type { FormatType, IntermediateSkill, SkillDirectory, DirectoryConversionResult } from '../core/types.js';
import { copyAttachedFiles, copyDirectoryTree } from '../utils/file-copier.js';

/**
 * Renders IntermediateSkill back to SKILL.md format.
 */
export class SKILLMdRenderer implements Renderer {
  readonly format: FormatType = 'skill.md';
  readonly extension = '.md';

  render(skill: IntermediateSkill): string {
    const frontmatter: Record<string, unknown> = {
      name: skill.name,
      description: skill.description,
    };

    if (skill.metadata.tags) frontmatter.tags = skill.metadata.tags;
    if (skill.metadata.author) frontmatter.author = skill.metadata.author;
    if (skill.metadata.version) frontmatter.version = skill.metadata.version;

    if (skill.metadata.rawFrontmatter) {
      for (const [key, value] of Object.entries(skill.metadata.rawFrontmatter)) {
        if (!(key in frontmatter)) {
          frontmatter[key] = value;
        }
      }
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

    const skillMdPath = join(outputPath, 'SKILL.md');
    writeFileSync(skillMdPath, this.render(skill), 'utf-8');

    // Copy attached files from skill metadata (survives mapper transform)
    if (skill.metadata.attachedFiles && skill.metadata.attachedFiles.length > 0) {
      const result = copyAttachedFiles(skill.metadata.attachedFiles, outputPath);
      copied.push(...result.copied);
      skipped.push(...result.skipped);
    } else {
      // Fallback: copy from skillDir directly (pre-mapper paths)
      if (skillDir.scriptsDir) {
        const target = join(outputPath, 'scripts');
        const dirCopied = copyDirectoryTree(skillDir.scriptsDir, target);
        copied.push(...dirCopied);
      }
      if (skillDir.referencesDir) {
        const target = join(outputPath, 'references');
        const dirCopied = copyDirectoryTree(skillDir.referencesDir, target);
        copied.push(...dirCopied);
      }
      if (skillDir.assetsDir) {
        const target = join(outputPath, 'assets');
        const dirCopied = copyDirectoryTree(skillDir.assetsDir, target);
        copied.push(...dirCopied);
      }
    }

    return {
      skillName: skill.name,
      mainOutput: skillMdPath,
      copiedFiles: copied,
      skippedFiles: skipped,
    };
  }
}
