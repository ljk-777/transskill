import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execa } from 'execa';
import type { InputResolver } from './resolver.interface.js';
import type { ResolvedInput } from '../core/types.js';
import { TransSkillError } from '../core/errors.js';

interface GitHubRef {
  owner: string;
  repo: string;
  subpath?: string;
}

/**
 * Parse GitHub references from various input formats.
 */
function parseGitHubRef(input: string): GitHubRef {
  let owner: string;
  let repo: string;
  let subpath: string | undefined;

  // gh:owner/repo[/subpath]
  const ghMatch = input.match(/^gh:([^/]+)\/([^/]+)(?:\/(.+))?$/);
  if (ghMatch) {
    owner = ghMatch[1];
    repo = ghMatch[2].replace(/\.git$/, '');
    subpath = ghMatch[3];
    return { owner, repo, subpath };
  }

  // https://github.com/owner/repo[/subpath]
  const urlMatch = input.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\/(.+))?$/,
  );
  if (urlMatch) {
    owner = urlMatch[1];
    repo = urlMatch[2].replace(/\.git$/, '');
    subpath = urlMatch[3];
    return { owner, repo, subpath };
  }

  throw new TransSkillError(
    `Invalid GitHub reference: "${input}". Use gh:owner/repo or https://github.com/owner/repo`,
    'UNSUPPORTED_INPUT',
    { input },
  );
}

/**
 * Resolves GitHub repository references by cloning them to a temporary directory.
 * Supports: gh:owner/repo, gh:owner/repo/subpath, https://github.com/owner/repo
 */
export class GitHubResolver implements InputResolver {
  supports(input: string): boolean {
    return /^gh:/i.test(input) || /^https?:\/\/github\.com\//i.test(input);
  }

  async resolve(input: string): Promise<ResolvedInput> {
    const ref = parseGitHubRef(input);
    const repoUrl = `https://github.com/${ref.owner}/${ref.repo}.git`;

    // Create a temporary directory for cloning
    const tmpDir = await mkdtemp(join(tmpdir(), 'transskill-'));

    try {
      // Shallow clone for speed
      await execa('git', ['clone', '--depth', '1', repoUrl, tmpDir], {
        timeout: 30_000,
      });

      // If subpath is specified, verify it exists
      const targetPath = ref.subpath ? join(tmpDir, ref.subpath) : tmpDir;

      // Verify the target path exists
      const { accessSync, statSync } = await import('node:fs');
      try {
        accessSync(targetPath);
      } catch {
        throw new TransSkillError(
          `Subpath "${ref.subpath}" does not exist in repository ${ref.owner}/${ref.repo}`,
          'FILE_NOT_FOUND',
          { repo: `${ref.owner}/${ref.repo}`, subpath: ref.subpath },
        );
      }

      const stat = statSync(targetPath);

      return {
        localPath: targetPath,
        source: { kind: 'github', repo: `${ref.owner}/${ref.repo}`, subpath: ref.subpath },
        type: stat.isFile() ? 'file' : 'directory',
        isRemote: true,
        cleanup: async () => {
          try {
            await rm(tmpDir, { recursive: true, force: true });
          } catch {
            // Non-fatal: temp files will be cleaned up by the OS eventually
          }
        },
      };
    } catch (err) {
      // Clean up on failure
      try {
        await rm(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }

      if (err instanceof TransSkillError) throw err;

      throw new TransSkillError(
        `Failed to clone repository ${ref.owner}/${ref.repo}. Make sure it exists and is public.`,
        'GIT_CLONE_FAILED',
        { repo: `${ref.owner}/${ref.repo}`, originalError: String(err) },
      );
    }
  }
}
