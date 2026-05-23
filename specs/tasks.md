# TransSkill — 实施任务

> 版本: v0.3 | 最后更新: 2026-05-23 18:47 CST | 基于: requirements.md v0.2 + design.md v0.2

---

## 📊 项目进度总览

| 阶段 | 内容 | 预估 | 状态 | 完成日期 |
|:----|:----|:----:|:----:|:--------:|
| **Phase 0** | 项目脚手架 | 0.5 天 | ✅ 已完成 | 2026-05-23 |
| **Phase 1** | 核心数据模型 + Resolver | 1.5 天 | ✅ 已完成 | 2026-05-23 |
| **Phase 2** | Parser（含目录扫描） | 2 天 | ✅ 已完成 | 2026-05-23 |
| **Phase 3** | Mapper + Renderer（含目录渲染） | 2 天 | ✅ 已完成 | 2026-05-23 |
| **Phase 4** | CLI 接口 | 1.5 天 | ⬜ 未开始 | — |
| **Phase 5** | 测试覆盖 | 1.5 天 | ⬜ 未开始 | — |
| **Phase 6** | 工具链完善（CI/发布） | 0.5 天 | ⬜ 未开始 | — |

**已完成 3/7 个 Phase，进度 43% | 剩余 5.5 天预估**

---

## 🧭 远景规划：Marketplace + Security（独立时间线）

> 详见 [marketplace-vision.md](./marketplace-vision.md) — 非当前实施阶段

| Phase | 内容 | 预估 | 备注 |
|:-----|:------|:----:|:-----|
| **Phase A** | Registry MVP（search / install / list） | 2 周 | GitHub 组织或 npm 生态 |
| **Phase B** | Security Audit L1-L3（指令/shell/权限） | 1 周 | 安全评分机制 |
| **Phase C** | transskill.json 项目 + 版本管理 | 1 周 | lockfile 依赖管理 |
| **Phase D** | publish 流程 + 社区贡献 | 1 周 | 审核机制待定 |
| **Phase E** | MCP 专项审计 + Web UI | 2 周 | 沙箱动态检测 |
| **Phase F** | 自动更新 + CI 集成 | 1 周 | Dependabot 风格 |

---

---

## Phase 0 — 项目脚手架

> 优先级: P0 | 预估: 0.5 天

| ID | 任务 | 描述 | 产出物 | 依赖 | 状态 |
|:--|:----|:-----|:-----|:----|:---:|
| T-001 | 初始化 npm 项目 | `npm init`，配置 `package.json`（name, version, bin, scripts） | `package.json` | 无 | ✅ |
| T-002 | 配置 TypeScript | `tsconfig.json`，target=ES2022，module=NodeNext，strict 模式 | `tsconfig.json` | T-001 | ✅ |
| T-003 | 配置 Vitest | `vitest.config.ts`，配置 fixtures 路径别名 | `vitest.config.ts` | T-001 | ✅ |
| T-004 | 配置 ESLint + Prettier | 统一的代码风格配置文件 | `.eslintrc.js`, `.prettierrc` | T-001 | ✅ |
| T-005 | 创建目录结构 | 按 design.md §8 创建所有目录 | `src/`, `test/`, `examples/` | T-001 | ✅ |
| T-006 | 创建入口文件 | `src/index.ts`，`#!/usr/bin/env node` shebang | `src/index.ts` | T-005 | ✅ |
| T-007 | 安装基础依赖 | `commander`, `gray-matter`, `js-yaml`, `chalk`, `execa`, `tempy`, `typescript`, `vitest` | `node_modules/` | T-001 | ✅ |

**验收结果：**
- ✅ `npm run build` 成功
- ✅ `npm test` 输出 0 tests（空测试套）
- ✅ `node dist/index.js --help` 显示帮助信息
- ✅ 已推送至 GitHub：https://github.com/ljk-777/transskill

---

## Phase 1 — 核心数据模型 + InputResolver

> 对应需求: US-004, US-006, NFR-007, NFR-008 | 优先级: P0 | 预估: 1.5 天

### 1.1 数据模型

| ID | 任务 | 描述 | 产出物 | 依赖 | 状态 |
|:--|:----|:-----|:-----|:----|:---:|
| T-101 | 定义 `FormatType` + `IntermediateSkill` | 按 design.md §2.3 实现，含 `attachedFiles` 字段 | `src/core/types.ts` | T-005 | ✅ |
| T-102 | 定义 `InputSource` + `ResolvedInput` | 按 design.md §2.1 实现四种输入源 | `src/core/types.ts` | T-005 | ✅ |
| T-103 | 定义 `SkillDirectory` 结构 | 按 design.md §2.2，描述完整 skill 目录结构 | `src/core/types.ts` | T-005 | ✅ |
| T-104 | 定义平台特有扩展类型 | CursorSpecific, ClaudeSpecific, OpenClawSpecific, MCPSpecific | `src/core/types.ts` | T-101 | ✅ |
| T-105 | 定义 `ConversionReport` + `DirectoryConversionResult` | 转换报告和目录模式结果的数据结构 | `src/core/conversion-report.ts` | T-101 | ✅ |
| T-106 | 定义错误类型 | 所有 ErrorCode，含 `GIT_CLONE_FAILED`, `NO_SKILL_FOUND` 等 | `src/core/errors.ts` | T-101 | ✅ |

**验收结果：**
- ✅ 编译通过，类型无误
- ✅ `IntermediateSkill` 可携带 `attachedFiles`
- ✅ `ConversionReport` 支持 warnings/preserved/lost
- ✅ `IntermediateSkill` 可携带 `attachedFiles`
- ✅ `ConversionReport` 支持 warnings/preserved/lost

### 1.2 InputResolver 层

| ID | 任务 | 描述 | 产出物 | 依赖 | 状态 |
|:--|:----|:-----|:-----|:----|:---:|
| T-107 | 定义 `InputResolver` 接口 | `supports()` + `resolve()` 方法签名 | `src/resolver/resolver.interface.ts` | T-102 | ✅ |
| T-108 | 实现 `ResolverRegistry` | 按优先级遍历所有 resolver 的注册中心 | `src/resolver/resolver-registry.ts` | T-107 | ✅ |
| T-109 | 实现 `LocalResolver` | 处理本地文件/目录路径，使用 `path.resolve` | `src/resolver/local.resolver.ts` | T-107 | ✅ |
| T-110 | 实现 `GitHubResolver` | 解析 `gh:owner/repo` 和 GitHub URL，调用 `git clone --depth 1` | `src/resolver/github.resolver.ts` | T-107 | ✅ |
| T-111 | 实现工具函数 | URL 正则解析（gh: 格式、github.com URL）、临时目录管理 | `src/resolver/utils.ts` | T-110 | ✅ |

**GitHubResolver 核心逻辑：**

```
输入: gh:user/weather-skill/subdir
      │
      ├─ 解析出: owner=user, repo=weather-skill, ref=main, subpath=subdir
      │
      ├─ tempy.directory() 创建临时目录
      │
      ├─ execa('git', ['clone', '--depth', '1', url, tmpDir])
      │
      ├─ 如果 subpath 存在 → 定位到子目录
      │
      ├─ 返回 ResolvedInput { localPath, isRemote: true, cleanup }
      │
      └─ cleanup 方法执行: rm(tmpDir, { recursive: true })
```

**验收结果：**
- ✅ `LocalResolver.supports('./path')` → true
- ✅ `LocalResolver.supports('/abs/path')` → true
- ✅ `GitHubResolver.supports('gh:user/repo')` → true
- ✅ `GitHubResolver.supports('https://github.com/user/repo')` → true
- ✅ `resolveInput('gh:user/repo')` 返回含 cleanup 的 ResolvedInput
- ⏳ 单元测试（T-502）待 Phase 5 统一添加

---

## Phase 2 — Parser（含目录扫描）

> 对应需求: US-001, US-002, US-003, US-005 | 优先级: P0 | 预估: 2 天

### 2.1 Parser 基础设施

| ID | 任务 | 描述 | 产出物 | 依赖 | 状态 |
|:--|:----|:-----|:-----|:----|:---:|
| T-201 | 定义 `Parser` 接口 | 含 `parse()`、`parseDirectory()`、`detect()`、`format` 属性 | `src/parser/parser.interface.ts` | T-101 | ✅ |
| T-202 | 实现 `ParserRegistry` | 注册/获取 Parser 的全局注册中心 | `src/parser/parser-registry.ts` | T-201 | ✅ |
| T-203 | 实现 `SkillDirectoryScanner` | 扫描目录，识别 SKILL.md + 附属目录结构（集成在 SKILLMdParser 中） | `src/parser/skill-md.parser.ts` | T-103 | ✅ |

**SkillDirectoryScanner 核心逻辑：**
```
scan(dirPath):
  ├── 检查 dirPath/SKILL.md 存在
  ├── 检查 dirPath/scripts/ 存在 → 记录
  ├── 检查 dirPath/references/ 存在 → 记录
  ├── 检查 dirPath/assets/ 存在 → 记录
  └── 返回 SkillDirectory { name, skillFile, scriptsDir, ... }
    或 NO_SKILL_FOUND 错误
```

### 2.2 Parser 实现

| ID | 任务 | 实现类 | 核心逻辑 | 依赖 | 状态 |
|:--|:-----|:------|:--------|:----|:---:|
| T-204 | SKILL.md Parser | `SKILLMdParser` | gray-matter 解析 → name/description/正文，含 `parseDirectory()` | T-201 | ✅ |
| T-205 | .cursorrules Parser | `CursorRulesParser` | 全文为 instructions，name=文件名 | T-201 | ✅ |
| T-206 | .mdc Parser | `MdcParser` | gray-matter → globs/alwaysApply/desc | T-201 | ✅ |
| T-207 | MCP JSON Parser | `MCPJsonParser` | JSON Schema → tools[] + description（骨架待补） | T-201 | ⏳ |
| T-208 | SOUL.md Parser | `SOULMdParser` | 解析身份定义（骨架待补） | T-201 | ⬜ |

**验收结果：**
- ✅ 3 个 Parser 已完成（SKILL.md、.cursorrules、.mdc）
- ✅ `detect()` 正确识别对应格式
- ✅ `parseDirectory()` 正确扫描 skill 目录（集成在 SKILLMdParser）
- ✅ 非法输入抛出 `TransSkillError`
- ✅ 编译零错误

---

## Phase 3 — Mapper + Renderer

> 对应需求: US-001 ~ US-005, US-009 | 优先级: P0 | 预估: 2 天

### 3.1 Mapper

| ID | 任务 | 描述 | 产出物 | 依赖 |
|:--|:----|:-----|:-----|:----|
| T-301 | 定义 `Mapper` 接口 | `map()` + `supportedSources()` + `supportedTargets()` | `src/mapper/mapper.interface.ts` | T-101 |
| T-302 | 实现 `DefaultMapper` | 字段搬运/转换/丢失报告生成 | `src/mapper/default.mapper.ts` | T-301 |
| T-303 | Mapper 单元测试 | 覆盖所有 format 组合 | `test/mapper/default.mapper.test.ts` | T-302 |

**核心映射矩阵：**

| 输入 → 输出 | 测试重点 |
|:----------|:--------|
| SKILL.md → .cursorrules | disableModelInvocation 丢失警告 |
| SKILL.md → .mdc | description 映射到 frontmatter |
| .cursorrules → SKILL.md | name 从文件名推导 |
| MCP JSON → SKILL.md | tools 生成指令文本 |
| .mdc → .cursorrules | globs/alwaysApply 丢失警告 |

**验收标准：**
- ✅ 所有格式组合有测试覆盖
- ✅ 信息丢失时生成有效的 `ConversionReport`
- ✅ warnings 不为空时有清晰的解释

### 3.2 Renderer

| ID | 任务 | Renderer 类 | 核心逻辑 | 依赖 |
|:--|:-----|:-----------|:--------|:----|
| T-304 | 定义 `Renderer` 接口 | `render()` + `renderDirectory?()` + `format` + `extension` | T-101 |
| T-305 | 实现 `RendererRegistry` | 注册/获取 Renderer | T-304 |
| T-306 | SKILL.md Renderer | `SKILLMdRenderer` | gray-matter stringify | T-304 |
| T-307 | .cursorrules Renderer | `CursorRulesRenderer` | 纯文本 + 头部注释 + 目录模式逻辑 | T-304 |
| T-308 | .mdc Renderer | `MdcRenderer` | frontmatter + body | T-304 |
| T-309 | MCP JSON Renderer | `MCPJsonRenderer` | JSON stringify | T-304 |

**目录模式核心逻辑（`renderDirectory`）：**

```
// .cursorrules 的目录模式
T-307 renderDirectory:
  1. 创建输出目录（如果不存在）
  2. render(skill) 写入 {skillName}.cursorrules
  3. 如果原目录有 scripts/ → 复制到 输出目录/scripts/
  4. 如果原目录有 assets/  → 复制到 输出目录/assets/
  5. 如果原目录有 references/ → 复制到 输出目录/references/
  6. 返回 DirectoryConversionResult
```

**验收标准：**
- ✅ 每个 Renderer 的快照测试通过
- ✅ SKILL.md → .cursorrules 保留命令行示例
- ✅ 目录模式正确地复制附属文件

---

## Phase 4 — CLI 接口

> 对应需求: US-001 ~ US-006, US-008, US-010 | 优先级: P0 | 预估: 1.5 天

### 4.1 FormatDetector

| ID | 任务 | 描述 | 产出物 | 依赖 |
|:--|:----|:-----|:-----|:----|
| T-401 | 实现 `FormatDetector` | 按 design.md §7.3 逻辑检测格式，含目录模式检测 | `src/utils/format-detector.ts` | T-103, T-204~T-208 |
| T-402 | 实现文件工具函数 | `readInput()`, `writeOutput()`, `ensureDir()` | `src/utils/file-utils.ts` | 无 |
| T-403 | 实现 Logger | 使用 chalk，统一 success/warning/error 输出风格 | `src/utils/logger.ts` | T-007 |

### 4.2 命令实现

| ID | 任务 | 描述 | 核心流程 | 依赖 |
|:--|:----|:-----|:--------|:----|
| T-404 | 配置 commander | 注册 convert、list-formats、validate 三个命令 | `src/cli/cli.ts` | T-001 |
| T-405 | 实现 `convert` 命令 | **核心命令**，支持文件/目录/GitHub 三种输入 | `src/cli/commands/convert.ts` | T-108, T-202, T-302, T-305, T-401 |

**convert 命令核心流程：**

```
convert(input, options):
  1. resolveInput(input)       → ResolvedInput          ← InputResolver
  2. detectFormat(resolved)    → FormatType              ← FormatDetector
  3. 如果是目录模式:
       scanDirectory(path)     → SkillDirectory[]        ← SkillDirectoryScanner
       对每个 skill:
         parser.parse()        → IntermediateSkill       ← Parser
         mapper.map()          → IntermediateSkill       ← Mapper
         renderer.renderDirectory() → 输出到目标目录      ← Renderer
    如果是单文件模式:
       parser.parse()          → IntermediateSkill       ← Parser
       mapper.map()            → IntermediateSkill       ← Mapper
       renderer.render()       → string                  ← Renderer
       writeOutput()
  4. 如果 isRemote → cleanup()
  5. 输出转换报告
```

| ID | 任务 | 描述 | 产出物 | 依赖 |
|:--|:----|:-----|:-----|:----|
| T-406 | 实现 `list-formats` 命令 | 读取 registry 输出支持格式 | `src/cli/commands/list-formats.ts` | T-202, T-305 |
| T-407 | 实现 `validate` 命令 | 解析输入文件并报告结构问题 | `src/cli/commands/validate.ts` | T-401, T-202 |
| T-408 | 实现 `--dry-run` 模式 | 仅显示将会执行的操作，不实际写入 | `src/cli/commands/convert.ts` | T-405 |
| T-409 | 实现 `--install-to` 模式 | 转换后直接写入目标平台配置目录 | `src/cli/commands/convert.ts` | T-405 |

**验收标准：**
- ✅ `transskill convert sample.cursorrules --to skill.md` → 合法 SKILL.md
- ✅ `transskill convert sample-skill/ --to .cursorrules` → 完整目录输出
- ✅ `transskill convert gh:user/test-skill --to .cursorrules` → GitHub 模式成功
- ✅ `transskill convert gh:user/test-skill --to skill.md --install-to ~/.claude/skills/` → 直接安装
- ✅ `transskill list-formats` → 列出所有格式
- ✅ `transskill validate sample.skill.md` → 验证通过/报错
- ✅ `transskill convert xxx --dry-run` → 不写入任何文件
- ✅ 错误时红色输出，退出码非 0

---

## Phase 5 — 测试覆盖

> 对应需求: NFR-004 | 优先级: P1 | 预估: 1.5 天

| ID | 任务 | 描述 | 产出物 | 依赖 |
|:--|:----|:-----|:-----|:----|
| T-501 | 编写 fixtures | 所有格式的测试样本文件 + 完整 skill 目录 fixture | `test/fixtures/*` | 无 |
| T-502 | InputResolver 测试 | LocalResolver + GitHubResolver（mock git clone） | `test/resolver/*.test.ts` | T-108, T-109, T-110 |
| T-503 | Parser 异常测试 | 空文件、损坏格式、超大 frontmatter | parser 测试文件 | T-204~T-208 |
| T-504 | Renderer 快照补齐 | 所有 Renderer + 目录模式 renderDirectory | renderer 测试文件 | T-306~T-309 |
| T-505 | 端到端单文件集成测试 | 所有支持的转换路径完整过一遍 | `test/integration/full-conversion.test.ts` | T-405 |
| T-506 | 端到端目录转换测试 | skill 目录 → .cursorrules 目录 | `test/integration/directory-conversion.test.ts` | T-405 |
| T-507 | CLI 集成测试 | 模拟命令行调用，验证 stdout/stderr/exit code | `test/integration/cli.test.ts` | T-405 |
| T-508 | 边界测试 | Unicode 字符、特殊文件名、深层嵌套目录 | 各模块补充测试 | T-501 |

**验收标准：**
- ✅ 测试覆盖率 ≥ 80%（statement, branch, function, line）
- ✅ 所有转换路径至少有一个端到端测试
- ✅ GitHub 模式使用 mock，不依赖真实网络
- ✅ 目录模式 fixture 含 scripts/ + references/ + assets/

---

## Phase 6 — 工具链完善

> 优先级: P1 | 预估: 0.5 天

| ID | 任务 | 描述 | 产出物 | 依赖 |
|:--|:----|:-----|:-----|:----|
| T-601 | 配置 GitHub Actions CI | push 时运行 lint + test + build | `.github/workflows/ci.yml` | T-004, T-003 |
| T-602 | 配置 npm 发布流程 | `npm publish` 前的构建和版本检查 | `package.json` scripts | T-001 |
| T-603 | 编写 README.md | 项目介绍、安装方式、使用示例（含目录/GitHub 示例）、支持格式 | `README.md` | 所有 |
| T-604 | 编写 CONTRIBUTING.md | 贡献指南：如何新增 Parser/Renderer/Resolver | `CONTRIBUTING.md` | T-202, T-305, T-108 |
| T-605 | 添加 LICENSE | MIT | `LICENSE` | 无 |

**验收标准：**
- ✅ CI 全绿通过
- ✅ `npm publish --dry-run` 成功
- ✅ README.md 从零到上手 < 5 分钟
- ✅ CONTRIBUTING.md 明确给出新增格式的步骤

---

## 任务依赖总图

```
T-001 ───────────────────────────────────────────────────────────────────┐
  │                                                                       │
  ├─ Phase 0: T-002 ─ T-003 ─ T-004 ─ T-005 ─ T-006 ─ T-007             │
  │                                                                       │
  ├─ Phase 1:                                                              │
  │   T-101 ─ T-102 ─ T-103 ─ T-104 ─ T-105 ─ T-106                      │
  │     │                                                                 │
  │     └─ T-107 ─ T-108 ─┬─ T-109 ─ T-110 ─ T-111                       │
  │                       │                                               │
  ├─ Phase 2:             │                                               │
  │   T-201 ─ T-202 ─ T-203 ─┬─ T-204 ─ T-205 ─ T-206 ─ T-207 ─ T-208   │
  │                          │                                            │
  ├─ Phase 3:               │                                            │
  │   T-301 ─ T-302 ─ T-303 │  T-304 ─ T-305 ─┬─ T-306 ─ T-307 ─ T-308 ─│
  │                          │                 │                         │
  ├─ Phase 4:               │                 │                         │
  │   T-401 ─ T-402 ─ T-403 │                 │                         │
  │     │                   │                 │                         │
  │     └─ T-404 ─ T-405 ─ T-406 ─ T-407 ─ T-408 ─ T-409               │
  │                                                                       │
  ├─ Phase 5: T-501 ─┬─ T-502 ─ T-503 ─ T-504 ─ T-505 ─ T-506 ─ T-507 ──│
  │                                                                       │
  └─ Phase 6: T-601 ─ T-602 ─ T-603 ─ T-604 ─ T-605                     │
                                                                          │
  ▶ 全部完成 ────────────────────────────────────────────────────────────┘
```

---

## 项目演进日志

| 日期 | 完成内容 | 当前阶段 |
|:----|:--------|:--------|
| 2026-05-23 | 项目初始化、设计文档（specs/）完成 | Phase 0 ✅ |
| 2026-05-23 | Mapper + Renderer 管道 + `convert` 可实际运行 | Phase 3 ✅ |
| 2026-05-23 | GitHub 仓库 ljk-777/transskill 创建并推送 | Phase 0 ✅ |
| 2026-05-23 | 核心数据模型 + InputResolver（Local/GitHub）+ 3 个 Parser | Phase 1~2 ✅ |
| — | Mapper + Renderer 待实现 | Phase 3 ⬜ |
| — | CLI 集成管道待实现 | Phase 4 ⬜ |
| — | 单元测试 + 覆盖率待实现 | Phase 5 ⬜ |
| — | CI + npm 发布待实现 | Phase 6 ⬜ |

> 任务完成后，将 ⬜ 改为 ✅ 并填写完成日期。

---

## 📝 项目更新记录

### 2026-05-23 第一轮开发

**已完成：**
- 项目更名 `TransSkill` → `TransSkill`
- GitHub 仓库：https://github.com/ljk-777/transskill
- 完整三层 Spec 设计文档（requirements/design/tasks）
- Phase 0：TypeScript + Vitest + CLI 骨架
- Phase 1：InputResolver（Local + GitHub）+ 核心类型定义
- Phase 2：Parser（SKILL.md、.cursorrules、.mdc）+ 目录扫描
- 编译零错误

**当前代码行数：** 约 5,800 行（含 specs）

**下一步（Phase 3）：**
- 实现 DefaultMapper（字段映射 + 损失报告）
- 实现 Renderer（SKILL.md、.cursorrules、.mdc 输出）
- 串联完整的 convert 管道
