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

## Commands

```bash
# Convert a skill to another format
transskill convert <input> --to <format> [options]

# List all supported formats
transskill list-formats

# Validate a skill file or directory
transskill validate <input>

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

## Project Status

**Active development.** See [tasks.md](specs/tasks.md) for current progress.

| Phase | Status |
|-------|--------|
| Phase 0: Project scaffold | ✅ Complete |
| Phase 1: InputResolver + types | ✅ Complete |
| Phase 2: Parser layer | ✅ Complete |
| Phase 3: Mapper + Renderer | ⬜ Pending |
| Phase 4: CLI pipeline | ⬜ Pending |
| Phase 5: Tests | ⬜ Pending |
| Phase 6: CI + publish | ⬜ Pending |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add a new format.

## License

MIT
