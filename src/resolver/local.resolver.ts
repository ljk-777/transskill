import { accessSync, constants, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { InputResolver } from './resolver.interface.js';
import type { ResolvedInput } from '../core/types.js';
import { TransSkillError } from '../core/errors.js';

/**
 * Resolves local file and directory paths.
 * Supports: ./path, ../path, /absolute/path, ~/path, or plain names that exist.
 */
export class LocalResolver implements InputResolver {
  supports(input: string): boolean {
    // GitHub URLs are handled by GitHubResolver, not here
    if (/^gh:/i.test(input) || /^https?:\/\/github\.com\//i.test(input)) {
      return false;
    }

    // Check if it looks like a local path or if the path actually exists
    if (input.startsWith('.') || input.startsWith('/') || input.startsWith('~')) {
      return true;
    }

    // Plain name that exists as a file or directory
    try {
      const resolved = resolve(input);
      accessSync(resolved, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async resolve(input: string): Promise<ResolvedInput> {
    // Expand ~ to home directory
    const normalized = input.startsWith('~')
      ? input.replace('~', process.env.HOME || process.env.USERPROFILE || '')
      : input;

    const absPath = resolve(normalized);

    // Verify the path exists
    try {
      accessSync(absPath, constants.F_OK);
    } catch {
      throw new TransSkillError(
        `Path does not exist: ${absPath}`,
        'FILE_NOT_FOUND',
        { input, resolved: absPath },
      );
    }

    const stat = statSync(absPath);
    const isFile = stat.isFile();
    const isDir = stat.isDirectory();

    if (!isFile && !isDir) {
      throw new TransSkillError(
        `Path is neither a file nor a directory: ${absPath}`,
        'UNSUPPORTED_INPUT',
        { input, resolved: absPath },
      );
    }

    return {
      localPath: absPath,
      source: { kind: isFile ? 'local-file' : 'local-directory', path: absPath },
      type: isFile ? 'file' : 'directory',
      isRemote: false,
    };
  }
}
