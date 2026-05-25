# TransSkill

> **Write once, run on any agent. Search, audit, and install from 1,000+ skills.**

[![npm](https://img.shields.io/npm/v/transskill)](https://www.npmjs.com/package/transskill)
[![中文文档](https://img.shields.io/badge/文档-中文-blue)](README.zh.md)

---

## ✨ What Makes TransSkill Different

### 🗂️ Universal Skill Search — 1,115+ Skills, One Command

Stop hunting across GitHub repos. TransSkill indexes **1,115+ real-world agent skills** from the [awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) ecosystem — curated skills from **Anthropic, Stripe, Google Gemini, Vercel, Cloudflare, Angular, Supabase, and more**.

```bash
# Interactive search — type to filter, enter to install
npx transskill search

# Fast CLI search
npx transskill search docx --json
npx transskill search python --tag linter
```

Every skill is fetched directly from its **original source** — no copies, no stale mirrors.

### 🛡️ Built-in Security Audit

Before you install any skill, TransSkill automatically scans it for security risks:

| Level | What It Catches |
|-------|----------------|
| **L1 — Instructions** | `rm -rf`, `curl\|sh`, base64 obfuscation, prompt injection |
| **L2 — Permissions** | Overly broad globs, dangerous MCP tool names |
| **L3 — MCP** | Suspicious server commands (`sudo`, `kill`, `rm`) |

```bash
# Audit any skill file
npx transskill audit ./skill.skill.md

# Install with automatic audit (blocks if score < 90)
npx transskill install python-linter
```

### 🔄 Cross-Platform Conversion

Convert between every major agent skill format — **without manual rewriting**.

```bash
npx transskill convert .cursorrules --to skill.md
npx transskill convert gh:user/weather-skill --to .mdc
npx transskill convert ./my-skill/ --to .cursorrules --glob "src/**/*.ts"
```

| Format | Platforms | In | Out |
|--------|-----------|:--:|:---:|
| SKILL.md | Claude Code, Codex CLI, OpenClaw, Cursor | ✅ | ✅ |
| .cursorrules | Cursor IDE | ✅ | ✅ |
| .mdc | Cursor 2.3+ | ✅ | ✅ |
| MCP JSON | Any MCP client | ✅ | — |
| SOUL.md | OpenClaw | ✅ | — |

---

## Install

```bash
npm install -g transskill
# or run directly:
npx transskill --help
```

## Commands

### 🔍 Search & Install (Marketplace)

```bash
# Interactive search — browse 1,115+ skills
npx transskill search

# JSON output (scripts/CI)
npx transskill search react --json

# Install directly from registry → download → audit → convert → write
npx transskill install docx
npx transskill install python-linter --to .mdc
npx transskill install claude-api --to skill.md --dir ~/.claude/skills/
```

### 🔄 Convert

```bash
# Single file
npx transskill convert .cursorrules --to skill.md

# GitHub repo
npx transskill convert gh:anthropics/skills/docx --to .cursorrules

# Skill directory with assets
npx transskill convert ./skill-dir/ --to .cursorrules

# Preview what would be lost
npx transskill diff .cursorrules --to skill.md
```

### 🛡️ Audit

```bash
npx transskill audit ./skill.skill.md
npx transskill audit ./skill-dir/ --format json --quiet
```

### 📤 Publish

```bash
# Submit a skill link to the registry (PR)
npx transskill publish ./my-skill/

# Batch publish skills from a directory
npx transskill publish-all ./skills/ --dry-run
```

---

## How It Works

```
Input (file/dir/GitHub/Registry)
    │
    ▼
InputResolver ──► Parser ──► Mapper ──► Renderer ──► Output
(Local/GitHub)    (read)      (map)      (write)

Registry ──► Search ──► Install ──► Audit ──► Convert ──► Write
(1,115+)      (TUI/JSON)  (auto)
```

TransSkill's pipeline:
1. **InputResolver** — resolves local/GitHub/registry sources
2. **Parser** — reads 6 formats into a universal intermediate representation
3. **Mapper** — cross-platform field mapping with loss reporting
4. **Renderer** — writes in the target format
5. **AuditEngine** — security scanning at every level
6. **Marketplace** — search, install, and publish via the registry

---

## Security Audit Scoring

| Score | Grade | Meaning |
|-------|-------|---------|
| 90–100 | **A** | Excellent |
| 70–89 | **B** | Good — minor issues |
| 50–69 | **C** | Fair — review recommended |
| 30–49 | **D** | Poor — significant issues |
| 0–29 | **F** | Critical — do not use |

---

## Project Status

**v0.4.0** — Active development.

| Feature | Status |
|---------|--------|
| ✅ Format conversion (6 formats) | Complete |
| ✅ Security audit (L1–L3) | Complete |
| ✅ Marketplace search (1,115+ skills) | Complete |
| ✅ Install (download → audit → convert) | Complete |
| ✅ Publish (link submission) | Complete |
| ⬜ Tests | In progress |

---

## License

MIT
