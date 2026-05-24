import { describe, it, expect } from 'vitest';
import { CursorRulesParser } from '../src/parser/cursor-rules.parser.js';
import { CursorRulesRenderer } from '../src/renderer/cursor-rules.renderer.js';
import { MdcRenderer } from '../src/renderer/mdc.renderer.js';
import { MdcParser } from '../src/parser/mdc.parser.js';
import { SKILLMdRenderer } from '../src/renderer/skill-md.renderer.js';
import { SKILLMdParser } from '../src/parser/skill-md.parser.js';
import { DefaultMapper } from '../src/mapper/default.mapper.js';
import matter from 'gray-matter';

/**
 * Integration tests exercise the full pipeline:
 *   parse → map → render → (re-parse) → verify
 */

describe('Full pipeline: .cursorrules → all formats', () => {
  const source = `# Weather rules
Get current weather for any location
Warn about severe conditions
Use metric units by default`;

  const parseAndConvertTo = (targetFormat: '.mdc' | 'skill.md' | '.cursorrules'): string => {
    const parser = new CursorRulesParser();
    const mapper = new DefaultMapper();
    const renderer =
      targetFormat === '.mdc'
        ? new MdcRenderer()
        : targetFormat === 'skill.md'
          ? new SKILLMdRenderer()
          : new CursorRulesRenderer();

    const skill = parser.parse(source, 'weather.cursorrules');
    const { skill: mapped } = mapper.map(skill, targetFormat);
    return renderer.render(mapped);
  };

  it('.cursorrules → .mdc has correct description in frontmatter', () => {
    const output = parseAndConvertTo('.mdc');
    const parsed = matter(output);

    expect(parsed.data.description).toBe('Weather rules');
    // No alwaysApply noise
    expect(parsed.data.alwaysApply).toBeUndefined();
    // Body should NOT contain the title line
    expect(parsed.content).not.toContain('# Weather rules');
    // Body should contain actual instructions
    expect(parsed.content).toContain('Get current weather');
  });

  it('.cursorrules → skill.md has correct name and description in frontmatter', () => {
    const output = parseAndConvertTo('skill.md');
    const parsed = matter(output);

    expect(parsed.data.name).toBe('weather');
    expect(parsed.data.description).toBe('Weather rules');
    // Body should NOT contain the title line
    expect(parsed.content).not.toContain('# Weather rules');
    expect(parsed.content).toContain('Get current weather');
  });

  it('.cursorrules → .cursorrules (identity) preserves content', () => {
    const output = parseAndConvertTo('.cursorrules');
    // Heading from description (not name)
    expect(output).toMatch(/^# Weather rules/);
    // Instructions preserved
    expect(output).toContain('Get current weather');
    expect(output).toContain('Warn about severe conditions');
  });
});

describe('Full pipeline: .mdc → all formats', () => {
  const source = `---
description: TypeScript conventions
globs: "**/*.ts"
---
Prefer named exports
Use strict null checks`;

  const parseAndConvertTo = (targetFormat: '.cursorrules' | 'skill.md'): string => {
    const parser = new MdcParser();
    const mapper = new DefaultMapper();
    const renderer =
      targetFormat === '.cursorrules'
        ? new CursorRulesRenderer()
        : new SKILLMdRenderer();

    const skill = parser.parse(source, 'ts-conventions.mdc');
    const { skill: mapped } = mapper.map(skill, targetFormat);
    return renderer.render(mapped);
  };

  it('.mdc → .cursorrules preserves description as heading', () => {
    const output = parseAndConvertTo('.cursorrules');
    expect(output).toMatch(/^# TypeScript conventions/);
    expect(output).toContain('Prefer named exports');
  });

  it('.mdc → skill.md preserves description in frontmatter', () => {
    const output = parseAndConvertTo('skill.md');
    const parsed = matter(output);
    expect(parsed.data.description).toBe('TypeScript conventions');
    expect(parsed.data.name).toBe('ts-conventions');
  });
});

describe('Full pipeline: skill.md → all formats', () => {
  const source = `---
name: weather-skill
description: Weather rules for API
tags:
  - weather
  - api
---
Get current temperature
Use metric units`;

  const parseAndConvertTo = (targetFormat: '.mdc' | '.cursorrules'): string => {
    const parser = new SKILLMdParser();
    const mapper = new DefaultMapper();
    const renderer =
      targetFormat === '.mdc'
        ? new MdcRenderer()
        : new CursorRulesRenderer();

    const skill = parser.parse(source, 'weather-skill/SKILL.md');
    const { skill: mapped } = mapper.map(skill, targetFormat);
    return renderer.render(mapped);
  };

  it('skill.md → .mdc preserves description', () => {
    const output = parseAndConvertTo('.mdc');
    const parsed = matter(output);
    expect(parsed.data.description).toBe('Weather rules for API');
    expect(parsed.content).toContain('Get current temperature');
  });

  it('skill.md → .cursorrules preserves description as heading', () => {
    const output = parseAndConvertTo('.cursorrules');
    expect(output).toMatch(/^# Weather rules for API/);
    expect(output).toContain('Get current temperature');
  });
});

describe('Full round-trip: .cursorrules → .mdc → .cursorrules', () => {
  const original = '# Weather rules\nGet current weather\nUse metric units\nWarn about severe conditions';

  it('round-trips description correctly', () => {
    const cursorParser = new CursorRulesParser();
    const cursorRenderer = new CursorRulesRenderer();
    const mdcParser = new MdcParser();
    const mdcRenderer = new MdcRenderer();
    const mapper = new DefaultMapper();

    // Step 1: cursorrules → mdc
    const skill1 = cursorParser.parse(original, 'weather.cursorrules');
    const { skill: mdcMapped } = mapper.map(skill1, '.mdc');
    const mdcOut = mdcRenderer.render(mdcMapped);

    // Step 2: mdc → cursorrules
    const skill2 = mdcParser.parse(mdcOut, 'weather.mdc');
    const { skill: cursorMapped } = mapper.map(skill2, '.cursorrules');
    const cursorOut = cursorRenderer.render(cursorMapped);

    // Verify round-trip
    expect(cursorOut).toMatch(/^# Weather rules/);
    expect(cursorOut).toContain('Get current weather');
    expect(cursorOut).toContain('Use metric units');

    // Re-parse the round-tripped cursorrules to verify internal representation
    const skill3 = cursorParser.parse(cursorOut, 'weather.cursorrules');
    expect(skill3.description).toBe('Weather rules');
    expect(skill3.instructions).toBe('Get current weather\nUse metric units\nWarn about severe conditions');
  });
});

describe('Full round-trip: .mdc → .cursorrules → .mdc', () => {
  const original = `---
description: TypeScript rules
---
Prefer named exports
Use strict null checks`;

  it('round-trips description correctly', () => {
    const cursorParser = new CursorRulesParser();
    const cursorRenderer = new CursorRulesRenderer();
    const mdcParser = new MdcParser();
    const mdcRenderer = new MdcRenderer();
    const mapper = new DefaultMapper();

    // Step 1: mdc → cursorrules
    const skill1 = mdcParser.parse(original, 'ts.mdc');
    const { skill: cursorMapped } = mapper.map(skill1, '.cursorrules');
    const cursorOut = cursorRenderer.render(cursorMapped);

    expect(cursorOut).toMatch(/^# TypeScript rules/);

    // Step 2: cursorrules → mdc
    const skill2 = cursorParser.parse(cursorOut, 'ts.cursorrules');
    const { skill: mdcMapped } = mapper.map(skill2, '.mdc');
    const mdcOut = mdcRenderer.render(mdcMapped);

    const parsed = matter(mdcOut);
    expect(parsed.data.description).toBe('TypeScript rules');
    expect(parsed.content).toContain('Prefer named exports');
    expect(parsed.content).toContain('Use strict null checks');
  });
});
