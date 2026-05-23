import type { InputResolver } from './resolver.interface.js';
import { TransSkillError } from '../core/errors.js';

const resolvers: InputResolver[] = [];

/**
 * Register an input resolver (ordered by priority).
 * First registered = checked first.
 */
export function registerResolver(resolver: InputResolver): void {
  resolvers.push(resolver);
}

/**
 * Find the first resolver that can handle the given input and resolve it.
 * Throws if no resolver supports the input.
 */
export async function resolveInput(input: string): Promise<ReturnType<InputResolver['resolve']>> {
  for (const resolver of resolvers) {
    if (resolver.supports(input)) {
      try {
        return await resolver.resolve(input);
      } catch (err) {
        throw new TransSkillError(
          `Failed to resolve input: ${input}`,
          'INPUT_RESOLVE_FAILED',
          { originalError: String(err) },
        );
      }
    }
  }

  throw new TransSkillError(
    `Unsupported input: "${input}". Use a local path (./, /, ~) or GitHub URL (gh:user/repo, https://github.com/...)`,
    'UNSUPPORTED_INPUT',
    { input },
  );
}

/** Get all registered resolver descriptions (for debugging/list-formats) */
export function getRegisteredResolvers(): string[] {
  return resolvers.map((r) => r.constructor.name);
}
