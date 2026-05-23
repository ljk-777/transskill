import type { Parser } from './parser.interface.js';
import type { FormatType, IntermediateSkill, SkillDirectory, MCPTool } from '../core/types.js';

/**
 * Parses MCP JSON (Model Context Protocol server configuration) format.
 *
 * Input: JSON file with: { name, description, tools[] }
 * Output: IntermediateSkill with platformSpecific.mcp.tools
 */
export class MCPJsonParser implements Parser {
  readonly format: FormatType = 'mcp.json';
  readonly extension = '.json';

  parse(content: string, _filePath?: string): IntermediateSkill {
    const data = JSON.parse(content) as Record<string, unknown>;

    const name = (data.name as string) || 'mcp-server';
    const description = (data.description as string) || '';

    // Parse tools
    const rawTools = data.tools as Array<Record<string, unknown>> | undefined;
    const tools: MCPTool[] = (rawTools || []).map((t, i) => ({
      name: (t.name as string) || `tool_${i}`,
      description: (t.description as string) || '',
      inputSchema: (t.inputSchema as Record<string, unknown>) || {},
    }));

    // Build instructions from tools
    const instructions = this.buildInstructions(name, tools);

    return {
      name,
      description,
      instructions,
      metadata: {
        sourceFormat: 'mcp.json',
        tags: ['mcp'],
        rawFrontmatter: undefined,
      },
      platformSpecific: {
        mcp: {
          tools,
        },
      },
    };
  }

  parseDirectory(dirPath: string): SkillDirectory {
    return {
      name: 'mcp-server',
      rootPath: dirPath,
      skillFile: dirPath,
      extraFiles: [],
    };
  }

  detect(content: string, filePath?: string): boolean {
    if (filePath?.endsWith('.mcp.json')) return true;
    if (filePath?.endsWith('.json')) {
      try {
        const data = JSON.parse(content) as Record<string, unknown>;
        return !!data.tools && Array.isArray(data.tools);
      } catch {
        return false;
      }
    }
    return false;
  }

  private buildInstructions(serverName: string, tools: MCPTool[]): string {
    const lines: string[] = [
      `# ${serverName} — MCP Server`,
      '',
      'This MCP server provides the following tools:',
      '',
    ];

    for (const tool of tools) {
      lines.push(`## ${tool.name}`);
      lines.push('');
      lines.push(tool.description || 'No description provided.');
      lines.push('');

      const schema = tool.inputSchema as Record<string, unknown> | undefined;
      const props = (schema?.properties as Record<string, unknown>) || {};
      const required = (schema?.required as string[]) || [];
      const propKeys = Object.keys(props);

      if (propKeys.length > 0) {
        lines.push('Parameters:');
        for (const key of propKeys) {
          const prop = props[key] as Record<string, string>;
          const requiredMark = required.includes(key) ? '(required)' : '(optional)';
          lines.push(`  - ${key}: ${prop.description || key} ${requiredMark}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n').trim();
  }
}
