import { describe, it, expect } from 'vitest';
import { CursorRulesParser } from '../src/parser/cursor-rules.parser.js';
import { CursorRulesRenderer } from '../src/renderer/cursor-rules.renderer.js';
import { MdcRenderer } from '../src/renderer/mdc.renderer.js';
import { MdcParser } from '../src/parser/mdc.parser.js';
import { DefaultMapper } from '../src/mapper/default.mapper.js';
import type { IntermediateSkill } from '../src/core/types.js';

// Helper: run full pipeline .cursorrules → .mdc
function convertCursorRulesToMdc(content: string, filePath?: string): string {
  const parser = new CursorRulesParser();
  const renderer = new MdcRenderer();
  const mapper = new DefaultMapper();

  const skill = parser.parse(content, filePath);
  const { skill: mapped } = mapper.map(skill, '.mdc');
  return renderer.render(mapped);
}

// Helper: run full pipeline .mdc → .cursorrules
function convertMdcToCursorRules(content: string, filePath?: string): string {
  const parser = new MdcParser();
  const renderer = new CursorRulesRenderer();
  const mapper = new DefaultMapper();

  const skill = parser.parse(content, filePath);
  const { skill: mapped } = mapper.map(skill, '.cursorrules');
  return renderer.render(mapped);
}

// Helper: parse .cursorrules → IntermediateSkill
function parseCursorRules(content: string, filePath?: string): IntermediateSkill {
  const parser = new CursorRulesParser();
  return parser.parse(content, filePath);
}

describe('CursorRulesParser', () => {
  it('parses a .cursorrules file with a # heading', () => {
    const content = `# Weather rules
Get current weather for any location
Warn about severe conditions`;

    const skill = parseCursorRules(content, 'weather.cursorrules');

    expect(skill.name).toBe('weather');
    expect(skill.description).toBe('Weather rules');
    expect(skill.instructions).toBe('Get current weather for any location\nWarn about severe conditions');
    expect(skill.metadata.sourceFormat).toBe('.cursorrules');
  });

  it('parses a .cursorrules file with a ## sub-heading', () => {
    const content = `## TypeScript conventions
Prefer named exports
Use strict null checks`;

    const skill = parseCursorRules(content, 'ts-rules.cursorrules');

    expect(skill.name).toBe('ts-rules');
    expect(skill.description).toBe('TypeScript conventions');
    expect(skill.instructions).toBe('Prefer named exports\nUse strict null checks');
  });

  it('parses a .cursorrules file without a heading (plain text)', () => {
    const content = `Always provide temperature
Use metric units by default`;

    const skill = parseCursorRules(content, 'weather.cursorrules');

    expect(skill.name).toBe('weather');
    expect(skill.description).toBe('Cursor rules for weather');
    expect(skill.instructions).toBe(content); // full content preserved
  });

  it('parses an empty .cursorrules file', () => {
    const skill = parseCursorRules('', 'empty.cursorrules');

    expect(skill.name).toBe('empty');
    expect(skill.description).toBe('Cursor rules for empty');
    expect(skill.instructions).toBe('');
  });

  it('parses without filePath (fallback name)', () => {
    const skill = parseCursorRules('# My Title\nContent');

    expect(skill.name).toBe('untitled-rules');
    expect(skill.description).toBe('My Title');
    expect(skill.instructions).toBe('Content');
  });

  it('detects format by file extension', () => {
    const parser = new CursorRulesParser();
    expect(parser.detect('', 'test.cursorrules')).toBe(true);
    expect(parser.detect('', 'test.mdc')).toBe(false);
    expect(parser.detect('', 'test.md')).toBe(false);
  });
});

describe('CursorRules → .mdc conversion (Bug T-302 fix)', () => {
  it('uses first # line as description and strips it from instructions', () => {
    const mdc = convertCursorRulesToMdc(
      '# Weather rules\nGet current weather\nWarn about severe conditions',
      'weather.cursorrules',
    );

    // Description in frontmatter
    expect(mdc).toContain('description: Weather rules');
    // Heading line NOT duplicated in body
    expect(mdc.match(/# Weather rules/g)?.length ?? 0).toBe(0);
    // Body is clean
    expect(mdc).toContain('Get current weather');
    expect(mdc).not.toContain('alwaysApply');
  });

  it('uses fallback description when no heading exists', () => {
    const mdc = convertCursorRulesToMdc(
      'Always provide temperature\nUse metric units',
      'weather.cursorrules',
    );

    expect(mdc).toContain('description: Cursor rules for weather');
  });

  it('handles ## sub-headings correctly', () => {
    const mdc = convertCursorRulesToMdc(
      '## TypeScript\nPrefer named exports',
      'ts.cursorrules',
    );

    expect(mdc).toContain('description: TypeScript');
    expect(mdc).not.toContain('## TypeScript');
    expect(mdc).toContain('Prefer named exports');
  });

  it('does not emit alwaysApply: false in frontmatter', () => {
    const mdc = convertCursorRulesToMdc('# Test\nBody text', 'test.cursorrules');
    expect(mdc).not.toContain('alwaysApply');
  });
});

describe('MdcRenderer — alwaysApply handling', () => {
  it('emits alwaysApply: true when set', () => {
    const skill: IntermediateSkill = {
      name: 'test',
      description: 'Always rule',
      instructions: 'Do this always',
      metadata: { sourceFormat: '.mdc' },
      platformSpecific: { cursor: { alwaysApply: true } },
    };

    const renderer = new MdcRenderer();
    const output = renderer.render(skill);

    expect(output).toContain('alwaysApply: true');
  });

  it('omits alwaysApply when false', () => {
    const skill: IntermediateSkill = {
      name: 'test',
      description: 'Normal rule',
      instructions: 'Do this sometimes',
      metadata: { sourceFormat: '.mdc' },
      platformSpecific: { cursor: { alwaysApply: false } },
    };

    const renderer = new MdcRenderer();
    const output = renderer.render(skill);

    expect(output).not.toContain('alwaysApply');
  });

  it('omits alwaysApply when undefined', () => {
    const skill: IntermediateSkill = {
      name: 'test',
      description: 'Normal rule',
      instructions: 'Do this sometimes',
      metadata: { sourceFormat: '.mdc' },
      platformSpecific: { cursor: {} },
    };

    const renderer = new MdcRenderer();
    const output = renderer.render(skill);

    expect(output).not.toContain('alwaysApply');
  });
});

describe('CursorRulesRenderer — clean heading output', () => {
  it('uses description as heading when available', () => {
    const skill: IntermediateSkill = {
      name: 'test',
      description: 'Weather rules',
      instructions: 'Get weather\nUse metric',
      metadata: { sourceFormat: '.cursorrules' },
      platformSpecific: {},
    };

    const renderer = new CursorRulesRenderer();
    const output = renderer.render(skill);

    expect(output).toMatch(/^# Weather rules/);
    expect(output).not.toContain('# test');
    expect(output).toContain('Get weather');
  });

  it('falls back to name when description is empty', () => {
    const skill: IntermediateSkill = {
      name: 'my-rules',
      description: '',
      instructions: 'Some instructions',
      metadata: { sourceFormat: '.mdc' },
      platformSpecific: {},
    };

    const renderer = new CursorRulesRenderer();
    const output = renderer.render(skill);

    expect(output).toMatch(/^# my-rules/);
  });

  it('falls back to name when description equals name (avoids redundancy)', () => {
    const skill: IntermediateSkill = {
      name: 'my-rules',
      description: 'my-rules',
      instructions: 'Do stuff',
      metadata: { sourceFormat: '.mdc' },
      platformSpecific: {},
    };

    const renderer = new CursorRulesRenderer();
    const output = renderer.render(skill);

    // Should still work — just output description (which equals name)
    expect(output).toMatch(/^# my-rules/);
    expect(output.split('\n').filter(l => l.startsWith('#')).length).toBe(1);
  });
});

describe('Round-trip fidelity', () => {
  it('.cursorrules → .mdc → .cursorrules preserves description', () => {
    const original = '# Weather rules\nGet current weather\nUse metric units';

    // Step 1: .cursorrules → .mdc
    const parser = new CursorRulesParser();
    const mdcRenderer = new MdcRenderer();
    const cursorRenderer = new CursorRulesRenderer();
    const mapper = new DefaultMapper();

    const skill1 = parser.parse(original, 'weather.cursorrules');
    const { skill: mapped1 } = mapper.map(skill1, '.mdc');
    const mdcOut = mdcRenderer.render(mapped1);

    // Step 2: .mdc → .cursorrules
    const mdcParser = new MdcParser();
    const skill2 = mdcParser.parse(mdcOut, 'weather.mdc');
    const { skill: mapped2 } = mapper.map(skill2, '.cursorrules');
    const cursorOut = cursorRenderer.render(mapped2);

    // Heading preserved
    expect(cursorOut).toMatch(/^# Weather rules/);
    // Instructions restored
    expect(cursorOut).toContain('Get current weather');
    expect(cursorOut).toContain('Use metric units');
    // No tooling comments in output
    expect(cursorOut).not.toContain('generated by TransSkill');
  });

  it('.mdc → .cursorrules → .mdc preserves description', () => {
    const mdcInput = `---
description: TypeScript conventions
globs: "**/*.ts"
---
Prefer named exports
Use strict null checks`;

    const mdcParser = new MdcParser();
    const mdcRenderer = new MdcRenderer();
    const cursorRenderer = new CursorRulesRenderer();
    const mapper = new DefaultMapper();

    const skill1 = mdcParser.parse(mdcInput, 'ts.mdc');
    const { skill: mapped1 } = mapper.map(skill1, '.cursorrules');
    const cursorOut = cursorRenderer.render(mapped1);

    expect(cursorOut).toMatch(/^# TypeScript conventions/);

    const cursorParser = new CursorRulesParser();
    const skill2 = cursorParser.parse(cursorOut, 'ts.cursorrules');
    const { skill: mapped2 } = mapper.map(skill2, '.mdc');
    const mdcOut = mdcRenderer.render(mapped2);

    expect(mdcOut).toContain('description: TypeScript conventions');
    expect(mdcOut).toContain('Prefer named exports');
    expect(mdcOut).toContain('Use strict null checks');
  });
});
