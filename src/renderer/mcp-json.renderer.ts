import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Renderer } from './renderer.interface.js';
import type { FormatType, IntermediateSkill, SkillDirectory, DirectoryConversionResult } from '../core/types.js';

/**
 * Renders IntermediateSkill to MCP JSON format.
 *
 * Output: { name, description, tools[] }
 * Only includes tools from platformSpecific.mcp.tools.
 * Falls back to generating a single tool from the skill instructions.
 */
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
      // Fallback: generate a single tool from instructions
      output.tools = [
        {
          name: skill.name.replace(/[^a-z0-9_]/gi, '_').toLowerCase(),
          description: skill.description || 'Tool generated from skill',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
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

    return {
      skillName: skill.name,
      mainOutput: jsonPath,
      copiedFiles: [],
      skippedFiles: [],
    };
  }
}
