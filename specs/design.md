# TransSkill — 设计文档

> 版本: v0.2 | 最后更新: 2026-05-23 | 状态: Draft

---

## 1. 架构总览

### 1.1 四层架构（新增 InputResolver 层）

```
┌─────────────────────────────────────────────────┐
│                   CLI 层                          │
│         (commander.js - 命令解析与路由)            │
│  transskill convert <input> [options]           │
│  transskill --version / --help                  │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│             InputResolver 层                      │  ← 新增
│                                                   │
│  ┌────────────────┐  ┌───────────────────┐       │
│  │ LocalResolver  │  │ GitHubResolver    │       │
│  │ ./path/        │  │ gh:user/repo      │       │
│  │ file.ext       │  │ github.com/...    │       │
│  └───────┬────────┘  └─────────┬─────────┘       │
│          │                     │                  │
│          └─────────┬───────────┘                  │
│                    ▼                              │
│         ┌──────────────────┐                      │
│         │ 统一输入(本地路径) │                      │
│         └──────────────────┘                      │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│               转换引擎层                          │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │ Parser   │ → │ Mapper   │ → │ Renderer │     │
│  │ 输入解析  │   │ 语义映射  │   │ 目标输出  │     │
│  └──────────┘   └──────────┘   └──────────┘     │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│               共享模型层                          │
│  ┌──────────────────────────────────────┐       │
│  │           IntermediateSkill           │       │
│  │     (平台无关的中间表示)               │       │
│  └──────────────────────────────────────┘       │
└─────────────────────────────────────────────────┘
```

### 1.2 核心设计理念

**管道模式（Pipeline）**：每个转换操作 = 1个InputResolver + 1个Parser + 1个Mapper + 1个Renderer。

```
输入: gh:user/weather-skill
      │
      ▼
InputResolver: GitHubResolver
  ├── git clone --depth 1 到 /tmp/transskill-xxx/
  └── 返回本地路径 /tmp/transskill-xxx/weather-skill/
      │
      ▼
Pipeline (每找到一个 skill 子目录执行一次):
  Parser(SKILL.md)  →  IntermediateSkill
  Mapper(skill.md → .cursorrules)  →  IntermediateSkill (转换后)
  Renderer(.cursorrules)  →  string
      │
      ▼
输出: ./weather-skill.cursorrules (+ 附属文件复制)
```

### 1.3 单文件 vs 整 Skill 目录的处理分支

```
                   ┌──────────────────────┐
                   │    InputResolver     │
                   │    解析输入源        │
                   └─────────┬────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │ 输入是一个目录？│
                    └────┬──────┬────┘
                   是     │      │    否
                         ▼      ▼
             ┌────────────────┐  ┌────────────────┐
             │ 目录模式        │  │ 单文件模式      │
             │                │  │                │
             │ ① 扫描子目录    │  │ 单文件解析      │
             │ ② 找SKILL.md   │  │ 直接映射        │
             │ ③ 集体转换      │  │ 单文件渲染      │
             │ ④ 复制附属文件  │  │                │
             └────────────────┘  └────────────────┘
```

---

## 2. 数据模型

### 2.1 输入源类型

```typescript
/** 用户输入的原始来源 */
type InputSource =
  | { kind: 'local-file'; path: string }
  | { kind: 'local-directory'; path: string }
  | { kind: 'github'; repo: string; ref?: string; subpath?: string }
  | { kind: 'github-url'; url: string };

/** InputResolver 的输出 */
interface ResolvedInput {
  /** 解析后的本地路径（最终可访问的文件或目录） */
  localPath: string;
  /** 原始输入类型 */
  source: InputSource;
  /** 是文件还是目录 */
  type: 'file' | 'directory';
  /** 是否来自远程（需要后续清理） */
  isRemote: boolean;
  /** 清理回调（删除临时文件） */
  cleanup?: () => Promise<void>;
}
```

### 2.2 Skill 目录结构模型

```typescript
/** 一个完整 skill 目录的解析结果 */
interface SkillDirectory {
  /** skill 名称（目录名） */
  name: string;
  /** 根路径 */
  rootPath: string;
  /** SKILL.md 文件（必须存在） */
  skillFile: string;
  /** 附属脚本目录 */
  scriptsDir?: string;
  /** 参考文档目录 */
  referencesDir?: string;
  /** 静态资源目录 */
  assetsDir?: string;
  /** 其他未识别的文件/目录 */
  extraFiles: string[];
}

/** 目录模式的转换结果 */
interface DirectoryConversionResult {
  skillName: string;
  /** 主转换文件 */
  mainOutput: string;
  /** 复制的附属文件列表 */
  copiedFiles: string[];
  /** 未处理的文件列表 */
  skippedFiles: string[];
}
```

### 2.3 中间表示 `IntermediateSkill`

```typescript
interface IntermediateSkill {
  /** 技能名称（必填） */
  name: string;
  
  /** 技能描述（必填） */
  description: string;
  
  /** 核心指令正文（必填）—— Markdown 格式 */
  instructions: string;
  
  /** 元数据 */
  metadata: {
    /** 来源格式 */
    sourceFormat: FormatType;
    /** 作者 */
    author?: string;
    /** 版本 */
    version?: string;
    /** 标签 */
    tags?: string[];
    /** 原始 frontmatter（未映射的字段保留在此） */
    rawFrontmatter?: Record<string, unknown>;
    /** 附属文件引用（在 skill 目录模式时填充） */
    attachedFiles?: AttachedFile[];
  };
  
  /** 平台特有配置 */
  platformSpecific: {
    cursor?: CursorSpecific;
    claude?: ClaudeSpecific;
    openclaw?: OpenClawSpecific;
    mcp?: MCPSpecific;
  };
}

/** 附属文件描述 */
interface AttachedFile {
  relativePath: string;
  absolutePath: string;
  type: 'script' | 'reference' | 'asset' | 'unknown';
}

/** 支持的所有格式 */
type FormatType = 
  | 'skill.md' 
  | '.cursorrules' 
  | '.mdc' 
  | 'mcp.json'
  | 'soal.md'
  | 'agents.md'
  | 'windsurfrules';
```

### 2.4 平台特有扩展

```typescript
/** Cursor 平台特有配置 */
interface CursorSpecific {
  /** 文件 glob 匹配模式（.mdc 用） */
  globs?: string[];
  /** 是否总是加载 */
  alwaysApply?: boolean;
}

/** Claude Code 平台特有配置 */
interface ClaudeSpecific {
  /** 是否禁用模型自动调用 */
  disableModelInvocation?: boolean;
  /** 是否需要通过 /command 手动触发 */
  manualOnly?: boolean;
}

/** OpenClaw 平台特有配置 */
interface OpenClawSpecific {
  /** 运行时环境设置 */
  runtime?: 'subagent' | 'main';
  /** 挂载路径 */
  mountPath?: string;
}

/** MCP 平台特有配置 */
interface MCPSpecific {
  /** 工具定义列表 */
  tools?: MCPTool[];
  /** MCP 服务器命令 */
  command?: string;
  /** MCP 服务器参数 */
  args?: string[];
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}
```

---

## 3. InputResolver 设计（新增）

### 3.1 InputResolver 接口

```typescript
interface InputResolver {
  /** 判断是否能处理该输入 */
  supports(input: string): boolean;
  
  /** 将输入解析为本地路径 */
  resolve(input: string): Promise<ResolvedInput>;
}
```

### 3.2 LocalResolver

```typescript
class LocalResolver implements InputResolver {
  supports(input: string): boolean {
    // 所有以 ./ ../ / ~ 开头或看起来像路径的
    return input.startsWith('.') || input.startsWith('/') || 
           input.startsWith('~') || existsSync(input);
  }
  
  async resolve(input: string): Promise<ResolvedInput> {
    const absPath = resolveSync(input);
    const stat = await stat(absPath);
    
    return {
      localPath: absPath,
      source: { kind: stat.isFile() ? 'local-file' : 'local-directory', path: absPath },
      type: stat.isFile() ? 'file' : 'directory',
      isRemote: false,
    };
  }
}
```

### 3.3 GitHubResolver

```typescript
class GitHubResolver implements InputResolver {
  private readonly tempDir: string;
  
  supports(input: string): boolean {
    // gh:user/repo 或 https://github.com/... 格式
    return /^gh:/i.test(input) || /^https?:\/\/github\.com\//i.test(input);
  }
  
  async resolve(input: string): Promise<ResolvedInput> {
    // 1. 解析出 owner/repo[/subpath]
    const { repo, subpath } = parseGitHubRef(input);
    
    // 2. 在临时目录 clone
    const cloneDir = await mkdtemp(path.join(os.tmpdir(), 'transskill-'));
    await exec(`git clone --depth 1 https://github.com/${repo}.git ${cloneDir}`);
    
    // 3. 如果有子路径，定位到子目录
    const targetPath = subpath ? path.join(cloneDir, subpath) : cloneDir;
    
    return {
      localPath: targetPath,
      source: { kind: 'github', repo, subpath },
      type: await isDirectory(targetPath) ? 'directory' : 'file',
      isRemote: true,
      cleanup: async () => rm(cloneDir, { recursive: true }),
    };
  }
}
```

### 3.4 InputResolver 管道

```typescript
// resolver-registry.ts
const resolvers: InputResolver[] = [
  new GitHubResolver(),
  new LocalResolver(),
];

async function resolveInput(input: string): Promise<ResolvedInput> {
  for (const resolver of resolvers) {
    if (resolver.supports(input)) {
      try {
        return await resolver.resolve(input);
      } catch (err) {
        throw new TransSkillError(
          'INPUT_RESOLVE_FAILED',
          `无法解析输入: ${input}`,
          { cause: err }
        );
      }
    }
  }
  throw new TransSkillError(
    'UNSUPPORTED_INPUT',
    `不支持的输入格式: ${input}，支持 本地路径 和 GitHub 仓库`
  );
}
```

---

## 4. Parser 设计

### 4.1 Parser 接口

```typescript
interface Parser {
  /** 支持的格式 */
  readonly format: FormatType;
  
  /** 解析文件内容为中间表示 */
  parse(content: string, filePath?: string): IntermediateSkill;
  
  /** 解析整个 skill 目录 */
  parseDirectory(dirPath: string): SkillDirectory;
  
  /** 快速检测文件是否可以被本 Parser 解析 */
  detect(content: string, filePath?: string): boolean;
}
```

### 4.2 Parser 实现列表

| Parser | 格式 | 关键逻辑 |
|:------|:----|:--------|
| `SKILLMdParser` | SKILL.md | 用 gray-matter 解析 YAML frontmatter，提取 name/description/instructions |
| `CursorRulesParser` | .cursorrules | 纯文本全部作为 instructions，name=文件名，description=首行或 fallback |
| `MdcParser` | .mdc | gray-matter 解析 frontmatter，提取 description/globs/alwaysApply + instructions |
| `MCPJsonParser` | mcp.json | 解析 JSON Schema，提取 tools 列表 + description，生成 instructions |
| `SOULMdParser` | SOUL.md | 解析 OpenClaw 身份定义文件，提取 persona/boundaries |
| `AGENTSMdParser` | AGENTS.md | 解析 OpenClaw 操作规则文件 |

### 4.3 Parser 注册机制

```typescript
const parserRegistry = new Map<FormatType, Parser>();

function registerParser(parser: Parser): void {
  parserRegistry.set(parser.format, parser);
}

function getParser(format: FormatType): Parser {
  const parser = parserRegistry.get(format);
  if (!parser) throw new Error(`Unsupported format: ${format}`);
  return parser;
}
```

---

## 5. Mapper 设计

### 5.1 Mapper 接口

```typescript
interface Mapper {
  /** 将 IntermediateSkill 从一个平台映射到另一个 */
  map(skill: IntermediateSkill, targetFormat: FormatType): IntermediateSkill;
  
  /** 支持的源格式列表 */
  supportedSources(): FormatType[];
  
  /** 支持的目标格式列表 */
  supportedTargets(): FormatType[];
}
```

### 5.2 映射策略

映射的核心是决定**哪些字段可以直接搬运、哪些需要转换、哪些会丢失**。

```typescript
class DefaultMapper implements Mapper {
  map(skill: IntermediateSkill, targetFormat: FormatType): IntermediateSkill {
    const result = deepClone(skill);
    
    switch (targetFormat) {
      case '.cursorrules':
        result.metadata.warnings = [
          '.cursorrules 不支持多技能多文件结构，仅核心指令被保留'
        ];
        break;
        
      case '.mdc':
        if (!result.platformSpecific.cursor) {
          result.platformSpecific.cursor = { alwaysApply: false };
        }
        break;
        
      case 'skill.md':
        // 标准格式，保留所有字段
        break;
    }
    
    result.metadata.sourceFormat = targetFormat;
    return result;
  }
}
```

### 5.3 映射损失报告

```typescript
interface ConversionReport {
  sourceFormat: FormatType;
  targetFormat: FormatType;
  warnings: string[];
  preserved: string[];
  lost: string[];
}
```

示例输出：
```
⚠️  转换完成，存在以下信息丢失：
  - 已保留: name, description, instructions
  - 未保留: platformSpecific.claude.disableModelInvocation（目标格式不支持）
  - 建议: 转换后可手动编辑 .mdc 文件添加文件范围限定
```

---

## 6. Renderer 设计

### 6.1 Renderer 接口

```typescript
interface Renderer {
  /** 支持的输出格式 */
  readonly format: FormatType;
  
  /** 将 IntermediateSkill 渲染为目标格式的字符串 */
  render(skill: IntermediateSkill): string;
  
  /** 输出文件扩展名 */
  readonly extension: string;
  
  /** 处理 skill 目录转换中的附属文件复制 */
  renderDirectory?(skillDir: SkillDirectory, intermediate: IntermediateSkill, outputPath: string): DirectoryConversionResult;
}
```

### 6.2 Renderer 实现

<details>
<summary>SKILLMdRenderer</summary>

```typescript
class SKILLMdRenderer implements Renderer {
  format = 'skill.md' as FormatType;
  extension = '.md';
  
  render(skill: IntermediateSkill): string {
    const frontmatter: Record<string, unknown> = {
      name: skill.name,
      description: skill.description,
    };
    if (skill.metadata.rawFrontmatter) {
      Object.assign(frontmatter, skill.metadata.rawFrontmatter);
    }
    return matter.stringify(skill.instructions, frontmatter);
  }
}
```
</details>

<details>
<summary>CursorRulesRenderer</summary>

```typescript
class CursorRulesRenderer implements Renderer {
  format = '.cursorrules' as FormatType;
  extension = '.cursorrules';
  
  render(skill: IntermediateSkill): string {
    const header = [
      `# ${skill.name}`,
      `# ${skill.description}`,
      '#',
      `# Generated by TransSkill from ${skill.metadata.sourceFormat}`,
      '',
    ].join('\n');
    return header + skill.instructions;
  }
  
  /** 目录模式：SKILL.md → .cursorrules + 附属文件平铺复制 */
  async renderDirectory(
    skillDir: SkillDirectory, 
    _intermediate: IntermediateSkill, 
    outputPath: string
  ): Promise<DirectoryConversionResult> {
    // 1. 写主文件
    const mainOutput = path.join(outputPath, `${skillDir.name}.cursorrules`);
    writeFileSync(mainOutput, this.render(_intermediate));
    
    // 2. 复制附属文件
    const copied: string[] = [];
    if (skillDir.scriptsDir) {
      // scripts/ → ./scripts/
      const target = path.join(outputPath, 'scripts');
      cp(skillDir.scriptsDir, target, { recursive: true });
      copied.push(target);
    }
    // ...
    
    return {
      skillName: skillDir.name,
      mainOutput,
      copiedFiles: copied,
      skippedFiles: [],
    };
  }
}
```
</details>

### 6.3 Renderer 注册

```typescript
const rendererRegistry = new Map<FormatType, Renderer>();

function registerRenderer(renderer: Renderer): void {
  rendererRegistry.set(renderer.format, renderer);
}

function getRenderer(format: FormatType): Renderer {
  const renderer = rendererRegistry.get(format);
  if (!renderer) throw new Error(`Unsupported output format: ${format}`);
  return renderer;
}
```

---

## 7. CLI 设计

### 7.1 命令结构

```
transskill
├── convert <input>           # 转换技能（文件/目录/GitHub）
│   ├── --to, -t <format>      # 指定输出格式（必填）
│   ├── --output, -o <path>    # 输出目录（默认当前目录）
│   ├── --install-to <path>    # 直接安装到目标平台配置目录
│   ├── --glob <pattern>       # 仅 .mdc 输出时生效
│   ├── --always-apply         # 仅 .mdc 输出时生效
│   ├── --verbose, -v          # 显示详细转换报告
│   └── --dry-run              # 仅显示将要做什么，不实际执行
│
├── list-formats               # 列出所有支持的格式
│
├── validate <input>           # 验证技能文件/目录格式
│   └── --format, -f <format>  # 指定格式
│
└── --version, -v              # 查看版本
```

### 7.2 使用示例

```bash
# === 本地文件 ===

# 单文件：.cursorrules → SKILL.md
$ transskill convert .cursorrules --to skill.md -o my-skill.md

# 单文件：SKILL.md → .cursorrules
$ transskill convert my-skill.skill.md --to .cursorrules

# === 完整 skill 目录 ===

# 完整 skill 目录 → Cursor 规则
$ transskill convert ./weather-skill/ --to .cursorrules

# SKILL.md → .mdc（带文件范围限定）
$ transskill convert my-skill.skill.md --to .mdc \
  --glob "**/*.ts" \
  --always-apply \
  -o .cursor/rules/

# === GitHub 远程 ===

# GitHub 仓库 → 当前目录
$ transskill convert gh:user/weather-skill --to .cursorrules

# GitHub 子路径 → 直接安装到 Claude Code
$ transskill convert gh:user/skills-repo/weather --to skill.md \
  --install-to ~/.claude/skills/

# GitHub 完整 URL
$ transskill convert https://github.com/user/weather-skill --to .mdc

# === 其他 ===

# 查看所有支持的格式
$ transskill list-formats

# dry-run：看看会做什么，不实际执行
$ transskill convert gh:user/weather-skill --to .cursorrules --dry-run

# 验证文件格式
$ transskill validate my-skill.skill.md
```

### 7.3 自动格式检测逻辑

```
输入 → InputResolver 解析为本地路径
     │
     ├── 是文件 → 根据扩展名推断格式
     │             .md            → 检测 frontmatter → SKILL.md
     │             .cursorrules   → .cursorrules
     │             .mdc           → .mdc
     │             .json          → MCP JSON
     │
     └── 是目录 → 扫描目录内容
                   ├── 含 SKILL.md → skill 目录模式
                   └── 含多个 skill 子目录 → 批量目录模式
```

### 7.4 安装模式（--install-to）

```bash
# --install-to 直接决定目标目录结构
$ transskill convert gh:user/weather-skill --to skill.md \
  --install-to ~/.claude/skills/

# 等价于：
#   1. 解析 → 映射 → 渲染
#   2. 写入 ~/.claude/skills/weather-skill/SKILL.md
#   3. 复制附属文件到 ~/.claude/skills/weather-skill/scripts/

$ transskill convert gh:user/weather-skill --to .mdc \
  --install-to .cursor/rules/

# 等价于：
#   1. 解析 → 映射 → 渲染
#   2. 写入 .cursor/rules/weather-skill.mdc
```

---

## 8. 目录结构

```
transskill/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md
│
├── specs/                          # Spec 设计文档
│   ├── requirements.md
│   ├── design.md
│   └── tasks.md
│
├── src/
│   ├── index.ts                    # CLI 入口
│   │
│   ├── cli/
│   │   ├── commands/
│   │   │   ├── convert.ts          # convert 命令（含目录模式）
│   │   │   ├── list-formats.ts     # list-formats 命令
│   │   │   └── validate.ts         # validate 命令
│   │   └── cli.ts                  # commander 配置
│   │
│   ├── core/
│   │   ├── types.ts                # 所有数据模型定义
│   │   ├── intermediate-skill.ts   # IntermediateSkill 类
│   │   ├── conversion-report.ts    # 转换报告
│   │   └── errors.ts              # 自定义错误类型
│   │
│   ├── resolver/                   # ← 新增
│   │   ├── resolver.interface.ts   # InputResolver 接口
│   │   ├── resolver-registry.ts    # 注册中心
│   │   ├── local.resolver.ts       # 本地路径解析
│   │   ├── github.resolver.ts      # GitHub 仓库解析
│   │   └── utils.ts               # URL 解析、临时目录清理
│   │
│   ├── parser/
│   │   ├── parser.interface.ts     # Parser 接口
│   │   ├── parser-registry.ts      # Parser 注册中心
│   │   ├── skill-md.parser.ts      # SKILL.md 解析器
│   │   ├── cursor-rules.parser.ts  # .cursorrules 解析器
│   │   ├── mdc.parser.ts           # .mdc 解析器
│   │   ├── mcp-json.parser.ts      # MCP JSON 解析器
│   │   ├── soul-md.parser.ts       # SOUL.md 解析器
│   │   └── skill-directory.ts      # Skill 目录扫描器（新增）
│   │
│   ├── mapper/
│   │   ├── mapper.interface.ts     # Mapper 接口
│   │   ├── default.mapper.ts       # 默认映射器
│   │   └── mcp.mapper.ts           # MCP 专用映射器
│   │
│   ├── renderer/
│   │   ├── renderer.interface.ts   # Renderer 接口
│   │   ├── renderer-registry.ts    # Renderer 注册中心
│   │   ├── skill-md.renderer.ts    # SKILL.md 渲染器
│   │   ├── cursor-rules.renderer.ts
│   │   ├── mdc.renderer.ts         # .mdc 渲染器
│   │   └── mcp-json.renderer.ts    # MCP JSON 渲染器
│   │
│   └── utils/
│       ├── format-detector.ts      # 格式自动检测
│       ├── file-utils.ts           # 文件读写工具
│       └── logger.ts               # 日志输出
│
├── test/
│   ├── fixtures/
│   │   ├── sample.skill.md
│   │   ├── sample.cursorrules
│   │   ├── sample.mdc
│   │   ├── sample.mcp.json
│   │   └── sample-skill/           # 完整 skill 目录 fixture
│   │       ├── SKILL.md
│   │       ├── scripts/
│   │       │   └── do-something.py
│   │       └── references/
│   │           └── README.md
│   │
│   ├── resolver/
│   │   ├── local.resolver.test.ts
│   │   └── github.resolver.test.ts
│   │
│   ├── parser/
│   │   ├── skill-md.parser.test.ts
│   │   ├── cursor-rules.parser.test.ts
│   │   └── skill-directory.test.ts
│   │
│   ├── mapper/
│   │   └── default.mapper.test.ts
│   │
│   ├── renderer/
│   │   ├── skill-md.renderer.test.ts
│   │   ├── cursor-rules.renderer.test.ts
│   │   └── mdc.renderer.test.ts
│   │
│   └── integration/
│       ├── full-conversion.test.ts     # 端到端单文件
│       └── directory-conversion.test.ts # 端到端目录转换
│
└── examples/
    ├── local-file-conversion.md
    ├── github-conversion.md
    └── directory-conversion.md
```

---

## 9. 错误处理设计

### 9.1 自定义错误类型

```typescript
class TransSkillError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

type ErrorCode = 
  | 'UNSUPPORTED_INPUT'           // 不支持的输入格式
  | 'INPUT_RESOLVE_FAILED'        // 输入解析失败
  | 'UNSUPPORTED_OUTPUT_FORMAT'   // 不支持的输出格式
  | 'INVALID_FRONTMATTER'         // frontmatter 解析失败
  | 'INVALID_JSON'                // JSON 解析失败
  | 'FILE_NOT_FOUND'              // 输入文件不存在
  | 'DIR_NOT_FOUND'               // 输入目录不存在（目录模式）
  | 'NO_SKILL_FOUND'              // 目录中找不到 SKILL.md
  | 'GIT_CLONE_FAILED'            // GitHub clone 失败
  | 'GIT_CLEANUP_FAILED'          // 临时文件清理失败（非致命）
  | 'EMPTY_INSTRUCTIONS'          // 指令内容为空
  | 'CONVERSION_WARNING'          // 转换有信息丢失（非致命）;
```

### 9.2 用户友好的错误输出

```
# 目录模式成功
✅  转换完成（目录模式）
   from: ./weather-skill/ → to: .cursorrules
   ├── weather-skill/SKILL.md → weather-skill.cursorrules
   ├── weather-skill/scripts/ → ./scripts/（已复制）
   └── weather-skill/references/ → ./references/（已复制）

# 带警告的成功
✅  转换完成（存在信息丢失）
   ⚠️  附属文件 scripts/ 和目标平台的格式不兼容，已平铺复制

# GitHub 错误
❌  转换失败
   原因: 无法访问仓库 gh:user/weather-skill
   提示: 检查仓库是否存在，公开仓库无需认证

# 目录中找不到技能
❌  转换失败
   原因: 在目录 ./my-folder/ 中没有找到 SKILL.md 文件
   提示: 技能目录应包含 SKILL.md 文件
```

---

## 10. 测试策略

### 10.1 单元测试
- 每个 Parser 至少一个测试用例：合法输入 + 边界输入 + 非法输入
- 每个 Renderer 至少一个测试用例：标准输出 + 带平台扩展的输出
- Mapper 测试：验证映射前后字段正确性
- **InputResolver 测试**：GitHub URL 解析、本地路径规范化、错误处理

### 10.2 快照测试
- 每个 Renderer 的输出与预期快照比对
- **目录模式**的输出目录结构快照

### 10.3 集成测试
- 端到端单文件转换：读取 fixture → 解析 → 映射 → 渲染 → 验证输出
- **端到端目录转换**：读取 skill 目录 → 扫描 → 批量解析 → 映射 → 渲染目录
- **GitHub 模式**：mock `git clone` 验证调用参数（避免真实网络调用）

### 10.4 测试文件约定

```
test/fixtures/              标准输入文件
test/fixtures/sample-skill/ 完整 skill 目录 fixture
test/__snapshots__/         渲染器快照
```

---

## 11. 序列图

### 11.1 GitHub 仓库 → 本地 .cursorrules（目录模式完整流程）

```
User           CLI(commander)      InputResolver       SkillScanner      Pipeline        FileSystem
 │                   │                  │                  │               │                │
 │ convert           │                  │                  │               │                │
 │ gh:user/weather   │                  │                  │               │                │
 │ --to .cursorrules │                  │                  │               │                │
 │───▶               │                  │                  │               │                │
 │                   │ 检测到 gh: 格式   │                  │               │                │
 │                   │────────────────▶│                  │               │                │
 │                   │                  │ git clone ...    │               │                │
 │                   │                  │───────────────▶  │               │                │
 │                   │                  │◀── /tmp/xxx ─────│               │                │
 │                   │                  │                  │               │                │
 │                   │       扫描目录    │                  │               │                │
 │                   │──────────────────────────────────▶│               │                │
 │                   │                  │                  │               │                │
 │                   │   找到 skill:    │                  │               │                │
 │                   │   ├ SKILL.md     │                  │               │                │
 │                   │   ├ scripts/     │                  │               │                │
 │                   │   └ assets/      │                  │               │                │
 │                   │◀──────────────────────────────────│               │                │
 │                   │                  │                  │               │                │
 │                   │   对 SKILL.md 执行转换管道           │               │                │
 │                   │──────────────────────────────────────────────▶    │                │
 │                   │                  │                  │               │ 解析→映射→渲染  │
 │                   │                  │                  │               │───▶            │
 │                   │                  │                  │               │◀── result ────│
 │                   │                  │                  │               │                │
 │                   │   复制附属文件     │                  │               │                │
 │                   │───────────────────────────────────────────────────────────▶       │
 │                   │                  │                  │               │                │
 │                   │   清理临时 clone  │                  │               │                │
 │                   │────────────────▶│                  │               │                │
 │                   │                  │────────────────▶│               │                │
 │◀── ✅ ───────────│                  │                  │               │                │
```

---

## 12. 依赖选型

| 依赖 | 用途 | 理由 |
|:----|:----|:----|
| `commander` | CLI 框架 | 业界标准，类型友好 |
| `gray-matter` | YAML frontmatter 解析 | 最流行的 frontmatter 库 |
| `js-yaml` | YAML 序列化/反序列化 | gray-matter 的底层依赖 |
| `chalk` | 终端颜色输出 | 用户体验 |
| `execa` | 执行 git clone 等外部命令 | 比 child_process 更安全可靠 |
| `tempy` | 临时目录管理 | 创建和自动清理临时 git clone 目录 |
| `vitest` | 测试框架 | 快，TS 原生 |
| `typescript` | 语言 | 类型安全，生态好 |
| `@types/node` | Node 类型定义 | 开发依赖 |

---

## 13. 备份与延续性

### 13.1 版本控制
- specs/ 目录下的所有文档随代码一起提交
- requirements.md 中的用户故事 ID 作为 Git commit 引用的锚点
- 每个 Release 对应一个 Spec 版本

### 13.2 文档维护
- 每次新增格式支持时，更新所有三个文档
- design.md 中的架构变更需要团队评审
- tasks.md 作为开发进度的实时追踪工具

### 13.3 新增输入源的流程
1. 在 `resolver/` 下实现新的 `InputResolver`（实现 `supports` + `resolve`）
2. 注册到 `resolver-registry.ts`
3. 添加对应的测试用例
4. 更新 `list-formats` 输出
