import { join } from 'node:path';
import { writeFileSync, cpSync, mkdirSync, existsSync } from 'node:fs';
import matter from 'gray-matter';
import type { Renderer } from './renderer.interface.js';
import type { FormatType, IntermediateSkill, SkillDirectory, DirectoryConversionResult } from '../core/types.js';

/**
 * Renders IntermediateSkill back to SKILL.md format.
 *
 * Output: YAML frontmatter (name, description, tags, author, version)
 *         + Markdown body (instructions)
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

    if (skillDir.scriptsDir) {
      const target = join(outputPath, 'scripts');
      try {
        cpSync(skillDir.scriptsDir, target, { recursive: true });
        copied.push(target);
      } catch {
        skipped.push(skillDir.scriptsDir);
      }
    }

    if (skillDir.referencesDir) {
      const target = join(outputPath, 'references');
      try {
        cpSync(skillDir.referencesDir, target, { recursive: true });
        copied.push(target);
      } catch {
        skipped.push(skillDir.referencesDir);
      }
    }

    if (skillDir.assetsDir) {
      const target = join(outputPath, 'assets');
      try {
        cpSync(skillDir.assetsDir, target, { recursive: true });
        copied.push(target);
      } catch {
        skipped.push(skillDir.assetsDir);
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
