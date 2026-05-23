# TransSkill: A Better Way to Write AI Agent Skills

TransSkill is the universal converter for AI agent skill files.
Write one skill. Use it everywhere.

## Why TransSkill?

**The problem:** Every AI coding agent has its own skill format.
Claude Code uses SKILL.md, Cursor uses .cursorrules,
OpenClaw uses its own AGENTS.md system, and MCP servers use JSON.
If you write a skill for one platform, you have to manually rewrite it for another.

**The solution:** TransSkill converts between all major formats automatically.
One command, any platform.

## Features

- **SKILL.md ↔ .cursorrules ↔ .mdc** — bidirectional conversion
- **MCP JSON → SKILL.md** — one-way conversion
- **Full skill directory** — converts SKILL.md + scripts + assets together
- **GitHub source** — `transskill convert gh:user/repo --to <format>`
- **Direct install** — `--install-to` writes to target agent config directory
- **Dry-run** — see what would happen before doing it
- **Loss reporting** — know exactly what was preserved and what wasn't

## Architecture

```
Input (file/dir/GitHub)
    │
    ▼
InputResolver ──► Parser ──► Mapper ──► Renderer ──► Output
(Local/GitHub)    (read)      (map)      (write)
```

## License

MIT
