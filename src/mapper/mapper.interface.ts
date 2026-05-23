import type { FormatType, IntermediateSkill } from '../core/types.js';

export interface ConversionReport {
  sourceFormat: FormatType;
  targetFormat: FormatType;
  warnings: string[];
  preserved: string[];
  lost: string[];
}

/**
 * Mapper interface - maps fields between platform skill formats.
 * Reports what was preserved and what was lost during conversion.
 */
export interface Mapper {
  /** Map an IntermediateSkill to a target format */
  map(skill: IntermediateSkill, targetFormat: FormatType): MappedResult;

  /** List source formats this mapper supports */
  supportedSources(): FormatType[];

  /** List target formats this mapper supports */
  supportedTargets(): FormatType[];
}

export interface MappedResult {
  skill: IntermediateSkill;
  report: ConversionReport;
}
