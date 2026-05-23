# TransSkill 生态规划 v0.1

> Market + Security + Management — 让 AI agent skill 像 npm 包一样可发现、可信任、可管理

---

## 一、产品定位

**npm for AI agent skills**

| 类比 npm | TransSkill |
|:---------|:-----------|
| `npm install` | `transskill install` |
| `npm search` | `transskill search` |
| `npm audit` | `transskill audit` |
| `npm publish` | `transskill publish` |
| `npm outdated` | `transskill manage list --outdated` |
| npmjs.com | transskill registry（Web + CLI）|

---

## 二、三层架构

### 📦 第一层：Registry（仓库层）

Skill 的存储方式有两种选择：

**方案 A：npm 原生包（推荐）**
- 每个 skill 是一个 npm 包 `@transskill/weather`
- 天然支持版本、依赖、安装
- 缺点：npm 对 skill 格式无感知

**方案 B：独立 GitHub 组织**
- `github.com/transskill/skills` 一个 repo 收所有 skill
- 用目录结构区分
- 缺点：版本管理靠 git tag，不够灵活

**推荐方案 A**，但初始 MVP 可以先走方案 B 快速启动。

**内容分层：**
```
registry/
├── official/          # 官方维护（openclaw / cursor / claude-code 官方 skill）
├── community/         # 社区贡献（审核后入库）
└── private/           # 用户私有（本地或内部 Git）
```

### ⚙️ 第二层：Engine（CLI 引擎层）

```
transskill
├── search <query>           # 搜索 skill
├── install <name>           # 安装到当前项目
│   ├── --save               # 写入 transskill.json
│   └── --format <fmt>       # 安装时直接转格式
├── uninstall <name>         # 卸载
├── update [name]            # 更新（全部或指定）
├── list                     # 列出已安装的 skill
├── audit <name|path>        # 安全检查
├── publish [path]           # 发布到社区
├── init                     # 初始化 transskill.json
├── convert                  # ✅ 已有
├── validate                 # ✅ 已有
└── list-formats             # ✅ 已有
```

### 💻 第三层：Project（本地项目）

安装后的 skill 存在项目目录中，通过 `transskill.json` 管理：

```json
{
  "skills": {
    "weather": {
      "source": "registry",
      "version": "^1.0.0",
      "format": "skill.md",
      "path": "./skills/weather/"
    },
    "code-reviewer": {
      "source": "local",
      "version": "0.2.0",
      "format": ".cursorrules",
      "path": "./skills/code-reviewer/"
    }
  }
}
```

---

## 三、🛡️ Security Audit 安全审查

这是和 marketplace **捆绑的核心功能**——无审查，无信任。

### 审计层级

| 层级 | 检查项 | 示例危险信号 |
|:----|:-------|:-----------|
| **L1 指令分析** | skill 指令文本中是否包含危险操作 | "download and run this script" |
| **L2 Shell 扫描** | 是否包含 shell 命令、exec 调用 | `curl`, `eval`, `base64 -d` |
| **L3 权限审计** | 推断 skill 需要的权限 | 文件写、网络访问、环境变量读 |
| **L4 代码审查** | scripts/ 目录中的脚本分析 | obfuscation, minified payload |
| **L5 MCP 专项** | MCP server 配置安全 | 可疑 command/args, 未知源 |
| **L6 依赖链** | skill 引用了哪些外部资源 | URL, CDN, Docker 镜像 |

### 安全评分

```
Score 0-49  ❌ Dangerous    自动拦截，安装需 --force
Score 50-89 ⚠️  Suspicious   提示风险，让用户确认
Score 90-100 ✅ Safe         正常安装
```

### CLI 审计

```bash
# 安装前自动审查
transskill install weather
# 🔍 Auditing weather@1.0.0...
# ✅ Score: 94/100 — safe to install
# ✔ Installed weather@1.0.0

# 显式审计
transskill audit weather
transskill audit ./my-skill/ --verbose
transskill audit https://github.com/xxx/skill --format json

# 审计已安装的所有 skill
transskill audit --all
```

---

## 四、产品路线图

| Phase | 内容 | 时间预估 |
|:-----|:------|:--------|
| **Phase A** | Registry MVP：GitHub 组织仓库 + `search / install / list` | 2 周 |
| **Phase B** | Security Audit L1-L3：指令 + shell + 权限分析 | 1 周 |
| **Phase C** | `transskill.json` 项目管理与版本管理 | 1 周 |
| **Phase D** | `publish` 流程 + 社区贡献规范 | 1 周 |
| **Phase E** | MCP 专项审计 + Web 浏览界面 | 2 周 |
| **Phase F** | 自动更新 + 依赖解析 + CI 集成 | 1 周 |

---

## 五、待讨论的问题

1. **存储方案**：npm 包 vs GitHub 组织 repo vs 自建 registry？
2. **审核机制**：社区技能需要人工审核吗，还是自动化评分后直接上架？
3. **种子数据**：初始内置哪些 skill？从各大平台抓取还是手动整理？
4. **商业化**：私有 registry 收费 / 企业版安全审计？
5. **MCP Server 专项**：是否需要沙箱运行 MCP server 做动态检测？
