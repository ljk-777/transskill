import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Renderer } from './renderer.interface.js';
import type { FormatType, IntermediateSkill, SkillDirectory, DirectoryConversionResult } from '../core/types.js';
import { copyAttachedFiles } from '../utils/file-copier.js';

export class MCPJsonRenderer implements Renderer {
  readonly format: FormatType = 'mcp.json';
  readonly extension = '.json';

  render(skill: IntermediateSkill): string {
    const tools = skill.platformSpecific.mcp?.tools;
    const output: Record<string, unknown> = {
      name: skill.name,
      description: skill.description,
    };

    if (tools && tools.length > 0) {
      output.tools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
    } else {
      output.tools = [
        {
          name: skill.name.replace(/[^a-z0-9_]/gi, '_').toLowerCase(),
          description: skill.description || 'Tool generated from skill',
          inputSchema: { type: 'object', properties: {}, required: [] },
        },
      ];
    }

    return JSON.stringify(output, null, 2) + '\n';
  }

  renderDirectory(
    skillDir: SkillDirectory,
    skill: IntermediateSkill,
    outputPath: string,
  ): DirectoryConversionResult {
    const jsonPath = join(outputPath, `${skillDir.name}.mcp.json`);
    writeFileSync(jsonPath, this.render(skill), 'utf-8');

    const allCopied: string[] = [];
    const allSkipped: string[] = [];

    if (skill.metadata.attachedFiles && skill.metadata.attachedFiles.length > 0) {
      const result = copyAttachedFiles(skill.metadata.attachedFiles, outputPath);
      allCopied.push(...result.copied);
      allSkipped.push(...result.skipped);
    }

    return {
      skillName: skill.name,
      mainOutput: jsonPath,
      copiedFiles: allCopied,
      skippedFiles: allSkipped,
    };
  }
}
