import { describe, it, expect } from 'vitest';
import { DefaultMapper } from '../src/mapper/default.mapper.js';
import type { IntermediateSkill } from '../src/core/types.js';

describe('DefaultMapper', () => {
  const mapper = new DefaultMapper();

  describe('.cursorrules → .mdc', () => {
    const skill: IntermediateSkill = {
      name: 'weather',
      description: 'Weather rules',
      instructions: 'Get current weather',
      metadata: { sourceFormat: '.cursorrules' },
      platformSpecific: {},
    };

    it('preserves name, description, and instructions', () => {
      const { skill: result, report } = mapper.map(skill, '.mdc');

      expect(result.name).toBe('weather');
      expect(result.description).toBe('Weather rules');
      expect(result.instructions).toBe('Get current weather');
      expect(report.preserved).toContain('description');
    });

    it('updates sourceFormat to target', () => {
      const { skill: result } = mapper.map(skill, '.mdc');
      expect(result.metadata.sourceFormat).toBe('.mdc');
    });

    it('initializes cursor with empty object (no default alwaysApply)', () => {
      const { skill: result } = mapper.map(skill, '.mdc');
      expect(result.platformSpecific.cursor).toEqual({});
    });

    it('does not lose alwaysApply: true when present', () => {
      const withAlways: IntermediateSkill = {
        ...skill,
        platformSpecific: { cursor: { alwaysApply: true } },
      };
      const { skill: result } = mapper.map(withAlways, '.mdc');
      expect(result.platformSpecific.cursor?.alwaysApply).toBe(true);
    });

    it('reports no lost fields', () => {
      const { report } = mapper.map(skill, '.mdc');
      expect(report.lost).toHaveLength(0);
    });
  });

  describe('.mdc → .cursorrules', () => {
    const skill: IntermediateSkill = {
      name: 'ts',
      description: 'TypeScript conventions',
      instructions: 'Prefer named exports',
      metadata: { sourceFormat: '.mdc' },
      platformSpecific: { cursor: { globs: ['**/*.ts'], alwaysApply: false } },
    };

    it('preserves name, description, and instructions', () => {
      const { skill: result } = mapper.map(skill, '.cursorrules');
      expect(result.name).toBe('ts');
      expect(result.description).toBe('TypeScript conventions');
    });

    it('preserves instructions for .cursorrules output', () => {
      const { skill: result } = mapper.map(skill, '.cursorrules');
      expect(result.instructions).toBe('Prefer named exports');
    });

    it('cleans up claude and mcp fields', () => {
      const withExtra: IntermediateSkill = {
        ...skill,
        platformSpecific: {
          ...skill.platformSpecific,
          claude: { disableModelInvocation: false },
          mcp: { command: 'echo' },
        },
      };
      const { skill: result } = mapper.map(withExtra, '.cursorrules');
      expect(result.platformSpecific.claude).toBeUndefined();
      expect(result.platformSpecific.mcp).toBeUndefined();
    });
  });

  describe('.mdc → skill.md', () => {
    it('preserves cursor globs with warning', () => {
      const skill: IntermediateSkill = {
        name: 'ts',
        description: 'TS rules',
        instructions: 'Content',
        metadata: { sourceFormat: '.mdc' },
        platformSpecific: { cursor: { globs: ['**/*.ts'] } },
      };

      const { skill: result, report } = mapper.map(skill, 'skill.md');
      expect(result.name).toBe('ts');
      expect(report.lost).toContain('platformSpecific.cursor.globs');
    });
  });

  describe('supported formats', () => {
    it('lists supported sources', () => {
      const sources = mapper.supportedSources();
      expect(sources).toContain('skill.md');
      expect(sources).toContain('.cursorrules');
      expect(sources).toContain('.mdc');
    });

    it('lists supported targets', () => {
      const targets = mapper.supportedTargets();
      expect(targets).toContain('skill.md');
      expect(targets).toContain('.cursorrules');
      expect(targets).toContain('.mdc');
    });
  });
});
