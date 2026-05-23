/** Custom error types for TransSkill */

export type ErrorCode =
  | 'UNSUPPORTED_INPUT'
  | 'INPUT_RESOLVE_FAILED'
  | 'UNSUPPORTED_OUTPUT_FORMAT'
  | 'INVALID_FRONTMATTER'
  | 'INVALID_JSON'
  | 'FILE_NOT_FOUND'
  | 'DIR_NOT_FOUND'
  | 'NO_SKILL_FOUND'
  | 'GIT_CLONE_FAILED'
  | 'GIT_CLEANUP_FAILED'
  | 'EMPTY_INSTRUCTIONS'
  | 'CONVERSION_WARNING'
  | 'UNKNOWN_ERROR';

export class TransSkillError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code: ErrorCode, details?: Record<string, unknown>) {
    super(message);
    this.name = 'TransSkillError';
    this.code = code;
    this.details = details;
  }
}
