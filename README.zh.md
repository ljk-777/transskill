# TransSkill

> **一次编写，全平台运行。**

TransSkill 是一个跨 AI Agent 平台的技能格式转换工具。
无需为每个 Agent 手动重写技能——一条命令搞定。

[![English Docs](https://img.shields.io/badge/docs-English-blue)](README.md)

---

## 问题

每种 AI 编码 Agent 都有自己的技能格式：
- Claude Code 用 SKILL.md
- Cursor 用 .cursorrules
- OpenClaw 用 AGENTS.md
- MCP Server 用 JSON Schema

为一个平台写的技能，在另一个平台上无法直接使用。

## 解决方案

```
$ transskill convert .cursorrules --to skill.md
$ transskill convert gh:user/weather-skill --to .cursorrules
$ transskill convert ./my-skill/ --to .mdc --glob "**/*.ts"
```

一条命令，全平台通用。

---

## 安装

```bash
npm install -g transskill
```

或者直接运行：

```bash
npx transskill convert .cursorrules --to skill.md
```

## 快速上手

```bash
# SKILL.md → .cursorrules
transskill convert my-skill.skill.md --to .cursorrules

# .cursorrules → SKILL.md
transskill convert .cursorrules --to skill.md

# .cursorrules → .mdc（带文件范围限定）
transskill convert .cursorrules --to .mdc --glob "src/**/*.ts"

# 完整 skill 目录 → Cursor 规则
transskill convert ./weather-skill/ --to .cursorrules

# GitHub 仓库 → 直接安装到 Claude Code
transskill convert gh:user/weather-skill --to skill.md \
  --install-to ~/.claude/skills/

# 预览效果（不实际写入文件）
transskill convert .cursorrules --to skill.md --dry-run
```

## 输入源

| 格式 | 示例 | 说明 |
|------|------|------|
| 本地文件 | `./rules.cursorrules` | 单文件转换 |
| 本地目录 | `./weather-skill/` | 完整 skill 目录（含脚本和资源） |
| GitHub 仓库 | `gh:user/repo` | 自动 clone + 转换 |
| GitHub 子路径 | `gh:user/repo/path` | 仓库内特定子目录 |
| GitHub URL | `https://github.com/user/repo` | 完整 URL 支持 |

## 支持格式

| 格式 | 平台 | 输入 | 输出 |
|------|------|:---:|:----:|
| SKILL.md | Claude Code, Codex CLI, OpenClaw, Cursor | ✅ | ✅ |
| .cursorrules | Cursor IDE | ✅ | ✅ |
| .mdc | Cursor 2.3+ | ✅ | ✅ |
| MCP JSON | 任何 MCP 兼容客户端 | ✅ | — |
| SOUL.md | OpenClaw | ✅ | — |

## 命令

```bash
# 转换技能格式
transskill convert <input> --to <format> [options]

# 列出所有支持的格式
transskill list-formats

# 验证技能文件或目录格式
transskill validate <input>

# 查看所有选项
transskill --help
```

### convert 选项

| 参数 | 说明 |
|------|------|
| `-t, --to <format>` | 目标格式（必填） |
| `-o, --output <path>` | 输出目录（默认当前目录） |
| `--install-to <path>` | 直接安装到 Agent 配置目录 |
| `--glob <pattern>` | 文件匹配模式（.mdc 输出时使用） |
| `--always-apply` | 总是加载该规则（.mdc 输出时使用） |
| `--dry-run` | 预览模式，不写入文件 |
| `-v, --verbose` | 显示详细转换报告 |

## 工作原理

```
输入 (文件/目录/GitHub)
    │
    ▼
InputResolver ──► Parser ──► Mapper ──► Renderer ──► 输出
(本地/GitHub)     (读取)     (映射)     (写入)
```

TransSkill 采用管道架构：

1. **InputResolver** — 将输入（本地路径或 GitHub URL）解析为本地文件路径
2. **Parser** — 读取平台特有格式，转换为通用中间表示
3. **Mapper** — 在平台间映射字段，报告保留和丢失的信息
4. **Renderer** — 以目标平台格式输出结果

## 示例

### 转换本地文件

```bash
$ cat .cursorrules
# My TypeScript Rules
Always use strict mode
Prefer named exports

$ transskill convert .cursorrules --to skill.md -o typescript-rule.md
✅ 转换完成
   输出: ./typescript-rule.md
```

### 从 GitHub 转换到 Cursor 规则

```bash
$ transskill convert gh:anthropics/skills/weather --to .cursorrules \
  --install-to .cursor/rules/

⬇️  正在克隆: gh:anthropics/skills
✅ 已安装: .cursor/rules/weather.cursorrules
```

### 目录转换（含映射损失报告）

```bash
$ transskill convert ./weather-skill/ --to .cursorrules
✅ 目录转换完成
   weather-skill/SKILL.md         → weather-skill.cursorrules
   weather-skill/scripts/         → ./scripts/（已复制）
   weather-skill/references/      → ./references/（已复制）
   ⚠️  SKILL.md 中的脚本引用在 .cursorrules 中无法使用
```

## 项目进度

**活跃开发中。** 详见 [tasks.md](specs/tasks.md)。

| 阶段 | 状态 |
|------|------|
| Phase 0: 项目脚手架 | ✅ 已完成 |
| Phase 1: InputResolver + 类型定义 | ✅ 已完成 |
| Phase 2: Parser 层 | ✅ 已完成 |
| Phase 3: Mapper + Renderer | ⬜ 待完成 |
| Phase 4: CLI 完整管道 | ⬜ 待完成 |
| Phase 5: 测试覆盖 | ⬜ 待完成 |
| Phase 6: CI + 发布 | ⬜ 待完成 |

## 贡献指南

详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

MIT
