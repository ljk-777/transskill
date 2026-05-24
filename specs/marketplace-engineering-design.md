# Marketplace 工程化设计 v0.2

> 基于 `marketplace-vision.md` 的详细工程实现方案
> 在已有的 Security Audit + 转换引擎基础上，增加交互式搜索和安装能力

---

## 一、架构总览

```
用户 CLI
  │
  ├─ transskill search          → 交互式 TUI（@clack/prompts）
  ├─ transskill install <name>  → 下载 → 审计 → 转换 → 写入
  ├─ transskill publish <dir>   → 审计 → PR → registry
  └─ transskill info <name>     → 查看详情
       │
       ▼
Registry（GitHub: transskill/registry）
  ├─ registry.json              → 索引（拉取后本地搜索）
  └─ skills/<name>/
       └─ SKILL.md              → 统一存储格式
```

### 分层职责

| 层 | 职责 | 现有 |
|:---|:-----|:----|
| 📦 **Registry** | Skill 存储、版本管理、元数据索引 | ❌ 新建仓库 |
| 🔍 **Search Engine** | 本地索引搜索 + 拉取远程更新 | ❌ 新建 |
| 📥 **Install Flow** | 下载 → 审计 → 转换格式 → 写入 | ❌ 新建 |
| 📤 **Publish Flow** | 审计 → 创建 PR | ❌ 新建 |
| 🛡️ **Audit** | 安全检查（已有 L1-L3 + 目录扫描） | ✅ 已实现 |
| 🔄 **Convert** | 格式互转（6种格式） | ✅ 已实现 |

---

## 二、Registry 设计

### 仓库地址
`github.com/transskill/registry`（暂用 `ljk-777/transskill-registry` 做 MVP）

### 目录结构
```
registry/
├── registry.json               # 索引文件（所有人拉取）
├── INDEX.md                    # 人肉可读的目录
├── .github/
│   └── workflows/
│       └── publish-check.yml   # PR 自动审计
└── skills/
    ├── python-linter/
    │   ├── SKILL.md            # 标准格式
    │   └── icon.png            # 可选图标
    ├── react-ts-boilerplate/
    │   └── SKILL.md
    └── ...（每 skill 一个目录）
```

### registry.json 格式
```json
{
  "$schema": "v1",
  "updated": "2026-05-24T16:00:00Z",
  "skills": [
    {
      "name": "python-linter",
      "version": "1.2.0",
      "description": "Python code style guide with ruff and mypy config",
      "tags": ["python", "linter", "ruff", "mypy"],
      "author": "ljk-777",
      "stars": 45,
      "auditScore": 100,
      "created": "2026-05-20T00:00:00Z"
    }
  ]
}
```

### 搜索策略（无需后端）

1. `transskill search` 时拉取 `registry.json`
2. 缓存在本地 `~/.transskill/cache/registry.json`
3. 搜索在本地进行（切词 + 模糊匹配 + 标签过滤）
4. 缓存 24h 后自动刷新

这样**全站搜索是本地实时**的，不需要后端。

---

## 三、交互式 CLI (TUI) 设计

使用 `@clack/prompts` 实现类似 Claude Code `/plugin` 的交互体验。

### search 命令流程

```
$ transskill search

? Search skills: █
  ──────────────
  python-linter     v1.2  ⭐45  Python code style guide
  react-ts          v0.9  ⭐23  React TypeScript boilerplate
  auto-doc          v1.0  ⭐12  Auto-generate docstrings
  husky-setup       v0.5  ⭐8   Git hooks setup
  pr-template       v2.1  ⭐67  PR template with checklist
  ──────────────
  25 skills (type to filter)
```

交互状态：

| 操作 | 效果 |
|:----|:-----|
| 打字 "python" | 实时过滤，只显示匹配的 skill |
| 上下箭头 ↑↓ | 滚动选择 |
| 回车 Enter | 选中 → 进入 install 流程 |
| Ctrl+C | 退出 |

### install 流程（选中后自动触发）

```
✔ Selected python-linter v1.2

? Target format:
  > .mdc        (Cursor IDE)
    .cursorrules (Cursor IDE)
    skill.md     (Universal)
    claude.md    (Claude Code)
    mcp.json     (MCP Server)

✔ Installing python-linter v1.2...

  → Downloading from registry...  ✓
  → Auditing skill...  ✓ (score: 100)
  → Converting to .mdc...  ✓
  → Writing to ./python-linter.mdc...  ✓

✔ Installed python-linter v1.2 as .mdc
```

### 非交互模式（CI/脚本用）

```
transskill install python-linter --to .mdc --no-tui
```
跳过交互，用参数自动完成。

---

## 四、核心数据流

### 安装流程

```
用户输入 transskill install python-linter --to .mdc

1. 解析参数
   → name: python-linter, target: .mdc

2. 拉取/读取 registry 缓存
   → 本地已有 → 直接读取
   → 缓存过期/不存在 → 从 GitHub 拉取

3. 查找 skill 信息
   → registry.json 中查找 python-linter
   → 获取 version, path, author, auditScore

4. 下载 SKILL.md
   → 从 GitHub raw URL 下载
   → https://raw.githubusercontent.com/.../skills/python-linter/SKILL.md

5. 安全审计
   → 调用现有 AuditEngine
   → auditScore < 90 且未传 --force → 警告/拦截

6. 格式转换
   → 调用现有 mapper 和 renderer
   → SKILL.md → .mdc

7. 写入文件
   → 写入当前目录或 --dir 指定路径

8. 更新本地记录（可选）
   → 写入 ~/.transskill/installed.json
```

### 发布流程

```
用户输入 transskill publish ./my-skill/

1. 验证 skill 目录结构
   → 检查是否存在 SKILL.md
   → 检查 frontmatter (name, description)

2. 安全审计（强制）
   → auditScore < 90 → 拒绝发布
   → auditScore >= 90 → 允许

3. Fork + PR
   → 使用 GitHub CLI (gh) 或直接 API
   → fork transskill/registry
   → 创建分支 skills/<name>/
   → 复制 skill 目录
   → 更新 registry.json
   → 创建 PR

4. 输出 PR 链接
   → https://github.com/transskill/registry/pull/42
```

---

## 五、CLI 命令详细定义

### `search [query]`
```
Usage: transskill search [query] [options]

交互式搜索 skill

Options:
  --refresh    强制刷新 registry 缓存
  --tag <tag>  按标签预过滤
  --json       输出 JSON（非交互模式）

Examples:
  transskill search               # 打开交互式搜索
  transskill search python        # 预输入查询词
  transskill search --tag linter  # 按标签过滤
  transskill search --json        # JSON 输出
```

### `install <name>`
```
Usage: transskill install <name> [options]

安装并转换 skill

Options:
  --to <format>   目标格式（默认交互选择）
  --dir <path>    安装目录（默认当前目录）
  --force         跳过安全警告
  --no-tui        非交互模式
  --version <ver> 指定版本（默认 latest）

Examples:
  transskill install python-linter              # 交互安装
  transskill install python-linter --to .mdc    # 直接安装
  transskill install python-linter --no-tui     # 非交互
```

### `info <name>`
```
Usage: transskill info <name>

查看 skill 详情

Examples:
  transskill info python-linter
```

### `publish [path]`
```
Usage: transskill publish [path] [options]

发布 skill 到 registry（需要 GitHub 账号）

Options:
  --force    跳过安全检查
  --dry-run  只审计不发布

Examples:
  transskill publish ./my-skill/      # 发布
  transskill publish --dry-run        # 试运行
```

---

## 六、设计原则

1. **无后端依赖** — registry 是 GitHub 仓库，搜索在本地，CLI 全功能可离线使用
2. **复用已有能力** — `AuditEngine` 审计 + `mapper` 转换，不重复造轮子
3. **渐进式交互** — 交互模式适合人用，`--no-tui` 适合脚本和 CI
4. **安全优先** — publish 强制审计，install 根据评分拦截
5. **CLI 优先** — Web UI 是后续可选功能，初期不做

---

## 七、实现计划

| 步骤 | 内容 | 依赖 |
|:----|:-----|:-----|
| **1** | 安装 `@clack/prompts` 依赖 | 无 |
| **2** | `info` 命令（最简单，先打通 registry 读取） | registry 仓库 |
| **3** | 创建 `transskill/registry` 仓库 + 首批 10 个 skill | 步骤 2 |
| **4** | `search` 命令（交互式 TUI） | 步骤 1, 3 |
| **5** | `install` 命令（下载 → 审计 → 转换） | 步骤 2, 3, Audit, Convert |
| **6** | `publish` 命令（审计 → GitHub PR） | 步骤 5 |
| **7** | 文档 + 测试 | 全完成 |

---

## 八、开放问题

1. **认证**：`publish` 需要 GitHub token，怎么获取？通过 `gh auth` 复用还是传 `GITHUB_TOKEN`？
2. **registry 审核**：合并 PR 前 CI 自动跑审计？人工复核需要什么标准？
3. **版本管理**：`registry.json` 中的 version 怎么更新？semver 还是直接覆盖？
4. **缓存策略**：registry.json 本地缓存有效期多长？24h？按需刷新？
