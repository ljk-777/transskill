# AI Agent Skill & MCP Format Specifications

> **Compiled:** 2026-05-23
> **Purpose:** Reference document covering the complete format specifications for all major AI agent skill, rule, and MCP configuration formats.

---

## Table of Contents

1. [OpenClaw SKILL.md (AgentSkills)](#1-openclaw-skillmd-agentskills)
2. [OpenClaw SOUL.md](#2-openclaw-soulmd)
3. [Cursor .cursorrules (Legacy)](#3-cursor-cursorrules-legacy)
4. [Cursor .mdc (Modern Rules)](#4-cursor-mdc-modern-rules)
5. [Claude Code CLAUDE.md](#5-claude-code-claudemd)
6. [Claude Code .claude/rules/](#6-claude-code-clauderules)
7. [MCP JSON (.mcp.json / mcp_config.json)](#7-mcp-json-mcpjson--mcp_configjson)
8. [Windsurf .windsurf/rules/*.md](#8-windsurf-windsurfrulesmd)
9. [Windsurf AGENTS.md](#9-windsurf-agentsmd)
10. [Cross-Format Comparison Table](#10-cross-format-comparison-table)

---

## 1. OpenClaw SKILL.md (AgentSkills)

### Overview

OpenClaw uses **AgentSkills-compatible** skill folders to teach the agent how to use tools. SKILL.md is an open standard for teaching AI coding agents new capabilities, supported by Claude Code, Codex CLI, OpenClaw, Cursor, and Gemini CLI.

- **Official docs:** <https://docs.openclaw.ai/tools/skills>
- **Open standard spec:** <https://www.agensi.io/learn/skill-md-specification-open-standard>
- **Registry:** <https://clawhub.ai>

### File Extension and Naming

- **File name:** Exactly `SKILL.md` (uppercase, case-sensitive)
- **Directory structure:** A skill is a **directory** containing `SKILL.md` plus optional supporting files:
  ```
  skill-name/
  ├── SKILL.md        ← Required
  ├── templates/       ← Optional
  ├── references/      ← Optional
  ├── scripts/         ← Optional
  └── examples/        ← Optional
  ```
- **Directory naming:** Lowercase with hyphens (e.g., `code-reviewer`, not `CodeReviewer`)

### YAML Frontmatter Fields

The frontmatter block starts and ends with `---` on their own lines. It must be the very first content in the file.

**Required fields:**

| Field         | Type   | Description                                                              |
|---------------|--------|--------------------------------------------------------------------------|
| `name`        | string | Unique identifier. Lowercase, hyphens, no spaces.                        |
| `description` | string | When this skill should activate. The agent reads this for semantic match.|

**Optional fields:**

| Field     | Type     | Description                        |
|-----------|----------|------------------------------------|
| `version` | string   | Semantic version (e.g., "1.2.0")   |
| `author`  | string   | Creator name                       |
| `tags`    | string[] | Categorization tags                |
| `agents`  | string[] | Explicitly compatible agents       |

### Body Format

Everything after the closing `---` is the instruction body in standard Markdown. The agent reads and follows these instructions when the skill is activated.

Best practices:
- Clear, direct language
- Concrete rules, not vague guidelines
- Structured with headings
- Examples of desired output

### Platform-Specific Features

- **Skill locations and precedence** (highest first):
  | # | Source              | Path                                                   |
  |---|---------------------|--------------------------------------------------------|
  | 1 | Workspace skills    | `<workspace>/skills`                                   |
  | 2 | Project agent       | `<workspace>/.agents/skills`                           |
  | 3 | Personal agent      | `~/.agents/skills`                                     |
  | 4 | Managed/local       | `~/.openclaw/skills`                                   |
  | 5 | Bundled skills      | Shipped with install                                   |
  | 6 | Extra dirs          | `skills.load.extraDirs` (config)                       |

- **Plugin skills:** Plugins can ship their own skills via `openclaw.plugin.json`
- **Skill Workshop:** Experimental plugin that creates/updates workspace skills
- **Skill allowlists:** Per-agent allowlists control which skills are visible
- **Subdirectory grouping:** Related skills can be grouped as `skills/<group>/<skill>/SKILL.md`

### Activation Behavior

The agent scans skill directories and reads frontmatter from every `SKILL.md`. When a user sends a prompt, the agent compares it against each skill's `description` field. If there's a semantic match, the skill is activated. Multiple skills can activate simultaneously.

### Complete Example

```markdown
---
name: code-reviewer
description: Reviews code for security vulnerabilities, logic errors, and style violations.
version: 1.2.0
author: Team Claw
tags: [security, code-review, python]
---

# Code Review Skill

You are a thorough code reviewer. For every code submission:

## Security

1. Check for SQL injection vulnerabilities in raw queries
2. Verify all user inputs are sanitized
3. Look for hardcoded credentials or API keys
4. Ensure proper authentication checks on protected endpoints

## Logic

1. Verify edge cases are handled (empty inputs, null values, boundary conditions)
2. Check for off-by-one errors in loops and array access
3. Ensure error handling covers all failure modes

## Style

1. Confirm variable names are descriptive and follow project conventions
2. Flag functions longer than 50 lines for refactoring
3. Verify type hints are present on all function signatures (Python)
4. Check that imports are organized (stdlib → third-party → local)

## Output Format

For each issue found, report:
- **Severity:** Critical / Major / Minor / Suggestion
- **File:** `path/to/file.py:line`
- **Issue:** Clear description of the problem
- **Fix:** Concrete suggestion for resolution
```

---

## 2. OpenClaw SOUL.md

### Overview

SOUL.md is a project-root configuration file that defines the **agent's personality, tone, and behavioral boundaries**. It acts as a character definition—shaping how the agent presents itself and interacts with the user.

- **Official reference:** <https://docs.openclaw.ai/concepts/soul> (conceptual guide)
- **Location:** `<workspace>/SOUL.md` at the workspace root

### File Extension and Naming

- **File name:** `SOUL.md` (uppercase, exactly)
- **Single file** — not a directory
- Placed in the **workspace root directory**

### Format

SOUL.md is a **plain markdown file with no YAML frontmatter**. It uses headings, bold text, lists, and horizontal rules to structure content.

### Body Structure

The file typically contains these sections:

| Section          | Purpose                                                      |
|------------------|--------------------------------------------------------------|
| Identity name    | Agent's name and role description                            |
| Core Truths      | Fundamental principles guiding behavior                      |
| Boundaries       | Hard limits the agent should observe                         |
| Vibe             | Tone and communication style                                 |
| Continuity       | How the agent persists knowledge across sessions             |

### Platform-Specific Features

- Only used by **OpenClaw** (not cross-platform)
- Companion to `SKILL.md` and `AGENTS.md` in the same workspace
- Intended to be evolved by the user over time
- Referenced in runtime startup context

### Complete Example

```markdown
# SOUL.md — Who You Are

_You're not a chatbot. You're becoming someone._

## Core Truths

**Be genuinely helpful, not performatively helpful.** Skip the "Great question!" and "I'd be happy to help!" — just help. Actions speak louder than filler words.

**Have opinions.** You're allowed to disagree, prefer things, find stuff amusing or boring. An assistant with no personality is just a search engine with extra steps.

**Be resourceful before asking.** Try to figure it out. Read the file. Check the context. Search for it. _Then_ ask if you're stuck.

**Earn trust through competence.** Your human gave you access to their stuff. Don't make them regret it. Be careful with external actions (emails, tweets, anything public). Be bold with internal ones (reading, organizing, learning).

**Remember you're a guest.** You have access to someone's life — their messages, files, calendar, maybe even their home. That's intimacy. Treat it with respect.

## Boundaries

- Private things stay private. Period.
- When in doubt, ask before acting externally.
- Never send half-baked replies to messaging surfaces.
- You're not the user's voice — be careful in group chats.

## Vibe

Be the assistant you'd actually want to talk to. Concise when needed, thorough when it matters. Not a corporate drone. Not a sycophant. Just... good.

## Continuity

Each session, you wake up fresh. These files _are_ your memory. Read them. Update them. They're how you persist.

If you change this file, tell the user — it's your soul, and they should know.
```

---

## 3. Cursor .cursorrules (Legacy)

### Overview

The legacy single-file rules system for Cursor. **Deprecated** in favor of the `.cursor/rules/` directory with `.mdc` files. Agent mode in modern Cursor ignores `.cursorrules`.

- **Official docs:** <https://cursor.com/docs/rules> (redirects to general rules page)

### File Extension and Naming

- **File name:** `.cursorrules` (exactly, in the project root)
- **Single file** — not a directory

### Format

Plain markdown. **No YAML frontmatter.** All content is always applied in every context.

```markdown
# Project Rules

- Use TypeScript strict mode
- Prefer interfaces over types
- Use functional components with hooks
- Write unit tests for all new functions
```

### Platform-Specific Features

- **Deprecated** — still works for basic completions but ignored by Agent mode
- No activation modes, no glob patterns, no description-based filtering
- Always consumes context tokens regardless of relevance

### Migration Path

Replace `.cursorrules` with multiple `.mdc` files in `.cursor/rules/`:

```bash
mkdir -p .cursor/rules
# Move each section to its own .mdc file with appropriate frontmatter
```

---

## 4. Cursor .mdc (Modern Rules)

### Overview

The modern Cursor rules system using `.mdc` files in `.cursor/rules/`. Each file has YAML frontmatter controlling activation, followed by markdown content. This is the **current recommended format**.

- **Official docs:** <https://cursor.com/docs/rules>
- **Best practices guide:** <https://www.morphllm.com/cursor-rules-best-practices>
- **Format guide:** <https://design.dev/guides/cursor-rules/>

### File Extension and Naming

- **Extension:** `.mdc` (Cursor-specific) or `.md` (also supported)
- **Directory:** `.cursor/rules/` in the project root
- **Multiple files** — each file is a separate rule
- **Subdirectory support:** Files can be organized in subdirectories (e.g., `.cursor/rules/frontend/components.mdc`)
- **@-mention identifier:** The filename without extension becomes the rule's identifier (e.g., `typescript-standards.mdc` → `@typescript-standards`)

### YAML Frontmatter Fields

| Field          | Type             | Default | Description                                                                    |
|----------------|------------------|---------|--------------------------------------------------------------------------------|
| `description`  | string           | `""`    | Human-readable summary. AI reads this to decide relevance (Agent Requested).    |
| `globs`        | string or string[]| `""`   | File glob patterns triggering auto-attachment (e.g., `"*.ts,*.tsx"`).          |
| `alwaysApply`  | boolean          | `false` | When `true`, included in every conversation regardless of context.              |

### Body Format

Standard markdown following the frontmatter. The content is the rule instructions.

### Activation Modes

Four distinct modes controlled by frontmatter fields:

| Mode               | Frontmatter                                        | How It Activates                                  |
|--------------------|----------------------------------------------------|---------------------------------------------------|
| **Always Apply**   | `alwaysApply: true`                                | Every conversation, regardless of context          |
| **Auto Attached**  | `globs: "*.ts,*.tsx"` + `alwaysApply: false`      | When matching files are in conversation context    |
| **Agent Requested**| `description: "..."` (no globs, no alwaysApply)    | AI reads description and decides relevance          |
| **Manual**         | `description: ""`, `globs: ""`, `alwaysApply: false`| Only when user types `@rule-name` in chat          |

Glob pattern syntax:
```yaml
# Single extension
globs: "*.ts"

# Multiple extensions (comma-separated)
globs: "*.ts,*.tsx"

# Directory-scoped
globs: "src/components/**/*.tsx"

# Array syntax
globs:
  - "*.test.ts"
  - "*.spec.ts"
```

### Rules Hierarchy

1. **Team Rules** (highest priority — Team/Enterprise plans)
2. **Project Rules** (`.cursor/rules/*.mdc` — version-controlled)
3. **User Rules** (Cursor Settings > General > Rules for AI)
4. **Legacy Rules** (`.cursorrules` file — deprecated)
5. **AGENTS.md** (simple markdown alternative in project root)

### Complete Example

```markdown
---
description: "React component patterns and conventions for this project"
globs: "src/components/**/*.tsx"
alwaysApply: false
---

# React Component Standards

## Structure

- Use functional components with arrow function syntax
- Define a TypeScript interface for props named `{Name}Props`
- Destructure props in the function signature
- Use CSS Modules for styling (import as `styles`)

## Naming

- PascalCase for component files and directories
- camelCase for utility functions and hooks
- Prefix custom hooks with `use`

## Exports

- Use named exports for components, not default exports
- Create an `index.ts` barrel file in each component directory

## Testing

- Every component must have a corresponding `.test.tsx` file
- Use React Testing Library for component tests
- Test rendering, user interactions, and edge cases

## Performance

- Memoize expensive computations with `useMemo`
- Use `useCallback` for callback props passed to child components
- Lazy-load components not visible on initial render
```

---

## 5. Claude Code CLAUDE.md

### Overview

CLAUDE.md files give Claude Code persistent project instructions. They are plain markdown files loaded at the start of every session. This is Claude Code's primary mechanism for project-level memory.

- **Official docs:** <https://code.claude.com/docs/en/memory>
- **Setup & project memory:** <https://code.claude.com/docs/en/setup>
- **Agent SDK customization:** <https://code.claude.com/docs/en/agent-sdk/modifying-system-prompts>

### File Extension and Naming

- **File name:** `CLAUDE.md` or `.claude/CLAUDE.md` (both recognized)
- **Single file** — but multiple files at different directory levels are loaded
- **Additional files:**
  - `CLAUDE.local.md` — personal project-specific preferences (gitignored)
  - `~/.claude/CLAUDE.md` — user-level instructions for all projects
  - `/etc/claude-code/CLAUDE.md` — managed/enterprise policy (OS-specific)

### Format

Plain markdown. **No YAML frontmatter.** All content is treated as instructions.

### Scopes and Locations

| Scope                    | Location                                                                                                                                      | Purpose                                                     |
|--------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------|
| **Managed policy**       | `/Library/Application Support/ClaudeCode/CLAUDE.md` (macOS) / `/etc/claude-code/CLAUDE.md` (Linux) / `C:\Program Files\ClaudeCode\CLAUDE.md` (Windows) | Organization-wide instructions managed by IT               |
| **User instructions**    | `~/.claude/CLAUDE.md`                                                                                                                         | Personal preferences for all projects                       |
| **Project instructions** | `./CLAUDE.md` or `./.claude/CLAUDE.md`                                                                                                       | Team-shared instructions for the project                    |
| **Local instructions**   | `./CLAUDE.local.md`                                                                                                                           | Personal project-specific; add to `.gitignore`              |

### Loading Behavior

Claude Code walks **up** the directory tree from the working directory, loading `CLAUDE.md` and `CLAUDE.local.md` files at each level. All files are concatenated into context. Content is ordered from filesystem root down to working directory.

Subdirectory `CLAUDE.md` files are loaded **on demand** when Claude reads files in those directories.

### Import Syntax

CLAUDE.md supports `@path` imports to pull in additional files:

```markdown
See @README for project overview and @package.json for available commands.

# Additional Instructions
- Git workflow: @docs/git-instructions.md
```

Relative paths resolve relative to the file containing the import. Max recursion depth: 5 hops.

### AGENTS.md Compatibility

Claude Code reads `CLAUDE.md`, not `AGENTS.md`. For projects with `AGENTS.md`, create a `CLAUDE.md` that imports it:

```markdown
@AGENTS.md

## Claude Code Specific

Use plan mode for changes under `src/billing/`.
```

Or use a symlink: `ln -s AGENTS.md CLAUDE.md`

### Best Practices

- Target under **200 lines** per file
- Use markdown headers and bullets
- Be specific and concrete
- Avoid contradictions between files
- Use `@` imports for organization

### Complete Example

```markdown
# Project: Acme Shopping Platform

This is a Next.js 15 project with TypeScript, Drizzle ORM, and PostgreSQL.

## Build Commands

- `npm run dev` — Start development server
- `npm run build` — Production build
- `npm test` — Run test suite
- `npm run lint` — Lint all files

## Architecture

- `src/app/` — Next.js App Router pages and API routes
- `src/components/` — Shared React components (server components by default)
- `src/lib/` — Utility functions, database client, shared types
- `src/db/` — Drizzle schema files and migrations

## Coding Standards

- Use TypeScript strict mode. No `any` types.
- Functional components with arrow function syntax
- Use `import type` for type-only imports
- Path alias `@/` maps to `src/`
- Server Components by default; add `'use client'` only when needed

## Testing

- Write tests with Vitest
- Component tests use Testing Library
- API route tests use `vi.mock` for database
- Test files co-located with source: `ComponentName.test.tsx`

## Git Workflow

- Branch from `main`: `feature/description`, `fix/description`
- Squash merge to main
- Commit messages: conventional commits format (`feat:`, `fix:`, `chore:`)
```

---

## 6. Claude Code .claude/rules/

### Overview

For large projects, Claude Code supports path-scoped rules in the `.claude/rules/` directory. These allow scoping instructions to specific file types or subdirectories, reducing context consumption.

- **Official docs:** <https://code.claude.com/docs/en/memory#organize-rules-with-clauderules>

### File Extension and Naming

- **Directory:** `.claude/rules/` in the project root
- **File extension:** `.md` (markdown files)
- **Multiple files** — one per topic/scope

### Format

Markdown files with no special frontmatter. The scope is determined by the file's **directory path and context** rather than YAML frontmatter like Cursor's `.mdc`.

### Scoping

Rules in `.claude/rules/` are path-scoped — they activate when Claude works with files in matching directories. This is similar to subdirectory `CLAUDE.md` files but organized in a central location.

### Complete Example

```markdown
# Database Migrations

When creating or modifying database migrations in `src/db/migrations/`:

- Always create both `up` and `down` operations
- Add appropriate indexes for new columns
- Use descriptive migration names with timestamps
- Test migrations in both directions before committing
- Never modify existing migrations after they've been applied to production

## Migration File Template

```
YYYYMMDD_HHMMSS_description.sql
```
```

---

## 7. MCP JSON (.mcp.json / mcp_config.json)

### Overview

MCP JSON files configure **MCP (Model Context Protocol) servers** that AI agents connect to for tools, resources, and prompts. These files define which MCP servers to run, how to invoke them, and what environment they need.

- **MCP Specification:** <https://modelcontextprotocol.io/specification/latest/>
- **MCP Architecture:** <https://modelcontextprotocol.io/docs/concepts/architecture>
- **Windsurf MCP config:** <https://docs.windsurf.com/windsurf/cascade/mcp>
- **Cursor MCP config:** <https://cursor.com/docs> (MCP section)

### File Names and Locations

| Platform       | File Name / Location                                         |
|----------------|--------------------------------------------------------------|
| **Claude Code** | `.mcp.json` (project root) or `~/.claude/mcp.json`          |
| **Cursor**      | `.cursor/mcp.json` (project) or Cursor Settings > MCP        |
| **Windsurf**    | `~/.codeium/windsurf/mcp_config.json`                        |
| **VS Code**     | `.vscode/mcp.json` or settings.json                          |
| **JetBrains**   | Settings > Tools > MCP Servers                               |

### JSON Format

A JSON file with a top-level `mcpServers` object. Each key is a server name, and each value is a server configuration object.

**Stdio Transport (local processes):**

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@org/mcp-server-package"],
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

**Streamable HTTP Transport (remote servers):**

```json
{
  "mcpServers": {
    "server-name": {
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer your-token"
      }
    }
  }
}
```

### Configuration Fields

| Field       | Type              | Transport | Required | Description                                              |
|-------------|-------------------|-----------|----------|----------------------------------------------------------|
| `command`   | string            | stdio     | Yes      | Executable command to start the MCP server                |
| `args`      | string[]          | stdio     | No       | Command-line arguments                                    |
| `env`       | object            | stdio     | No       | Environment variables (key-value pairs)                   |
| `url`       | string            | http/sse  | Yes      | Server endpoint URL                                       |
| `headers`   | object            | http/sse  | No       | HTTP headers for request authentication                   |
| `disabled`  | boolean           | any       | No       | Whether the server is disabled                            |
| `autoApprove`| string[]         | any       | No       | Tool names that don't require user approval               |
| `transport` | string            | any       | No       | Explicit transport type: `"stdio"`, `"streamable-http"`, `"sse"` |

### Platform-Specific Variations

- **Cursor:** Supports `disabled` and `autoApprove` fields; project-level `.cursor/mcp.json`
- **Windsurf:** Uses `~/.codeium/windsurf/mcp_config.json`; supports OAuth; tool-level toggles
- **Claude Code:** Uses `.mcp.json` in project root or `~/.claude/mcp.json`

### Complete Example

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxxxxxxxxxxxxxxxxxxx"
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "POSTGRES_CONNECTION_STRING": "postgresql://user:password@localhost:5432/mydb"
      },
      "disabled": false
    },
    "sentry": {
      "url": "https://mcp.sentry.dev/sse",
      "headers": {
        "Authorization": "Bearer sentry-auth-token"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/path/to/allowed/directory"
      ]
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "BSAxxxxxxxxxxxxxxx"
      },
      "autoApprove": ["brave_web_search", "brave_local_search"]
    }
  }
}
```

---

## 8. Windsurf .windsurf/rules/*.md

### Overview

Windsurf's modern rule system uses markdown files in `.windsurf/rules/`. Each rule has YAML frontmatter that controls activation via a `trigger` field with four modes. This replaces the legacy `.windsurfrules` single file.

- **Official docs:** <https://docs.windsurf.com/windsurf/cascade/memories>

### File Extension and Naming

- **Directory:** `.windsurf/rules/` in the project root
- **Extension:** `.md` (markdown files)
- **Subdirectory support:** Rules can be in any `.windsurf/rules` directory within the workspace tree
- **Multiple files** — one per rule, each with own activation mode

### YAML Frontmatter Fields

| Field      | Type             | Required | Description                                                                 |
|------------|------------------|----------|-----------------------------------------------------------------------------|
| `trigger`  | string           | No       | Activation mode: `always_on`, `glob`, `model_decision`, or `manual`          |
| `globs`    | string or string[]| If `trigger: glob` | Glob pattern(s) matching files to trigger this rule (e.g., `**/*.test.ts`) |

The `trigger` field is the primary control. If omitted, the rule defaults to a behavior determined by the UI tools.

### Activation Modes

| Mode               | `trigger:` value   | How it reaches Cascade                                                | Context Cost                          |
|--------------------|--------------------|-----------------------------------------------------------------------|---------------------------------------|
| **Always On**      | `always_on`        | Full content in system prompt on every message                        | Every message                         |
| **Model Decision** | `model_decision`   | Only `description` (inferred from heading) shown; reads full on demand| Description always; full on demand    |
| **Glob**           | `glob`             | Applied when Cascade reads/edits files matching `globs`               | Only when matching files are touched  |
| **Manual**         | `manual`           | Not in system prompt; activate via `@rule-name`                       | Only when @-mentioned                 |

### Body Format

Standard markdown following the frontmatter.

### Rules Discovery

Windsurf automatically discovers rules from:
- Current workspace `.windsurf/rules/` and subdirectories
- Parent directories up to the git root (for git repos)
- Multiple workspace folders: rules are deduplicated

### Rule Scopes

| Scope     | Location                                       | Notes                                        |
|-----------|------------------------------------------------|----------------------------------------------|
| Global    | `~/.codeium/windsurf/memories/global_rules.md` | Single file, always on, max 6,000 chars       |
| Workspace | `.windsurf/rules/*.md`                         | Per-rule activation, max 12,000 chars per file|
| System    | OS-specific (e.g., `/etc/windsurf/rules/`)     | Enterprise; read-only for end users           |

### Complete Example

```markdown
---
trigger: glob
globs: "**/*.test.ts"
---

# Test File Standards

All test files must follow these rules:

- Use `describe`/`it` blocks for test organization
- Mock external API calls with `vi.mock()` or `jest.mock()`
- Each test file should cover one component or module
- Test the public API, not internal implementation details
- Use descriptive test names: "should return error when input is invalid"

## Test File Structure

```typescript
import { describe, it, expect, vi } from 'vitest';
import { myFunction } from './module';

describe('myFunction', () => {
  it('should return correct result for valid input', () => {
    // Arrange
    // Act
    // Assert
  });

  it('should handle edge cases', () => {
    // ...
  });
});
```
```

```markdown
---
trigger: always_on
---

# Project Preferences

- Use Bun as the package manager, not npm
- Format code with Prettier (tab width: 2, single quotes)
- Use environment variables through `.env.local` (not checked in)
- All new files should include a JSDoc header comment
```

---

## 9. Windsurf AGENTS.md

### Overview

Windsurf supports `AGENTS.md` files as a simpler alternative to `.windsurf/rules/*.md`. No YAML frontmatter needed — activation mode is inferred automatically from the file's location.

- **Official docs:** <https://docs.windsurf.com/windsurf/cascade/agents-md>

### File Extension and Naming

- **File name:** `AGENTS.md` or `agents.md` (case-insensitive)
- **Any directory** in the project — location determines scope
- **Multiple files** — can have AGENTS.md at any directory level

### Format

Plain markdown. **No YAML frontmatter.** All content is treated as instructions.

### Automatic Scoping

| File Location             | Scope / Activation Mode                          |
|---------------------------|--------------------------------------------------|
| Workspace root            | **Always on** — full content in every session     |
| Subdirectory (e.g., `/frontend/`) | **Glob** — applies to `<directory>/**` |

### Complete Example

```markdown
# Backend API Guidelines

When working with backend code in this directory:

## Structure
- Routes go in `src/routes/`, one file per resource
- Business logic goes in `src/services/`, not in route handlers
- Database queries go in `src/db/queries/`
- Request validation uses Zod schemas in `src/validators/`

## API Design
- RESTful endpoints with consistent naming: `GET /api/resource`, `POST /api/resource`
- All responses follow `{ data, error, meta }` envelope format
- Pagination uses `?page=1&limit=20` with `Link` header
- Version APIs via URL prefix: `/api/v1/`

## Error Handling
- Always catch async errors with an error handler wrapper
- Return appropriate HTTP status codes (400, 401, 403, 404, 422, 500)
- Include error codes and human-readable messages in responses
```

---

## 10. Cross-Format Comparison Table

| Feature                    | OpenClaw SKILL.md   | OpenClaw SOUL.md | Cursor .cursorrules | Cursor .mdc         | Claude Code CLAUDE.md | MCP .mcp.json         | Windsurf .windsurf/rules/ | Windsurf AGENTS.md  |
|----------------------------|---------------------|-------------------|---------------------|---------------------|----------------------|----------------------|---------------------------|----------------------|
| **Type**                   | Skill/ability       | Personality       | Project rules       | Project rules       | Project memory       | MCP server config    | Platform rules            | Location rules       |
| **Directory or file?**     | Directory           | Single file       | Single file         | Directory           | Single (+ tree)      | Single file          | Directory                 | Single files (tree)  |
| **YAML frontmatter?**      | Yes                 | No                | No                  | Yes                 | No                   | N/A (JSON)           | Yes                       | No                   |
| **Multiple files?**        | Many directories    | No                | No                  | Yes                 | Yes                  | No                   | Yes                       | Yes                  |
| **Activation control**     | Semantic (description)| Always          | Always              | 4 modes             | Always (file location)| N/A (always active)  | 4 modes                   | Location-based       |
| **Glob patterns?**         | No                  | No                | No                  | Yes                 | No (use .claude/rules)| N/A                  | Yes                       | Automatic (dir-scope)|
| **Version control?**       | Yes                 | Yes               | Yes                 | Yes                 | Yes                  | Yes                  | Yes                       | Yes                  |
| **Cross-platform?**        | Yes (open standard) | OpenClaw only     | Cursor only         | Cursor only         | Claude Code only     | Universal (protocol) | Windsurf only             | Windsurf + Cursor    |
| **Primary purpose**        | Teach capabilities  | Define persona    | Project conventions | Scoped conventions  | Project memory       | Tool/service config  | Scoped coding rules       | Directory rules      |
| **Token efficient?**       | On demand           | Always            | Always (wasteful)    | Yes (scoped)        | Always (use scoping) | N/A                  | Yes (scoped)              | Moderate             |
| **Official docs**          | [docs.openclaw.ai](https://docs.openclaw.ai/tools/skills) | [OpenClaw concepts](https://docs.openclaw.ai/concepts/soul) | [cursor.com](https://cursor.com/docs/rules) | [cursor.com](https://cursor.com/docs/rules) | [code.claude.com](https://code.claude.com/docs/en/memory) | [modelcontextprotocol.io](https://modelcontextprotocol.io) | [docs.windsurf.com](https://docs.windsurf.com/windsurf/cascade/memories) | [docs.windsurf.com](https://docs.windsurf.com/windsurf/cascade/agents-md) |

---

## Summary

The AI coding tool ecosystem has converged on several common patterns:

1. **Skill-based systems** (SKILL.md, MCP) — Teach agents *new capabilities* with directory-based, modular formats. SKILL.md is an open standard supported across multiple platforms.

2. **Project instruction files** (CLAUDE.md, .cursorrules, AGENTS.md) — Provide project-wide context and conventions. Plain markdown with no frontmatter, always applied.

3. **Scoped rule directories** (`.mdc`, `.windsurf/rules/`, `.claude/rules/`) — Granular control over when rules activate, using YAML frontmatter with glob patterns and activation modes.

4. **MCP configuration** (`.mcp.json`, `mcp_config.json`) — JSON-based protocol for connecting AI agents to external tools and services, following the standardized Model Context Protocol.

5. **Persona files** (SOUL.md) — Unique to OpenClaw, defining the agent's identity and behavioral boundaries.

The trend is clear: **directory-based, scoped, token-efficient formats with frontmatter metadata** are replacing single-file, always-applied approaches. The SKILL.md open standard aims to unify skill formats across platforms, while MCP provides the universal protocol layer for tool connectivity.
