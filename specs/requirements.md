# TransSkill — 需求文档

> 版本: v0.2 | 最后更新: 2026-05-23 | 状态: Draft

---

## 1. 产品概述

### 1.1 一句话描述
TransSkill 是一个跨 AI Agent 平台的技能格式转换与分发工具——技能写一次，在任何 Agent 上都能跑。

### 1.2 目标用户
| 用户 | 场景 | 痛点 |
|:----|:----|:----|
| AI Agent 开发者 | 写了一份 SKILL.md，想同时在 Cursor 和 Claude Code 上用 | 要手动重写成 .cursorrules |
| 团队技术负责人 | 团队一半用 Cursor、一半用 Claude Code | 同一份规则要维护两份 |
| Agent 技能消费者 | 从 GitHub 找到一个好用的 skill 仓库 | 不懂怎么转成自己用的格式 |
| MCP 服务器作者 | 写了 MCP Server，想一键生成各平台的 skill 配置 | 每个平台的配置格式不同 |
| **Skill 市场用户** | 在 Skills.sh / Rule of Claw 上发现了想要的 skill | 没有统一的"下载即转换"体验 |

### 1.3 核心价值主张
> **一份技能定义 → 一键转换 → 全平台运行**

---

## 2. 输入源类型

### 2.1 支持的输入方式

| 标识 | 格式 | 示例 | 说明 |
|:----|:----|:----|:----|
| **本地文件** | 文件路径 | `./weather-skill/SKILL.md` | 单文件转换 |
| **本地目录** | 目录路径 | `./weather-skill/` | **完整 skill 目录转换**，自动识别目录中的 SKILL.md + 附属文件 |
| **GitHub 缩写** | `gh:owner/repo` | `gh:user/weather-skill` | 自动 clone 后转换 |
| **GitHub 完整 URL** | `https://github.com/...` | `https://github.com/user/weather-skill` | 同上，兼容完整链接 |
| **GitHub 子路径** | `gh:owner/repo/path` | `gh:user/skills/weather` | 仅转换仓库中的特定子目录 |

---

## 3. 用户故事

### 3.1 Phase 1 — 格式转换引擎（MVP）

| ID | 角色 | 用户故事 | 验收标准 |
|:---|:----|:--------|:--------|
| US-001 | 开发者 | 我希望把一个 `.cursorrules` 文件转换成 `SKILL.md`，这样我就能在 Claude Code 上使用它 | 1. 输入 `.cursorrules` 文件路径，输出合法的 `SKILL.md` 文件<br>2. `name` 自动从文件名推导<br>3. `description` 自动从内容首段提取<br>4. 原始指令完整保留在 SKILL.md 正文 |
| US-002 | 开发者 | 我希望把一个 `SKILL.md` 文件转换成 `.cursorrules`，这样我就能在 Cursor 上用 | 1. 输入 `SKILL.md` 路径，输出 `.cursorrules`<br>2. YAML frontmatter 的 `name` 和 `description` 保留为注释<br>3. 正文指令完整保留 |
| US-003 | 开发者 | 我希望把一个 `SKILL.md` 转换成 `.mdc`（Cursor 新版规则格式），以支持 glob 文件范围限定 | 1. 输出合法的 `.mdc` 文件<br>2. `description` 映射到 frontmatter<br>3. 支持通过 `--glob` 参数指定文件范围<br>4. 支持 `--always-apply` 旗帜控制加载策略 |
| US-004 | 开发者 | 我希望通过命令行 `transskill convert --help` 查看所有转换选项 | 1. 显示所有支持的输入/输出格式<br>2. 显示示例用法<br>3. 显示可选参数说明 |

### 3.2 Phase 2 — 完整 Skill 目录转换 + 远程源

| ID | 角色 | 用户故事 | 验收标准 |
|:---|:----|:--------|:--------|
| US-005 | 开发者 | 我希望把一个完整的 skill **目录**（含 SKILL.md + scripts + assets）转到另一个平台 | 1. 输入 skill 目录 → 输出目标平台的目录结构<br>2. 附属文件（scripts/、assets/、references/）直接复制<br>3. 保留原目录的层级关系 |
| US-006 | 开发者 | 我希望直接从 GitHub 仓库转换 skill，而不需要先手动 clone | 1. `transskill convert gh:user/repo --to .cursorrules`<br>2. 工具自动 clone 到临时目录<br>3. 自动检测仓库中的技能文件<br>4. 转换完毕后清理临时文件<br>5. 对公共仓库零配置 |
| US-007 | MCP 作者 | 我写了一个 MCP Server，希望一键生成各平台的 skill 配置文件 | 1. 输入 MCP JSON Schema，输出 `SKILL.md`<br>2. 输出内容包含工具名称、描述、参数说明<br>3. 支持 `tools[]` 数组的批量处理 |
| US-008 | 开发者 | 我希望转换后的文件能直接安装到目标平台的配置目录 | 1. `--install-to` 参数指定目标目录<br>2. 转换后文件直接写入目标路径<br>3. 列出已安装的文件清单 |

### 3.3 Phase 3 — 平台特有功能

| ID | 角色 | 用户故事 | 验收标准 |
|:---|:----|:--------|:--------|
| US-009 | OpenClaw 用户 | 我希望把一份 SOUL.md + AGENTS.md 转成 Cursor 的 workspace 配置 | 1. 合并两份文件为 `.cursorrules`<br>2. `SOUL.md` 的身份描述放在文件头部<br>3. `AGENTS.md` 的操作规则放在后面 |
| US-010 | 开发者 | 我希望批量转换一个目录下的多个技能 | 1. `transskill convert ./skills/ --to .cursorrules`<br>2. 自动递归处理所有技能子目录<br>3. 输出到指定目录，保持原文件名/目录名 |

---

## 4. 用法示例（完整体验）

### 4.1 本地 skill 目录 → Cursor 规则

```bash
# 完整 skill 目录转换
$ transskill convert ./weather-skill/ --to .cursorrules

✅ 转换完成
   weather-skill/SKILL.md        → weather-skill.cursorrules
   weather-skill/scripts/get_weather.py  → （已复制）
   weather-skill/assets/          → （已复制）
   ⚠️  附属文件已复制到输出目录同侧
```

### 4.2 GitHub 仓库 → 直接安装到 Claude Code

```bash
# 一条命令搞定
$ transskill convert gh:anthropics/skills/weather --to skill.md \
  --install-to ~/.claude/skills/

⬇️  正在克隆: gh:anthropics/skills
🔍  检测到: weather 技能
✅  转换完成，已安装到 ~/.claude/skills/weather/
```

### 4.3 GitHub 仓库 → .mdc（Cursor 2.3+）

```bash
$ transskill convert gh:user/ts-rules --to .mdc \
  --glob "**/*.ts" \
  --install-to .cursor/rules/

⬇️  正在克隆: gh:user/ts-rules
✅  转换完成，已安装
   已安装: .cursor/rules/ts-rules.mdc
```

### 4.4 MCP Server 配置 → 各平台 skill

```bash
$ transskill convert ./mcp-server.json --to skill.md -o ./skills/

✅  转换完成
   从 MCP JSON 生成 3 个技能:
   mcp-server/skill.md
   mcp-server-tool-search/skill.md
   mcp-server-tool-read/skill.md
```

---

## 5. 非功能性需求

| ID | 需求 | 指标 | 优先级 |
|:---|:----|:----|:-----|
| NFR-001 | 转换速度 | 本地单个文件 ≤ 100ms，GitHub 模式 ≤ 5s（不含 clone 时间） | P0 |
| NFR-002 | 兼容性 | 支持 Node.js ≥ 18 | P0 |
| NFR-003 | 安全性 | 转换过程中不执行用户文件中的任何代码 | P0 |
| NFR-004 | 可测试性 | 每种转换路径都有单元测试覆盖 | P1 |
| NFR-005 | 健壮性 | 遇到不合法输入时输出明确定义的错误信息 | P1 |
| NFR-006 | 编码一致性 | 所有输出文件使用 UTF-8 编码 | P0 |
| NFR-007 | GitHub 兼容 | 支持公开仓库，无需认证 | P1 |
| NFR-008 | 清理保证 | GitHub 模式无论成功失败都清理临时文件 | P0 |

---

## 6. 边界与排除项

### 6.1 本阶段不做
- ❌ 技能市场/注册中心（后续 Phase）
- ❌ 图形化 Web UI（后续 Phase）
- ❌ 技能依赖管理和版本解析
- ❌ 私有 GitHub 仓库认证（后续 Phase）
- ❌ AI 自动生成技能（仅做格式转换，不写技能逻辑）

### 6.2 支持的格式矩阵（Phase 1）

| 输入 \ 输出 | SKILL.md | .cursorrules | .mdc | MCP JSON |
|:----------:|:--------:|:-----------:|:----:|:--------:|
| **单文件** | | | | |
| SKILL.md | — | ✅ | ✅ | — |
| .cursorrules | ✅ | — | ✅ | — |
| .mdc | ✅ | ✅ | — | — |
| MCP JSON | ✅ | — | — | — |
| **完整目录** | | | | |
| skill 目录（含 SKILL.md + 附属文件） | — | ✅ 重建目录结构 | ✅ 重建目录结构 | — |
| **远程源** | | | | |
| GitHub 仓库/子路径 | 自动检测后走对应转换路径 | | | |

---

## 7. 术语表

| 术语 | 定义 |
|:----|:----|
| SKILL.md | YAML frontmatter + Markdown 指令的开源 Agent 技能标准，被 Claude Code、OpenClaw、Codex CLI 等 20+ Agent 采用 |
| .cursorrules | Cursor IDE 的项目级规则文件，纯文本格式，全局生效 |
| .mdc | Cursor 2.3+ 新版规则格式，支持 YAML frontmatter 和 glob 文件范围 |
| MCP JSON | Model Context Protocol 的 Server 描述文件，JSON Schema 格式 |
| Frontmatter | YAML 格式的元数据块，位于 Markdown 文件开头，被 `---` 包裹 |
| **Skill 目录** | 一个标准 skill 的完整目录结构：SKILL.md + scripts/ + references/ + assets/ |
| **InputResolver** | 负责处理输入源的模块，将本地路径/GitHub URL/市场ID统一为本地文件系统路径 |
| **整 Skill 转换** | 不单转一个文件，而是转换整个 skill 目录结构，包含附属文件 |
| Parser | 负责读取各平台格式并解析为中间表示的模块 |
| Mapper | 负责在平台格式之间做语义概念映射的模块 |
| Renderer | 负责将中间表示输出为目标平台格式的模块 |
