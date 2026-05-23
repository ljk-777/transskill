import type { InputSource, ResolvedInput } from '../core/types.js';

/**
 * InputResolver interface - resolves user input strings into local file paths.
 * Supports local files/directories and remote sources like GitHub.
 */
export interface InputResolver {
  /** Check if this resolver can handle the given input string */
  supports(input: string): boolean;

  /** Resolve the input to a local path for processing */
  resolve(input: string): Promise<ResolvedInput>;
}
