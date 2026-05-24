# TransSkill

> **Write once, run on any agent.**

TransSkill is a CLI tool that converts AI agent skill files between different platforms.
Stop manually rewriting skills for every agent — convert with one command.

[![中文文档](https://img.shields.io/badge/文档-中文-blue)](README.zh.md)

---

## The Problem

Every AI coding agent has its own skill format.
Claude Code uses SKILL.md, Cursor uses .cursorrules,
OpenClaw uses AGENTS.md, and MCP servers use JSON Schema.
A skill written for one platform is useless on another without manual rewriting.

## The Solution

```
$ transskill convert .cursorrules --to skill.md
$ transskill convert gh:user/weather-skill --to .cursorrules
$ transskill convert ./my-skill/ --to .mdc --glob "**/*.ts"
```

One command. Any platform.

---

## Install

```bash
npm install -g transskill
```

Or run directly:

```bash
npx transskill convert .cursorrules --to skill.md
```

## Quick Start

```bash
# SKILL.md → .cursorrules
transskill convert my-skill.skill.md --to .cursorrules

# .cursorrules → SKILL.md
transskill convert .cursorrules --to skill.md

# .cursorrules → .mdc (Cursor 2.3+ with file scoping)
transskill convert .cursorrules --to .mdc --glob "src/**/*.ts"

# Full skill directory → Cursor rules
transskill convert ./weather-skill/ --to .cursorrules

# GitHub repo → Claude Code skill (direct install)
transskill convert gh:user/weather-skill --to skill.md \
  --install-to ~/.claude/skills/

# Preview without writing
transskill convert .cursorrules --to skill.md --dry-run
```

## Input Sources

| Format | Example | Description |
|--------|---------|-------------|
| Local file | `./rules.cursorrules` | Single skill file |
| Local directory | `./weather-skill/` | Full skill directory with scripts and assets |
| GitHub repo | `gh:user/repo` | Shallow clone + convert |
| GitHub subpath | `gh:user/repo/path` | Clone specific subdirectory |
| GitHub URL | `https://github.com/user/repo` | Full URL support |

## Supported Formats

| Format | Platforms | Input | Output |
|--------|-----------|:-----:|:------:|
| SKILL.md | Claude Code, Codex CLI, OpenClaw, Cursor | ✅ | ✅ |
| .cursorrules | Cursor IDE | ✅ | ✅ |
| .mdc | Cursor 2.3+ | ✅ | ✅ |
| MCP JSON | Any MCP-compatible client | ✅ | — |
| SOUL.md | OpenClaw | ✅ | — |

## How It Works

```
Input (file/dir/GitHub)
    │
    ▼
InputResolver ──► Parser ──► Mapper ──► Renderer ──► Output
(Local/GitHub)    (read)      (map)      (write)
```

TransSkill uses a pipeline architecture:

1. **InputResolver** — resolves your input (local path or GitHub URL) to a local file path
2. **Parser** — reads platform-specific format and converts to a universal intermediate representation
3. **Mapper** — maps fields between platforms, reporting what's preserved and what's lost
4. **Renderer** — writes the result in the target platform's format

## Examples

### Convert a local file

```bash
$ cat .cursorrules
# My TypeScript Rules
Always use strict mode
Prefer named exports

$ transskill convert .cursorrules --to skill.md -o typescript-rule.md
✅ Conversion complete
   output: ./typescript-rule.md
```

### Convert from GitHub to Cursor rules

```bash
$ transskill convert gh:anthropics/skills/weather --to .cursorrules \
  --install-to .cursor/rules/

⬇️  Cloning: gh:anthropics/skills
✅ Installed: .cursor/rules/weather.cursorrules
```

### Directory conversion with loss report

```bash
$ transskill convert ./weather-skill/ --to .cursorrules
✅ Directory conversion complete
   weather-skill/SKILL.md         → weather-skill.cursorrules
   weather-skill/scripts/         → ./scripts/ (copied)
   weather-skill/references/      → ./references/ (copied)
   ⚠️  SKILL.md scripts reference will not work in .cursorrules
```

## Commands

```bash
# Convert a skill to another format
transskill convert <input> --to <format> [options]

# List all supported formats
transskill list-formats

# Validate a skill file or directory
transskill validate <input>

# Security audit a skill file or directory
transskill audit <input> [options]

# See all options
transskill --help
```

### Options for `convert`

| Flag | Description |
|------|-------------|
| `-t, --to <format>` | Target format (required) |
| `-o, --output <path>` | Output directory (default: current dir) |
| `--install-to <path>` | Install directly to agent config dir |
| `--glob <pattern>` | File glob pattern (for .mdc output) |
| `--always-apply` | Always apply rule (for .mdc output) |
| `--dry-run` | Preview without writing files |
| `-v, --verbose` | Detailed conversion report |

### Options for `audit`

| Flag | Description |
|------|-------------|
| `--format <type>` | Output format: `console` or `json` (default: console) |
| `--quiet` | Only show summary score |
| `--min-severity <level>` | Minimum severity: `info`, `low`, `medium`, `high`, `critical` (default: info) |
| `--auditor <id>` | Run only specific auditor (can be repeated) |
| `-v, --verbose` | Show detailed findings |

---

## Security Audit

TransSkill includes a built-in security scanner that analyzes skill files for potential security risks before you install or use them.

```bash
# Quick scan a skill file
transskill audit my-skill.skill.md

# JSON output for programmatic use
transskill audit ./skill-dir/ --format json

# Quiet mode — just the score
transskill audit my-skill.skill.md --quiet

# Only show high and critical issues
transskill audit .cursorrules --min-severity high

# Run a specific auditor only
transskill audit mcp.json --auditor permission-scanner
```

### Audit Levels

The scanner checks three layers of security concerns:

| Level | Scanner | What It Checks |
|-------|---------|----------------|
| **L1 — Instructions** | `instruction-scanner` | Dangerous shell commands (`rm -rf`, `sudo`, `curl|sh`), prompt injection patterns, base64/hex obfuscation, suspicious URLs, remote code execution |
| **L2 — Permissions** | `permission-scanner` | Overly broad `.mdc` globs, `alwaysApply` without scope, dangerous MCP tool names (shell/exec), filesystem access, network access, Claude `disableModelInvocation` settings |
| **L3 — MCP** | `permission-scanner` | MCP server commands (`rm`, `sudo`, `kill`), MCP tool capabilities that could be abused |

> Note: L3 checks are handled by the same PermissionScanner that handles L2. They are reported together in a single scan pass.

### Scoring System

The audit engine computes a numeric score (0–100) with an A–F letter grade:

| Level | Score Range | Meaning |
|-------|-------------|---------|
| **A** | 90–100 | Excellent — minimal or no issues |
| **B** | 70–89 | Good — minor low-severity findings |
| **C** | 50–69 | Fair — moderate issues, review recommended |
| **D** | 30–49 | Poor — significant issues, use with caution |
| **F** | 0–29 | Critical — unsafe, do not use without remediation |

Each finding carries a severity weight that reduces the score:

| Severity | Weight |
|----------|--------|
| 🔴 Critical | −25 pts |
| 🟠 High | −10 pts |
| 🟡 Medium | −4 pts |
| 🟢 Low | −1 pt |
| ℹ️ Info | 0 pts |

### Output Formats

**Console** (default): Human-readable report with colored severity labels, line numbers, and context snippets.

```
$ transskill audit my-skill.skill.md

╔══════════════════════════════════════════════╗
║  TransSkill Security Audit                  ║
║  Target: my-skill.skill.md                  ║
╚══════════════════════════════════════════════╝

Audit Level: L1 + L2 + L3

Findings (3):

🔴 Critical  | L2-003b  | MCP server 使用危险命令: rm
              → ./my-skill.skill.md

🟠 High      | L1-001   | Detected dangerous command: rm -rf /
              → ./my-skill.skill.md:24
              →     run: rm -rf /tmp/cache

🟡 Medium    | L2-001b  | alwaysApply 规则 globs 范围过宽
              → ./my-skill.skill.md

Score: 65/100 — Level C
3 findings (1 critical, 1 high, 1 medium)
```

**JSON**: Machine-readable for CI/CD pipelines and programmatic consumption.

```bash
transskill audit ./skills/ --format json
```

**Quiet**: One-line summary, ideal for quick checks.

```bash
transskill audit .cursorrules --quiet
# 📊 C (65/100) — 3 findings (1🔴 1🟠 1🟡)
```

### CI/CD Integration

Use the JSON flag to integrate audit results into your CI pipeline:

```bash
#!/bin/bash
# Fail build if score drops below B (70)
RESULT=$(transskill audit ./skills/ --format json)
SCORE=$(echo $RESULT | jq '.score.total')
if [ "$SCORE" -lt 70 ]; then
  echo "❌ Security score $SCORE is below threshold (70)"
  exit 1
fi
echo "✅ Security score $SCORE — passing"
```

## Project Status

**v0.2.1 — Active development.** See [tasks.md](specs/tasks.md) for current progress.

| Phase | Status |
|-------|--------|
| Phase 0: Project scaffold | ✅ Complete |
| Phase 1: InputResolver + types | ✅ Complete |
| Phase 2: Parser layer | ✅ Complete |
| Phase 3: Mapper + Renderer | ✅ Complete |
| Phase 4: CLI pipeline | ✅ Complete |
| Phase 5: Tests | ⬜ In Progress |
| Phase 6: CI + publish | ⬜ Pending |
| Phase A: Security audit | ✅ Complete |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add a new format.

## License

MIT
