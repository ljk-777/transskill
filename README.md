# TransSkill

> **Write once, run on any agent.**

TransSkill is a CLI tool that converts AI agent skill files between different platforms. Convert SKILL.md, .cursorrules, .mdc, MCP configs, and more — no manual rewriting required.

## Install

```bash
npm install -g transskill
```

## Quick Start

```bash
# Convert a local .cursorrules to SKILL.md
transskill convert .cursorrules --to skill.md

# Convert a local SKILL.md to .cursorrules
transskill convert my-skill.skill.md --to .cursorrules

# Convert a full skill directory to Cursor rules
transskill convert ./weather-skill/ --to .cursorrules

# Convert from a GitHub repo directly
transskill convert gh:user/weather-skill --to .mdc --glob "**/*.ts"

# Install directly to Claude Code
transskill convert gh:user/weather-skill --to skill.md --install-to ~/.claude/skills/

# See what would be done without writing
transskill convert .cursorrules --to skill.md --dry-run
```

## Supported Formats

| Format | As Input | As Output |
|--------|:--------:|:---------:|
| SKILL.md | ✅ | ✅ |
| .cursorrules | ✅ | ✅ |
| .mdc | ✅ | ✅ |
| MCP JSON | ✅ | — |
| SOUL.md | ✅ | — |

## Input Sources

- **Local file**: `./my-skill.skill.md`
- **Local directory**: `./weather-skill/`
- **GitHub repo**: `gh:user/repo` or `https://github.com/user/repo`
- **GitHub subpath**: `gh:user/repo/path/to/skill`

## License

MIT
