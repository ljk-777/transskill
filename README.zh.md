# TransSkill

> **一次编写，全平台运行。搜索、审计、安装 1,000+ 个技能。**

[![npm](https://img.shields.io/npm/v/transskill)](https://www.npmjs.com/package/transskill)
[![English Docs](https://img.shields.io/badge/docs-English-blue)](README.md)

---

## ✨ TransSkill 的三大亮点

### 🗂️ 全站搜索 — 一键检索 1,115+ 个技能

不用再到处翻 GitHub 仓库了。TransSkill 自动集成 [awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) 生态，索引了 **1,115+ 个真实可用的 Agent 技能**，来自 **Anthropic、Stripe、Google Gemini、Vercel、Cloudflare、Angular、Supabase** 等官方团队。

```bash
# 交互式搜索 — 打字过滤，回车安装
npx transskill search

# 命令行搜索
npx transskill search docx --json
npx transskill search python --tag linter
```

每个技能直接从**原始仓库**获取 — 不存副本，不会过时。

### 🛡️ 安全审计 — 安装前自动扫描

安装任何技能之前，TransSkill 自动进行三层安全检查：

| 级别 | 检测内容 |
|-------|----------|
| **L1 — 指令扫描** | `rm -rf`、`curl\|sh`、base64 混淆、提示注入 |
| **L2 — 权限扫描** | glob 范围过宽、危险 MCP 工具名 |
| **L3 — MCP 扫描** | 可疑服务器命令（`sudo`、`kill`、`rm`） |

```bash
# 审计任意技能文件
npx transskill audit ./skill.skill.md

# 安装时自动审计（评分 < 90 会拦截）
npx transskill install python-linter
```

### 🔄 格式转换 — 跨平台互通

在所有主流 Agent 格式间自由转换，**无需手动重写**。

```bash
npx transskill convert .cursorrules --to skill.md
npx transskill convert gh:user/weather-skill --to .mdc
npx transskill convert ./my-skill/ --to .cursorrules --glob "src/**/*.ts"
```

| 格式 | 平台 | 输入 | 输出 |
|--------|-----------|:----:|:----:|
| SKILL.md | Claude Code, Codex CLI, OpenClaw, Cursor | ✅ | ✅ |
| .cursorrules | Cursor IDE | ✅ | ✅ |
| .mdc | Cursor 2.3+ | ✅ | ✅ |
| MCP JSON | 任意 MCP 客户端 | ✅ | — |
| SOUL.md | OpenClaw | ✅ | — |

---

## 安装

```bash
npm install -g transskill
# 或直接运行：
npx transskill --help
```

## 命令

### 🔍 搜索与安装（市场）

```bash
# 交互式搜索 — 浏览 1,115+ 个技能
npx transskill search

# JSON 输出（脚本/CI 用）
npx transskill search react --json

# 直接从市场安装 → 下载 → 审计 → 转换 → 写入
npx transskill install docx
npx transskill install python-linter --to .mdc
npx transskill install claude-api --to skill.md --dir ~/.claude/skills/
```

### 🔄 转换

```bash
# 单文件
npx transskill convert .cursorrules --to skill.md

# GitHub 仓库
npx transskill convert gh:anthropics/skills/docx --to .cursorrules

# 技能目录（含附属文件）
npx transskill convert ./skill-dir/ --to .cursorrules

# 预览转换损失
npx transskill diff .cursorrules --to skill.md
```

### 🛡️ 审计

```bash
npx transskill audit ./skill.skill.md
npx transskill audit ./skill-dir/ --format json --quiet
```

### 📤 发布

```bash
# 提交技能链接到市场（自动 PR）
npx transskill publish ./my-skill/

# 批量发布目录下的所有技能
npx transskill publish-all ./skills/ --dry-run
```

---

## 工作原理

```
输入 (文件/目录/GitHub/市场)
    │
    ▼
InputResolver ──► Parser ──► Mapper ──► Renderer ──► 输出
(本地/GitHub)    (读取)      (映射)      (写入)

市场 ──► 搜索 ──► 安装 ──► 审计 ──► 转换 ──► 写入
(1,115+)  (TUI/JSON)  (自动)
```

TransSkill 的管道架构：

1. **InputResolver** — 解析本地/GitHub/市场来源
2. **Parser** — 读取 6 种格式为通用中间表示
3. **Mapper** — 跨平台字段映射，报告保留和丢失的信息
4. **Renderer** — 以目标格式输出
5. **AuditEngine** — 全层级安全扫描
6. **Marketplace** — 搜索、安装、发布

---

## 安全审计评分

| 分数 | 等级 | 含义 |
|-------|-------|---------|
| 90–100 | **A** | 优秀 |
| 70–89 | **B** | 良好 — 少量低风险问题 |
| 50–69 | **C** | 一般 — 建议审查 |
| 30–49 | **D** | 较差 — 显著风险 |
| 0–29 | **F** | 危险 — 请勿使用 |

---

## 项目状态

**v0.4.0** — 活跃开发中。

| 功能 | 状态 |
|---------|--------|
| ✅ 格式转换（6 种格式） | 已完成 |
| ✅ 安全审计（L1–L3） | 已完成 |
| ✅ 市场搜索（1,115+ 个技能） | 已完成 |
| ✅ 安装（下载 → 审计 → 转换） | 已完成 |
| ✅ 发布（链接提交） | 已完成 |
| ⬜ 测试覆盖 | 进行中 |

---

## 许可证

MIT
