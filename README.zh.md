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

# 安全审计技能文件或目录
transskill audit <input> [options]

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

### audit 选项

| 参数 | 说明 |
|------|------|
| `--format <type>` | 输出格式：`console` 或 `json`（默认 console） |
| `--quiet` | 仅显示评分摘要 |
| `--min-severity <level>` | 最低报告级别：`info`, `low`, `medium`, `high`, `critical`（默认 info） |
| `--auditor <id>` | 仅运行指定的审计器（可重复使用） |
| `-v, --verbose` | 显示详细发现 |

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

---

## 安全审计

TransSkill 内置安全扫描器，可以在安装或使用技能文件之前分析其中的潜在安全风险。

```bash
# 快速扫描技能文件
transskill audit my-skill.skill.md

# JSON 格式输出，适合程序化处理
transskill audit ./skill-dir/ --format json

# 安静模式——仅显示评分
transskill audit my-skill.skill.md --quiet

# 仅显示高危及以上问题
transskill audit .cursorrules --min-severity high

# 仅运行指定审计器
transskill audit mcp.json --auditor permission-scanner
```

### 审计级别

扫描器检查三个安全层级：

| 级别 | 扫描器 | 检查内容 |
|------|--------|----------|
| **L1 — 指令扫描** | `instruction-scanner` | 危险 shell 命令（`rm -rf`、`sudo`、`curl|sh`）、提示注入模式、base64/hex 混淆、可疑 URL、远程代码执行 |
| **L2 — 权限扫描** | `permission-scanner` | `.mdc` glob 范围过宽、`alwaysApply` 无范围限制、危险 MCP 工具名（shell/exec）、文件系统访问、网络访问、Claude `disableModelInvocation` 设置 |
| **L3 — MCP 扫描** | `permission-scanner` | MCP 服务器命令（`rm`、`sudo`、`kill`）、可能被滥用的 MCP 工具能力 |

> 注：L3 检查由同一個 PermissionScanner 处理，与 L2 在一次扫描中一并报告。

### 评分体系

审计引擎计算 0–100 的数值评分，对应 A–F 等级：

| 等级 | 分数范围 | 含义 |
|------|----------|------|
| **A** | 90–100 | 优秀——几乎没有安全问题 |
| **B** | 70–89 | 良好——存在少量低风险问题 |
| **C** | 50–69 | 一般——存在中等风险，建议审查 |
| **D** | 30–49 | 较差——存在显著风险，谨慎使用 |
| **F** | 0–29 | 危险——存在严重风险，请勿直接使用 |

每条发现按严重程度扣分：

| 严重程度 | 扣分 |
|----------|------|
| 🔴 严重（Critical） | −25 分 |
| 🟠 高危（High） | −10 分 |
| 🟡 中危（Medium） | −4 分 |
| 🟢 低危（Low） | −1 分 |
| ℹ️ 信息（Info） | 0 分 |

### 输出格式

**控制台**（默认）：带颜色标签、行号和上下文片段的可读报告。

```
$ transskill audit my-skill.skill.md

╔══════════════════════════════════════════════╗
║  TransSkill Security Audit                  ║
║  目标文件: my-skill.skill.md                 ║
╚══════════════════════════════════════════════╝

审计等级: L1 + L2 + L3

发现 (3 项):

🔴 严重      | L2-003b   | MCP 服务器使用了危险命令: rm
              → ./my-skill.skill.md

🟠 高危      | L1-001    | 检测到危险命令: rm -rf /
              → ./my-skill.skill.md:24
              →     run: rm -rf /tmp/cache

🟡 中危      | L2-001b   | alwaysApply 规则 globs 范围过宽
              → ./my-skill.skill.md

评分: 65/100 — C 级
3 项发现 (1 严重, 1 高危, 1 中危)
```

**JSON**：适合 CI/CD 流水线和程序化处理。

```bash
transskill audit ./skills/ --format json
```

**安静模式**：一行摘要，适合快速检查。

```bash
transskill audit .cursorrules --quiet
# 📊 C (65/100) — 3 项发现 (1🔴 1🟠 1🟡)
```

### CI/CD 集成

结合 JSON 输出将审计结果集成到 CI 流水线：

```bash
#!/bin/bash
# 评分低于 B 级（70 分）则构建失败
RESULT=$(transskill audit ./skills/ --format json)
SCORE=$(echo $RESULT | jq '.score.total')
if [ "$SCORE" -lt 70 ]; then
  echo "❌ 安全评分 $SCORE 低于阈值 (70)"
  exit 1
fi
echo "✅ 安全评分 $SCORE — 通过"
```

## 项目进度

**v0.2.1 — 活跃开发中。** 详见 [tasks.md](specs/tasks.md)。

| 阶段 | 状态 |
|------|------|
| Phase 0: 项目脚手架 | ✅ 已完成 |
| Phase 1: InputResolver + 类型定义 | ✅ 已完成 |
| Phase 2: Parser 层 | ✅ 已完成 |
| Phase 3: Mapper + Renderer | ✅ 已完成 |
| Phase 4: CLI 完整管道 | ✅ 已完成 |
| Phase 5: 测试覆盖 | ⬜ 进行中 |
| Phase 6: CI + 发布 | ⬜ 待完成 |
| Phase A: 安全审计 | ✅ 已完成 |

## 贡献指南

详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

MIT
