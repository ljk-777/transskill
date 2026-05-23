/** Supported agent skill formats */
export type FormatType =
  | 'skill.md'
  | '.cursorrules'
  | '.mdc'
  | 'mcp.json'
  | 'soul.md'
  | 'agents.md'
  | 'windsurfrules'
  | 'claude.md';

/** User's original input source */
export type InputSource =
  | { kind: 'local-file'; path: string }
  | { kind: 'local-directory'; path: string }
  | { kind: 'github'; repo: string; ref?: string; subpath?: string }
  | { kind: 'github-url'; url: string };

/** Resolved input ready for processing */
export interface ResolvedInput {
  localPath: string;
  source: InputSource;
  type: 'file' | 'directory';
  isRemote: boolean;
  cleanup?: () => Promise<void>;
}

/** A complete skill directory structure */
export interface SkillDirectory {
  name: string;
  rootPath: string;
  skillFile: string;
  scriptsDir?: string;
  referencesDir?: string;
  assetsDir?: string;
  extraFiles: string[];
}

/** Platform-agnostic intermediate skill representation */
export interface IntermediateSkill {
  name: string;
  description: string;
  instructions: string;
  metadata: {
    sourceFormat: FormatType;
    author?: string;
    version?: string;
    tags?: string[];
    rawFrontmatter?: Record<string, unknown>;
    attachedFiles?: AttachedFile[];
    warnings?: string[];
  };
  platformSpecific: {
    cursor?: CursorSpecific;
    claude?: ClaudeSpecific;
    openclaw?: OpenClawSpecific;
    mcp?: MCPSpecific;
  };
}

/** File attached to a skill directory */
export interface AttachedFile {
  relativePath: string;
  absolutePath: string;
  type: 'script' | 'reference' | 'asset' | 'unknown';
}

/** Cursor-specific configuration */
export interface CursorSpecific {
  globs?: string[];
  alwaysApply?: boolean;
}

/** Claude Code-specific configuration */
export interface ClaudeSpecific {
  /** CLAUDE.md sections detected */
  sections?: string[];
  /** Whether the file references auto memory */
  autoMemory?: boolean;
  /** Claude Code specific settings */
  disableModelInvocation?: boolean;
  manualOnly?: boolean;
}

/** OpenClaw-specific configuration */
export interface OpenClawSpecific {
  runtime?: 'subagent' | 'main';
  mountPath?: string;
}

/** MCP-specific configuration */
export interface MCPSpecific {
  tools?: MCPTool[];
  command?: string;
  args?: string[];
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** Conversion report */
export interface ConversionReport {
  sourceFormat: FormatType;
  targetFormat: FormatType;
  warnings: string[];
  preserved: string[];
  lost: string[];
}

/** Directory conversion result */
export interface DirectoryConversionResult {
  skillName: string;
  mainOutput: string;
  copiedFiles: string[];
  skippedFiles: string[];
}
