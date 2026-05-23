import { writeFileSync, mkdirSync, existsSync, cpSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { AttachedFile } from '../core/types.js';

/**
 * Copy attached files from a skill's metadata into the output directory,
 * preserving relative directory structure.
 */
export function copyAttachedFiles(
  attachedFiles: AttachedFile[] | undefined,
  outputPath: string,
): { copied: string[]; skipped: string[] } {
  const copied: string[] = [];
  const skipped: string[] = [];

  if (!attachedFiles || attachedFiles.length === 0) {
    return { copied, skipped };
  }

  for (const file of attachedFiles) {
    const targetPath = join(outputPath, file.relativePath);
    const targetDir = dirname(targetPath);

    try {
      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
      }

      // Skip if source doesn't exist
      try {
        if (!existsSync(file.absolutePath)) {
          skipped.push(file.absolutePath);
          continue;
        }
      } catch {
        skipped.push(file.absolutePath);
        continue;
      }

      cpSync(file.absolutePath, targetPath, { recursive: true, force: true });
      copied.push(targetPath);
    } catch {
      skipped.push(file.absolutePath);
    }
  }

  return { copied, skipped };
}

/**
 * Copy all files from a source directory tree to a target directory.
 * Used for copying scripts/references/assets directories entirely.
 */
export function copyDirectoryTree(sourceDir: string, targetDir: string): string[] {
  const copied: string[] = [];

  try {
    const entries = readdirSync(sourceDir, { withFileTypes: true });
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    for (const entry of entries) {
      const srcPath = join(sourceDir, entry.name);
      const dstPath = join(targetDir, entry.name);

      if (entry.isDirectory()) {
        const subCopied = copyDirectoryTree(srcPath, dstPath);
        copied.push(...subCopied);
      } else {
        cpSync(srcPath, dstPath, { force: true });
        copied.push(dstPath);
      }
    }
  } catch {
    // silently skip
  }

  return copied;
}
