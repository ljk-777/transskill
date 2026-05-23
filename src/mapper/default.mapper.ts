import type { Mapper, MappedResult, ConversionReport } from './mapper.interface.js';
import type { FormatType, IntermediateSkill } from '../core/types.js';

/**
 * Default mapper handles all bidirectional conversions:
 *   SKILL.md ↔ .cursorrules
 *   SKILL.md ↔ .mdc
 *   .cursorrules ↔ .mdc
 */
export class DefaultMapper implements Mapper {
  private readonly biMap: Record<string, FormatType[]> = {
    'skill.md': ['.cursorrules', '.mdc'],
    '.cursorrules': ['skill.md', '.mdc'],
    '.mdc': ['skill.md', '.cursorrules'],
  };

  supportedSources(): FormatType[] {
    return Object.keys(this.biMap) as FormatType[];
  }

  supportedTargets(): FormatType[] {
    const set = new Set<FormatType>();
    for (const targets of Object.values(this.biMap)) {
      targets.forEach((t) => set.add(t));
    }
    return Array.from(set);
  }

  map(skill: IntermediateSkill, targetFormat: FormatType): MappedResult {
    const report: ConversionReport = {
      sourceFormat: skill.metadata.sourceFormat,
      targetFormat,
      warnings: [],
      preserved: ['name', 'description', 'instructions'],
      lost: [],
    };

    const result = this.deepClone(skill);
    result.metadata.sourceFormat = targetFormat;

    switch (targetFormat) {
      case '.cursorrules': {
        // .cursorrules has no frontmatter — scripts and asset refs are lost
        if (result.metadata.attachedFiles && result.metadata.attachedFiles.length > 0) {
          report.warnings.push(
            'Scripts and asset references from the skill directory will not work in .cursorrules (pure text format). Files have been copied alongside the output.',
          );
          report.lost.push('attachedFiles (scripts, assets, references)');
        }

        // Claude-specific fields are meaningless in Cursor
        if (result.platformSpecific.claude?.disableModelInvocation) {
          report.warnings.push(
            '.cursorrules does not support disableModelInvocation — rules always apply.',
          );
          report.lost.push('platformSpecific.claude.disableModelInvocation');
        }
        if (result.platformSpecific.claude?.manualOnly) {
          report.lost.push('platformSpecific.claude.manualOnly');
        }
        break;
      }

      case '.mdc': {
        // Ensure cursor-specific fields exist
        if (!result.platformSpecific.cursor) {
          result.platformSpecific.cursor = { alwaysApply: false };
        }

        // Transfer attached files info if available
        if (result.metadata.attachedFiles && result.metadata.attachedFiles.length > 0) {
          report.warnings.push(
            'Attached files were copied but .mdc cannot reference them natively.',
          );
        }

        // Claude-specific fields
        if (result.platformSpecific.claude?.disableModelInvocation) {
          report.warnings.push(
            'disableModelInvocation has no equivalent in .mdc — use alwaysApply for similar effect.',
          );
          report.lost.push('platformSpecific.claude.disableModelInvocation');
        }
        break;
      }

      case 'skill.md': {
        // SKILL.md is the richest format — most fields preserve
        report.preserved.push('metadata.tags', 'metadata.author', 'metadata.version');

        // Cursor-specific globs have no direct equivalent
        if (result.platformSpecific.cursor?.globs) {
          report.warnings.push(
            'File glob scoping (globs) is not supported in SKILL.md. Consider splitting into multiple skills.',
          );
          report.lost.push('platformSpecific.cursor.globs');
        }
        break;
      }

      default: {
        report.warnings.push(`Target format "${targetFormat}" uses generic mapping.`);
      }
    }

    // Clean up platform fields that don't apply to target
    this.cleanupPlatformFields(result, targetFormat);

    return { skill: result, report };
  }

  /** Remove platform-specific fields irrelevant to the target */
  private cleanupPlatformFields(
    skill: IntermediateSkill,
    targetFormat: FormatType,
  ): void {
    switch (targetFormat) {
      case '.cursorrules':
      case '.mdc':
        delete skill.platformSpecific.claude;
        delete skill.platformSpecific.openclaw;
        delete skill.platformSpecific.mcp;
        break;
      case 'skill.md':
        // Keep everything — SKILL.md is the canonical format
        break;
      default:
        delete skill.platformSpecific.cursor;
        delete skill.platformSpecific.claude;
        delete skill.platformSpecific.openclaw;
        delete skill.platformSpecific.mcp;
    }
  }

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}
